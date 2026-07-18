'use strict';

const Database = require('better-sqlite3');
const { assessCaptureQuality } = require('../services/capture-orchestration/quality-gate');
const { structureByTag } = require('../services/capture-orchestration/structure-by-tag');
const { parseBillingFieldsFromText } = require('../services/billing-ocr-parser');
const {
  orchestrateCapture,
  orchestrateMultiCapture,
  maybeAddRxToShelf,
} = require('../services/capture-orchestration');
const {
  orderTagsForCapture,
  createCaptureSession,
  advanceCaptureQueue,
  getCaptureSession,
} = require('../services/capture-orchestration/capture-session');
const factsRepo = require('../repositories/patient-record-facts-repo');
const { ensureTables: ensureMeter } = require('../services/ai-capture-meter');

describe('P3.03 quality gate', () => {
  test('rejects empty buffer', () => {
    const q = assessCaptureQuality({ buffer: null, tag: 'skin' });
    expect(q.ok).toBe(false);
    expect(q.action).toBe('retake');
  });

  test('accepts reasonable jpeg-ish bytes', () => {
    const buf = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(5000, 1)]);
    const q = assessCaptureQuality({ buffer: buf, mimeType: 'image/jpeg', tag: 'skin' });
    expect(q.ok).toBe(true);
  });
});

describe('P3.07 billing-ocr-parser', () => {
  test('parses amount and date', () => {
    const r = parseBillingFieldsFromText({
      text: 'Dermatology Clinic\nService date: 2026-07-01\nAmount due: $125.50',
      fileName: 'bill.pdf',
    });
    expect(r.amount_cents).toBe(12550);
    expect(r.service_date).toBe('2026-07-01');
    expect(r.provider_name).toMatch(/Dermatology/i);
  });
});

describe('P3.08–13 structurers', () => {
  test('P3.08 Structurer skin — skin keeps ai_suggestion separate', () => {
    const s = structureByTag('skin', {
      vision: { scan_summary: 'Looks calmer', findings: [{ label: 'cheek' }] },
      userHints: { date: '2026-07-16', note: 'mine' },
    });
    expect(s.valid).toBe(true);
    expect(s.normalized.note).toBe('mine');
    expect(s.normalized.ai_suggestion.text).toMatch(/calmer/i);
  });

  test('P3.11 Structurer mark — mark mints compare_group_id', () => {
    const s = structureByTag('mark', { userHints: { date: '2026-07-16', body_location: 'arm' } });
    expect(s.valid).toBe(true);
    expect(s.normalized.compare_group_id).toMatch(/^cg_/);
  });

  test('P3.12 Structurer lab — lab includes language', () => {
    const s = structureByTag('lab', {
      ocrText: 'Bonjour le résultat',
      userHints: { date: '2026-07-01', title: 'CBC' },
    });
    expect(s.valid).toBe(true);
    expect(s.normalized.source_language).toBeTruthy();
  });

  test('P3.09 Structurer bill — bill from OCR text', () => {
    const s = structureByTag('bill', {
      ocrText: 'Clinic A\n2026-06-15\nTotal: $40.00',
    });
    expect(s.valid).toBe(true);
    expect(s.normalized.amount_cents).toBe(4000);
  });

  test('P3.10 Structurer prescription — prescription extracts drug', () => {
    const s = structureByTag('prescription', {
      userHints: { drug: 'Tretinoin', strength: '0.025%', expiry: '2027-07-07' },
    });
    expect(s.valid).toBe(true);
    expect(s.normalized.drug).toMatch(/Tretinoin/i);
    expect(s.normalized.strength).toMatch(/0\.025/);
  });

  test('P3.13 Structurer other — other free_text confirm', () => {
    const s = structureByTag('other', {
      userHints: { date: '2026-07-16', label: 'eye exam', free_text_facts: 'notes' },
    });
    expect(s.valid).toBe(true);
    expect(s.normalized.label).toMatch(/eye exam/i);
  });
});

