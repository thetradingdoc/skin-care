'use strict';

/**
 * Confirm edit persists edited structured_json (not original extraction).
 * Same factId — not a new capture.
 */

const Database = require('better-sqlite3');
const factsRepo = require('../repositories/patient-record-facts-repo');

describe('Confirm field edit → DB reflects edit', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
  });

  afterEach(() => {
    db.close();
  });

  test('updateFactConfirm stores edited body_area, keeps same fact id', () => {
    const created = factsRepo.insertFact(db, {
      patient_id: 'pat_edit',
      session_id: 'sess_edit',
      tag: 'skin',
      ai_or_manual: 'ai',
      structured_json: {
        date: '2026-07-16',
        body_area: 'cheek, left',
        ai_suggestion: {
          text: 'some redness',
          labeled: 'ai_suggestion',
          not_diagnosis: true,
        },
      },
      request_id: 'req_edit_capture_1',
      confirmed_at: null,
    });

    const updated = factsRepo.updateFactConfirm(db, {
      id: created.id,
      patientId: 'pat_edit',
      sessionId: 'sess_edit',
      patch: {
        structured_json: {
          date: '2026-07-16',
          body_area: 'forehead',
          ai_suggestion: created.structured_json.ai_suggestion,
          note: 'user corrected area',
        },
        confirmed_at: new Date().toISOString(),
      },
    });

    expect(updated.id).toBe(created.id);
    expect(updated.structured_json.body_area).toBe('forehead');
    expect(updated.structured_json.body_area).not.toBe('cheek, left');
    expect(updated.confirmed_at).toBeTruthy();
    expect(updated.request_id).toBe('req_edit_capture_1');
    expect(updated.ai_or_manual).toBe('ai');

    const row = factsRepo.getFactById(db, created.id);
    expect(row.structured_json.body_area).toBe('forehead');
  });
});
