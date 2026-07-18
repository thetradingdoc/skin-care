'use strict';

const Database = require('better-sqlite3');
const {
  maybeAddRxToShelf,
  orchestrateMultiCapture,
} = require('../services/capture-orchestration');
const {
  createCaptureSession,
  advanceCaptureQueue,
  getCaptureSession,
} = require('../services/capture-orchestration/capture-session');
const factsRepo = require('../repositories/patient-record-facts-repo');
const { ensureTables: ensureMeter } = require('../services/ai-capture-meter');

describe('H8 P3.22 Rx→Shelf reveal gate (must not fire early)', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    ensureMeter(db);
    factsRepo.ensurePatientRecordFactsTable(db);
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
  });

  afterEach(() => {
    try {
      db.close();
    } catch (_) {}
  });

  function rxFact(drug = 'tretinoin') {
    return {
      tag: 'prescription',
      structured_json: { drug, strength: '0.05%', date: '2026-07-16' },
    };
  }

  test('requireSkinReveal blocks insert when reveal_done is false', () => {
    const sess = createCaptureSession(db, {
      sessionId: 's1',
      tags: ['skin', 'prescription'],
    });
    expect(sess.queue.find((q) => q.tag === 'skin').reveal_done).toBe(false);

    const before = db.prepare(`SELECT COUNT(*) AS c FROM patient_onboarding_step3_products`).get().c;
    const result = maybeAddRxToShelf(db, {
      sessionId: 's1',
      prescriptionFact: rxFact(),
      requireSkinReveal: true,
      captureSession: sess,
    });
    expect(result).toEqual({ skipped: true, reason: 'awaiting_skin_reveal' });
    const after = db.prepare(`SELECT COUNT(*) AS c FROM patient_onboarding_step3_products`).get().c;
    expect(after).toBe(before);
  });

  test('requireSkinReveal blocks when captureSession is null', () => {
    const result = maybeAddRxToShelf(db, {
      sessionId: 's1',
      prescriptionFact: rxFact(),
      requireSkinReveal: true,
      captureSession: null,
    });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('awaiting_skin_reveal');
    expect(db.prepare(`SELECT COUNT(*) AS c FROM patient_onboarding_step3_products`).get().c).toBe(0);
  });

  test('requireSkinReveal allows insert only after skin.reveal_done === true', () => {
    const sess = createCaptureSession(db, {
      sessionId: 's1',
      tags: ['skin', 'prescription'],
    });
    const blocked = maybeAddRxToShelf(db, {
      sessionId: 's1',
      prescriptionFact: rxFact(),
      requireSkinReveal: true,
      captureSession: sess,
    });
    expect(blocked.reason).toBe('awaiting_skin_reveal');

    const afterReveal = advanceCaptureQueue(db, sess.id, {
      tag: 'skin',
      step: 'reveal',
      factId: 'skin_fact',
    });
    expect(afterReveal.queue.find((q) => q.tag === 'skin').reveal_done).toBe(true);

    const allowed = maybeAddRxToShelf(db, {
      sessionId: 's1',
      prescriptionFact: rxFact(),
      requireSkinReveal: true,
      captureSession: afterReveal,
    });
    expect(allowed.ok).toBe(true);
    expect(allowed.product_name).toBe('tretinoin');
    const row = db.prepare(`SELECT * FROM patient_onboarding_step3_products WHERE id = ?`).get(allowed.product_id);
    expect(row.product_name).toBe('tretinoin');
  });

  test('multi-tag create leaves skin.reveal_done false (create-time cannot satisfy gate)', async () => {
    const multi = await orchestrateMultiCapture({
      db,
      tags: ['skin', 'prescription'],
      aiOrManual: 'manual',
      sessionId: 'multi_gate',
      userHints: { date: '2026-07-16', note: 'skin', drug: 'tretinoin', strength: '0.05%' },
      requestId: 'multi-gate-req',
    });
    expect(multi.ok).toBe(true);
    const sess = getCaptureSession(db, multi.capture_session.id);
    const skin = sess.queue.find((q) => q.tag === 'skin');
    expect(skin.reveal_done).toBe(false);

    const rx = multi.results.find((r) => r.tag === 'prescription').fact;
    const shelf = maybeAddRxToShelf(db, {
      sessionId: 'multi_gate',
      prescriptionFact: rx,
      requireSkinReveal: true,
      captureSession: sess,
    });
    expect(shelf).toEqual({ skipped: true, reason: 'awaiting_skin_reveal' });
    expect(db.prepare(`SELECT COUNT(*) AS c FROM patient_onboarding_step3_products`).get().c).toBe(0);
  });
});
