'use strict';

/**
 * P8.02 / P8.03 / P8.05 / P8.06 / P8.07 — middleware Phase 8 hardening.
 */

const Database = require('better-sqlite3');
const factsRepo = require('../repositories/patient-record-facts-repo');
const { orchestrateCapture } = require('../services/capture-orchestration');
const { ensureTables: ensureMeter } = require('../services/ai-capture-meter');
const {
  purgeExpiredPatientRecordMedia,
  DEFAULT_CONFIRMED_MEDIA_DAYS,
} = require('../services/patient-record-retention');
const { translateLabDisplayText } = require('../services/lab-translate');
const { buildShelfAskLearnReply } = require('../services/shelf-ask-learn');
const { recommendLimit, costFor, PROFILES } = require('../scripts/measure-ai-capture-cost.cjs');
const fs = require('fs');
const path = require('path');

describe('P8.02 AV scan on all capture uploads', () => {
  let prevBypass;
  let prevClam;
  beforeEach(() => {
    prevBypass = process.env.PATIENT_RECORD_AV_DEV_BYPASS;
    prevClam = process.env.CLAMAV_SOCKET;
    delete process.env.CLAMAV_SOCKET;
    delete process.env.CLAMAV_BIN;
    process.env.PATIENT_RECORD_AV_DEV_BYPASS = '1';
    process.env.NODE_ENV = 'test';
  });
  afterEach(() => {
    if (prevBypass === undefined) delete process.env.PATIENT_RECORD_AV_DEV_BYPASS;
    else process.env.PATIENT_RECORD_AV_DEV_BYPASS = prevBypass;
    if (prevClam === undefined) delete process.env.CLAMAV_SOCKET;
    else process.env.CLAMAV_SOCKET = prevClam;
  });

  test('reject case: PE magic bytes fail loudly for each tag (dev bypass heuristic)', async () => {
    const db = new Database(':memory:');
    ensureMeter(db);
    factsRepo.ensurePatientRecordFactsTable(db);
    const pe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, ...Buffer.alloc(200, 1)]);
    const tags = ['skin', 'bill', 'prescription', 'mark', 'lab', 'other'];
    for (const tag of tags) {
      const result = await orchestrateCapture({
        db,
        tag,
        aiOrManual: 'manual',
        sessionId: `av_${tag}`,
        buffer: pe,
        mimeType: 'application/octet-stream',
        fileName: 'evil.exe',
        userHints: { date: '2026-07-16', label: 'x', drug: 'x', body_location: 'arm', note: 'n' },
      });
      expect(result.ok).toBe(false);
      expect(['AV_SCAN_BLOCKED', 'AV_HEURISTIC_BLOCKED']).toContain(result.error_code);
      expect(result.status).toBe(403);
    }
    db.close();
  });

  test('fail-closed when ClamAV missing and no DEV bypass', async () => {
    delete process.env.PATIENT_RECORD_AV_DEV_BYPASS;
    const AntivirusService = require('../services/antivirus-service');
    const result = await AntivirusService.scanPatientRecordBuffer(Buffer.from('jpeg-bytes'));
    expect(result.safe).toBe(false);
    expect(result.error_code).toBe('AV_NOT_CONFIGURED');
  });

  test('orchestration source wires scanPatientRecordBuffer', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../services/capture-orchestration/index.js'),
      'utf8',
    );
    expect(src).toMatch(/AntivirusService/);
    expect(src).toMatch(/scanPatientRecordBuffer/);
    expect(src).toMatch(/AV_SCAN_BLOCKED|AV_NOT_CONFIGURED|error_code/);
  });
});