describe('P3.01 Capture orchestration service entrypoint / P3.14 Manual path creates fact', () => {
  let db;
  beforeEach(() => {
    db = new Database(':memory:');
    ensureMeter(db);
    factsRepo.ensurePatientRecordFactsTable(db);
  });
  afterEach(() => {
    try {
      db.close();
    } catch (_) {}
  });

  test('P3.14 Manual path creates fact without metering', async () => {
    const result = await orchestrateCapture({
      db,
      tag: 'other',
      aiOrManual: 'manual',
      sessionId: 'sess_manual',
      userHints: { date: '2026-07-16', label: 'Note', free_text_facts: 'hello' },
      requestId: 'cap-manual-1',
    });
    expect(result.ok).toBe(true);
    expect(result.metered).toBe(false);
    expect(result.fact.ai_or_manual).toBe('manual');
    expect(result.fact.tag).toBe('other');
    expect(result.fact.confirmed_at).toBeNull();
  });

  test('confirm persists edits', async () => {
    const created = await orchestrateCapture({
      db,
      tag: 'skin',
      aiOrManual: 'manual',
      sessionId: 's1',
      userHints: { date: '2026-07-16', note: 'draft' },
    });
    const updated = factsRepo.updateFactConfirm(db, {
      id: created.fact.id,
      sessionId: 's1',
      patch: { structured_json: { date: '2026-07-16', note: 'confirmed', ai_suggestion: null } },
    });
    expect(updated.confirmed_at).toBeTruthy();
    expect(updated.structured_json.note).toBe('confirmed');
  });

  const tags = ['skin', 'bill', 'prescription', 'mark', 'lab', 'other'];
  test.each(tags)('manual capture→confirm for tag %s (P3.17)', async (tag) => {
    const hints = {
      skin: { date: '2026-07-16', note: 'n' },
      bill: { date: '2026-07-16', amount: 10, currency: 'USD' },
      prescription: { drug: 'tretinoin', strength: '0.025%' },
      mark: { date: '2026-07-16', body_location: 'cheek' },
      lab: { date: '2026-07-16', title: 'CBC', free_text: 'wbc normal' },
      other: { date: '2026-07-16', label: 'misc' },
    }[tag];
    const created = await orchestrateCapture({
      db,
      tag,
      aiOrManual: 'manual',
      sessionId: `s_${tag}`,
      userHints: hints,
      requestId: `req_${tag}`,
    });
    expect(created.ok).toBe(true);
    expect(created.fact.tag).toBe(tag);
    const confirmed = factsRepo.updateFactConfirm(db, {
      id: created.fact.id,
      sessionId: `s_${tag}`,
      patch: { structured_json: created.draft },
    });
    expect(confirmed.confirmed_at).toBeTruthy();
  });
});

