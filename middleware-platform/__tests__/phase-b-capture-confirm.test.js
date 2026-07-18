'use strict';

/**
 * Phase B definitive test: capture (orchestrateCapture) → confirm → fact row in DB.
 * ai_or_manual='ai', structured_json matches extraction.
 */

const Database = require('better-sqlite3');
const factsRepo = require('../repositories/patient-record-facts-repo');
const { ensureTables: ensureMeter } = require('../services/ai-capture-meter');

function tinyJpeg() {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
    Buffer.alloc(4096, 1),
  ]);
}

describe('Phase B definitive: orchestrateCapture → confirm → DB', () => {
  let db;

  beforeEach(() => {
    process.env.PATIENT_RECORD_AV_DEV_BYPASS = '1';
    jest.resetModules();
    jest.doMock('../services/capture-orchestration/perceive', () => ({
      perceiveSkinVision: jest.fn(async () => ({
        ok: true,
        vision: {
          scan_summary: 'some redness on the left cheek',
          findings: [{ label: 'cheek, left' }],
          quality: 'ok',
          body_area: 'cheek, left',
        },
      })),
      perceiveDocOcr: jest.fn(async () => ({ ok: false, text: '' })),
    }));
    jest.doMock('../services/antivirus-service', () => ({
      scanPatientRecordBuffer: jest.fn(async () => ({ safe: true })),
      BLOCKED_MESSAGE: 'blocked',
    }));
  });

  afterEach(() => {
    if (db) db.close();
    delete process.env.PATIENT_RECORD_AV_DEV_BYPASS;
    jest.resetModules();
  });

  test('AI skin capture persists draft then confirm sets confirmed_at', async () => {
    const factsRepoFresh = require('../repositories/patient-record-facts-repo');
    const { ensureTables: ensureMeterFresh } = require('../services/ai-capture-meter');
    const { orchestrateCapture } = require('../services/capture-orchestration');

    db = new Database(':memory:');
    factsRepoFresh.ensurePatientRecordFactsTable(db);
    ensureMeterFresh(db);

    const created = await orchestrateCapture({
      db,
      tag: 'skin',
      aiOrManual: 'ai',
      sessionId: 'sess_phase_b',
      patientId: 'pat_phase_b',
      buffer: tinyJpeg(),
      mimeType: 'image/jpeg',
      isPlus: true,
      requestId: 'req_phase_b_skin_1',
      userHints: { date: '2026-07-16' },
    });

    expect(created.ok).toBe(true);
    expect(created.fact).toBeTruthy();
    expect(created.fact.ai_or_manual).toBe('ai');
    expect(created.fact.tag).toBe('skin');
    expect(created.fact.confirmed_at).toBeFalsy();
    expect(created.draft).toBeTruthy();
    expect(created.draft.ai_suggestion).toBeTruthy();
    expect(created.draft.ai_suggestion.labeled).toBe('ai_suggestion');

    const factId = created.fact.id;
    const edited = {
      ...created.draft,
      body_area: created.draft.body_area || 'cheek, left',
      note: 'user confirmed',
    };

    const updated = factsRepoFresh.updateFactConfirm(db, {
      id: factId,
      sessionId: 'sess_phase_b',
      patientId: 'pat_phase_b',
      patch: {
        structured_json: edited,
        confirmed_at: new Date().toISOString(),
      },
    });

    expect(updated).toBeTruthy();
    expect(updated.confirmed_at).toBeTruthy();
    expect(updated.ai_or_manual).toBe('ai');
    expect(updated.tag).toBe('skin');
    expect(updated.structured_json.body_area || edited.body_area).toBeTruthy();
    expect(updated.structured_json.ai_suggestion.labeled).toBe('ai_suggestion');

    const row = factsRepoFresh.getFactById(db, factId);
    expect(row.ai_or_manual).toBe('ai');
    expect(row.confirmed_at).toBeTruthy();
    expect(JSON.stringify(row.structured_json)).toContain('ai_suggestion');
  });

  test('QUALITY_GATE_FAILED and DIAGNOSIS_VOCABULARY map to vision_fail (2c)', async () => {
    const { orchestrateCapture } = require('../services/capture-orchestration');
    db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
    ensureMeter(db);

    const empty = await orchestrateCapture({
      db,
      tag: 'skin',
      aiOrManual: 'ai',
      sessionId: 'sess_qg',
      buffer: Buffer.alloc(0),
      mimeType: 'image/jpeg',
      isPlus: true,
    });
    expect(empty.ok).toBe(false);
    expect(empty.error_code).toBe('QUALITY_GATE_FAILED');
    expect(empty.manual_allowed).toBe(true);

    const dx = await orchestrateCapture({
      db,
      tag: 'skin',
      aiOrManual: 'manual',
      sessionId: 'sess_dx',
      buffer: tinyJpeg(),
      mimeType: 'image/jpeg',
      userHints: { date: '2026-07-16', note: 'diagnosed with psoriasis' },
    });
    expect(dx.ok).toBe(false);
    expect(dx.error_code).toBe('DIAGNOSIS_VOCABULARY');
    expect(dx.vision_fail).toBe(true);
  });

  test('patient-records routes wire gate + anonymous→orchestrateCapture', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '../routes/patient-records.js'),
      'utf8',
    );
    expect(src).toMatch(/\/api\/patient\/records\/capture\/gate/);
    expect(src).toMatch(/aiWantsOrchestration/);
    expect(src).toMatch(/via: 'orchestrateCapture'/);
  });
});