describe('P8.03 Retention policy enforced job', () => {
  test('purges raw_extract_text + media after confirmed retention window', async () => {
    const os = require('os');
    const fs = require('fs');
    const path = require('path');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'p803-ret-'));
    const prevRoot = process.env.PATIENT_LOCAL_MEDIA_ROOT;
    process.env.PATIENT_LOCAL_MEDIA_ROOT = tmpRoot;
    const db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
    const old = new Date(Date.now() - (DEFAULT_CONFIRMED_MEDIA_DAYS + 5) * 86400000).toISOString();
    db.prepare(
      `INSERT INTO patient_record_facts
        (id, patient_id, session_id, tag, media_type, ai_or_manual, structured_json, raw_extract_text,
         storage_ref, confirmed_at, created_at, updated_at)
       VALUES (?, ?, ?, 'lab', 'pdf', 'manual', '{}', 'OCR TEXT', 'local://gone.jpg', ?, ?, ?)`,
    ).run('fact_old', 'Patient/1', 's1', old, old, old);

    const fresh = new Date().toISOString();
    db.prepare(
      `INSERT INTO patient_record_facts
        (id, patient_id, session_id, tag, media_type, ai_or_manual, structured_json, raw_extract_text,
         storage_ref, confirmed_at, created_at, updated_at)
       VALUES (?, ?, ?, 'bill', 'pdf', 'manual', '{}', 'KEEP', 'local://keep.jpg', ?, ?, ?)`,
    ).run('fact_new', 'Patient/1', 's1', fresh, fresh, fresh);

    const out = await purgeExpiredPatientRecordMedia(db);
    expect(out.enforced).toBe(true);
    expect(out.raw_cleared).toBeGreaterThanOrEqual(1);
    const oldRow = db.prepare(`SELECT raw_extract_text, storage_ref FROM patient_record_facts WHERE id='fact_old'`).get();
    expect(oldRow.raw_extract_text).toBeNull();
    expect(oldRow.storage_ref).toBeNull();
    const newRow = db.prepare(`SELECT raw_extract_text FROM patient_record_facts WHERE id='fact_new'`).get();
    expect(newRow.raw_extract_text).toBe('KEEP');
    db.close();
    if (prevRoot === undefined) delete process.env.PATIENT_LOCAL_MEDIA_ROOT;
    else process.env.PATIENT_LOCAL_MEDIA_ROOT = prevRoot;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  test('server registers retention interval job', () => {
    const src = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
    expect(src).toMatch(/purgeExpiredPatientRecordMedia/);
    expect(src).toMatch(/P8\.03/);
  });
});

describe('P8.05 OCR cost measurement', () => {
  test('reports blended p50/p95 and verdict vs AI_FREE_CAPTURE_LIMIT', () => {
    const costs = {};
    for (const [k, v] of Object.entries(PROFILES)) costs[k] = costFor(v);
    expect(costs.skin_vision_p50.estimated_usd).toBeGreaterThan(0);
    const rec = recommendLimit(costs);
    expect(['holds', 'holds_with_headroom', 'needs_lowering', 'needs_raising']).toContain(
      rec.verdict,
    );
    expect(rec.current_AI_FREE_CAPTURE_LIMIT).toBeGreaterThan(0);
    expect(rec.blended_p50_usd).toBeGreaterThan(0);
  });
});

describe('P8.06 Lab translate after English extract SSOT', () => {
  test('does not invent multilingual OCR — translates stored text only', () => {
    const same = translateLabDisplayText({
      sourceText: 'WBC normal',
      source_language: 'en',
      target_language: 'en',
    });
    expect(same.ok).toBe(true);
    expect(same.mode).toMatch(/english_ssot|passthrough/);

    const deferred = translateLabDisplayText({
      sourceText: 'WBC normal',
      source_language: 'en',
      target_language: 'es',
    });
    expect(deferred.ok).toBe(true);
    expect(deferred.mode).toBe('deferred_mt_keeps_english_extract');
    expect(deferred.translated_text).toBe('WBC normal');

    const bad = translateLabDisplayText({
      sourceText: 'This is a diagnosis of melanoma',
      target_language: 'es',
    });
    expect(bad.ok).toBe(false);
    expect(bad.error_code).toBe('DIAGNOSIS_VOCABULARY');

    const route = fs.readFileSync(path.join(__dirname, '../routes/patient-records.js'), 'utf8');
    expect(route).toMatch(/lab-translate/);
    expect(route).toMatch(/translate_stored_english_extract_only/);
  });
});

describe('P8.07 Ask/Learn shelf LLM policy', () => {
  test('returns labeled ai_suggestion and rejects diagnosis vocabulary', () => {
    const ok = buildShelfAskLearnReply({
      kind: 'learn',
      productName: 'Niacinamide',
      question: 'What does it do?',
    });
    expect(ok.ok).toBe(true);
    expect(ok.ai_suggestion.labeled).toBe('ai_suggestion');
    expect(ok.ai_suggestion.not_diagnosis).toBe(true);

    const bad = buildShelfAskLearnReply({
      kind: 'ask',
      productName: 'X',
      question: 'Can you diagnose my rash?',
    });
    expect(bad.ok).toBe(false);
    expect(bad.error_code).toBe('DIAGNOSIS_VOCABULARY');

    const route = fs.readFileSync(path.join(__dirname, '../routes/patient-shelf.js'), 'utf8');
    expect(route).toMatch(/\/api\/patient\/shelf\/ask-learn/);
  });
});

describe('P8.04 HIPAA consumer doc reflects medical tracker', () => {
  test('HIPAA_CONSUMER.md documents facts store + tag enum + binding', () => {
    const doc = fs.readFileSync(
      path.join(__dirname, '../../docs/security/HIPAA_CONSUMER.md'),
      'utf8',
    );
    expect(doc).toMatch(/patient_record_facts/);
    expect(doc).toMatch(/skin.*bill.*prescription.*mark.*lab.*other/s);
    expect(doc).toMatch(/capture_token/);
    expect(doc).toMatch(/P8\.03/);
    expect(doc).toMatch(/2026-07-16/);
  });
});