describe('P3.18–23 multi-tag session', () => {
  let db;
  beforeEach(() => {
    db = new Database(':memory:');
    ensureMeter(db);
    factsRepo.ensurePatientRecordFactsTable(db);
  });
  afterEach(() => {
    try {
      db.close();
    } catch (_) {}
  });

  test('orders tags skin before prescription', () => {
    expect(orderTagsForCapture(['prescription', 'skin'])).toEqual(['skin', 'prescription']);
  });

  test('queue advances confirm→reveal→thesis', () => {
    const sess = createCaptureSession(db, {
      sessionId: 'ms1',
      tags: ['skin', 'prescription'],
    });
    expect(sess.queue[0].status).toBe('active');
    expect(sess.queue[1].status).toBe('queued');
    let next = advanceCaptureQueue(db, sess.id, { tag: 'skin', factId: 'f1', step: 'confirm' });
    expect(next.queue[0].status).toBe('confirmed');
    expect(next.queue[1].status).toBe('active');
    next = advanceCaptureQueue(db, sess.id, { tag: 'prescription', factId: 'f2', step: 'confirm' });
    next = advanceCaptureQueue(db, sess.id, { tag: 'prescription', step: 'reveal' });
    next = advanceCaptureQueue(db, sess.id, { tag: 'prescription', step: 'thesis' });
    expect(getCaptureSession(db, sess.id).queue.find((q) => q.tag === 'prescription').thesis_done).toBe(
      true,
    );
  });

  test('multi manual capture for skin+prescription and shelf hook', async () => {
    db.exec(`
      CREATE TABLE patient_onboarding_step3_products (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        patient_id TEXT,
        product_name TEXT,
        category TEXT,
        usage_time TEXT,
        ingredients_text TEXT,
        created_at TEXT
      );
    `);
    const multi = await orchestrateMultiCapture({
      db,
      tags: ['skin', 'prescription'],
      aiOrManual: 'manual',
      sessionId: 'multi1',
      userHints: { date: '2026-07-16', note: 'skin', drug: 'tretinoin', strength: '0.05%' },
      requestId: 'multi-req',
    });
    expect(multi.capture_session.tags).toEqual(['skin', 'prescription']);
    expect(multi.results).toHaveLength(2);
    expect(multi.results.every((r) => r.ok)).toBe(true);
    const rx = multi.results.find((r) => r.tag === 'prescription').fact;
    const shelf = maybeAddRxToShelf(db, {
      sessionId: 'multi1',
      prescriptionFact: rx,
      requireSkinReveal: false,
    });
    expect(shelf.ok).toBe(true);
    const row = db.prepare(`SELECT * FROM patient_onboarding_step3_products WHERE id = ?`).get(shelf.product_id);
    expect(row.product_name).toBe('tretinoin');
  });
});

describe('quality gate fails before meter (P3.02 Pre-flight meter_guard / P3.03)', () => {
  let db;
  beforeEach(() => {
    db = new Database(':memory:');
    ensureMeter(db);
    factsRepo.ensurePatientRecordFactsTable(db);
    process.env.AI_FREE_CAPTURE_LIMIT = '2';
  });
  afterEach(() => {
    try {
      db.close();
    } catch (_) {}
  });

  test('AI path with tiny buffer fails quality without consuming', async () => {
    const before = db.prepare(`SELECT COUNT(*) AS c FROM ai_capture_usage`).get().c;
    const result = await orchestrateCapture({
      db,
      tag: 'skin',
      aiOrManual: 'ai',
      sessionId: 'q1',
      buffer: Buffer.from([1, 2, 3]),
      mimeType: 'image/jpeg',
    });
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe('QUALITY_GATE_FAILED');
    const after = db.prepare(`SELECT COUNT(*) AS c FROM ai_capture_usage`).get().c;
    expect(after).toBe(before);
  });
});

describe('P3.04 Skin vision suggest + P3.05 Doc OCR via patient-document-extraction', () => {
  test('perceiveSkinVision wires face-read-vision for labeled ai_suggestion', () => {
    const { perceiveSkinVision } = require('../services/capture-orchestration/perceive');
    const vision = {
      scan_summary: 'Looks calmer',
      findings: [{ label: 'cheek' }],
    };
    const structured = structureByTag('skin', { vision, userHints: { date: '2026-07-16' } });
    expect(structured.normalized.ai_suggestion.source).toBe('face_read_vision');
    expect(structured.normalized.ai_suggestion.labeled).toBe('ai_suggestion');
    expect(typeof perceiveSkinVision).toBe('function');
  });

  test('perceiveDocOcr is the P3.05 patient-document-extraction entry', async () => {
    const { perceiveDocOcr } = require('../services/capture-orchestration/perceive');
    const extraction = require('../services/patient-document-extraction');
    expect(typeof extraction.extractText).toBe('function');
    expect(typeof perceiveDocOcr).toBe('function');
    const out = await perceiveDocOcr({
      buffer: Buffer.from('%PDF-1.4 fake'),
      mimeType: 'application/pdf',
      fileName: 'bill.pdf',
    });
    expect(out).toHaveProperty('ok');
    expect(out).toHaveProperty('text');
  });
});
