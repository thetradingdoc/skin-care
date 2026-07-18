'use strict';

const Database = require('better-sqlite3');
const { assertRecordOwnedByCaller } = require('../routes/patient-records');
const {
  issueSignedOrTokenUrl,
  consumeMediaToken,
} = require('../services/patient-record-media-access');
const { tryConsume, ensureTables } = require('../services/ai-capture-meter');
const factsRepo = require('../repositories/patient-record-facts-repo');

describe('Wave 3 Touche P2 security', () => {
  describe('SEC-26/27 ownership helper', () => {
    test('adversarial: other patient_id is forbidden', () => {
      const r = assertRecordOwnedByCaller(
        { patient_id: 'pat_a', session_id: 'sess_a' },
        { patientId: 'pat_b', sessionId: 'sess_b' }
      );
      expect(r.ok).toBe(false);
      expect(r.code).toBe('RECORD_IDOR');
    });

    test('same patient_id allowed', () => {
      const r = assertRecordOwnedByCaller(
        { patient_id: 'pat_a', session_id: 'sess_x' },
        { patientId: 'pat_a', sessionId: 'sess_y' }
      );
      expect(r.ok).toBe(true);
    });

    test('session-only fact matches caller session', () => {
      const r = assertRecordOwnedByCaller(
        { patient_id: null, session_id: 'sess_a' },
        { patientId: null, sessionId: 'sess_a' }
      );
      expect(r.ok).toBe(true);
    });
  });

  describe('SEC-30 media token burn', () => {
    let db;
    beforeEach(() => {
      db = new Database(':memory:');
      factsRepo.ensurePatientRecordFactsTable(db);
      require('../migrations/070_patient_record_media_tokens').up(db);
    });
    afterEach(() => db.close());

    test('adversarial: second consume fails after burn', () => {
      const fact = {
        id: 'fact_1',
        storage_key: 'k1',
        storage_provider: 'local',
        storage_ref: 'local://k1',
      };
      const issued = issueSignedOrTokenUrl(fact, { db, ttlSec: 300 });
      expect(issued.media_url).toMatch(/\/api\/patient\/records\/media\//);
      const token = issued.media_url.split('/').pop();
      const first = consumeMediaToken(token, db);
      expect(first).toBeTruthy();
      const second = consumeMediaToken(token, db);
      expect(second).toBeNull();
    });
  });

  describe('SEC-31 meter race on welcome bonus', () => {
    let db;
    beforeEach(() => {
      db = new Database(':memory:');
      ensureTables(db);
      require('../migrations/066_ai_welcome_bonus').up(db);
    });
    afterEach(() => db.close());

    test('adversarial: only one of two concurrent welcome consumes succeeds', () => {
      process.env.AI_FREE_CAPTURE_LIMIT = '0';
      process.env.AI_WELCOME_BONUS_LIMIT = '1';
      db.prepare(
        `INSERT INTO ai_welcome_bonus (id, owner_key, patient_id, quota, remaining, issued_at, expires_at, created_at)
         VALUES ('wb1', 'patient:pat_race', 'pat_race', 1, 1, datetime('now'), datetime('now', '+7 days'), datetime('now'))`
      ).run();
      const a = tryConsume(db, {
        patientId: 'pat_race',
        sessionId: 's1',
        captureKind: 'single',
      });
      const b = tryConsume(db, {
        patientId: 'pat_race',
        sessionId: 's1',
        captureKind: 'single',
      });
      const welcomeWins = [a, b].filter((x) => x.ok && x.source === 'welcome_bonus');
      expect(welcomeWins.length).toBe(1);
      const rem = db.prepare(`SELECT remaining FROM ai_welcome_bonus WHERE id = 'wb1'`).get();
      expect(rem.remaining).toBe(0);
      const failures = [a, b].filter((x) => !x.ok);
      expect(failures.length).toBe(1);
    });
  });

  describe('SEC-28 upload path wiring', () => {
    test('source requires AV + persist policy on /records/upload', () => {
      const fs = require('fs');
      const path = require('path');
      const src = fs.readFileSync(path.join(__dirname, '../routes/patient-records.js'), 'utf8');
      expect(src).toMatch(/SEC-28: same AV \+ media gate/);
      expect(src).toMatch(/scanPatientRecordBuffer/);
      expect(src).toMatch(/assertOrchestrationPersistPolicy/);
      expect(src).toMatch(/assertRecordOwnedByCaller/);
    });
  });
});
