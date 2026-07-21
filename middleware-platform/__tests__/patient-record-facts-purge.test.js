'use strict';

/**
 * Phase 1 account deletion — patient_record_facts (marks/photos/notes) must purge.
 * Same evidence style as TOUCH-099 / #33 Kelly nudge purge.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const {
  purgePatientAccount,
  ensurePurgeSupportTables,
} = require('../services/patient-account-purge-service');
const factsRepo = require('../repositories/patient-record-facts-repo');

describe('account purge: patient_record_facts + media', () => {
  let db;
  let tmpRoot;
  let mediaAbs;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prf-purge-'));
    process.env.PATIENT_LOCAL_MEDIA_ROOT = tmpRoot;
    db = new Database(':memory:');
    ensurePurgeSupportTables(db);
    factsRepo.ensurePatientRecordFactsTable(db);
    require('../migrations/070_patient_record_media_tokens').up(db);
    require('../migrations/078_progress_kelly_nudge_state').up(db);

    db.exec(`
      CREATE TABLE IF NOT EXISTS patient_sessions (
        session_id TEXT PRIMARY KEY, email TEXT, patient_id TEXT, expires_at TEXT
      );
      CREATE TABLE IF NOT EXISTS patient_portal_sessions (
        id TEXT PRIMARY KEY, patient_id TEXT, email TEXT, expires_at TEXT
      );
      CREATE TABLE IF NOT EXISTS patient_physician_share_tokens (
        token TEXT PRIMARY KEY, patient_id TEXT NOT NULL, expires_at TEXT, fact_count INTEGER, revoked_at TEXT
      );
      CREATE TABLE IF NOT EXISTS patient_physician_share_access_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT, patient_id TEXT, accessed_at TEXT, outcome TEXT
      );
      CREATE TABLE IF NOT EXISTS pending_captures (
        id TEXT PRIMARY KEY, patient_id TEXT, anon_session_id TEXT, claimed_session_id TEXT
      );
      CREATE TABLE IF NOT EXISTS capture_sessions (
        id TEXT PRIMARY KEY, patient_id TEXT, session_id TEXT
      );
    `);

    const relKey = path.posix.join('patient-media', 'pat_facts', 'records', 'mark.jpg');
    mediaAbs = path.join(tmpRoot, ...relKey.split('/'));
    fs.mkdirSync(path.dirname(mediaAbs), { recursive: true });
    fs.writeFileSync(mediaAbs, Buffer.from('fake-mark-photo'));
  });

  afterEach(() => {
    db.close();
    delete process.env.PATIENT_LOCAL_MEDIA_ROOT;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  test('purge deletes mark facts, media tokens, share links, and local media bytes', async () => {
    const patientId = 'pat_facts_purge';
    const sessionId = 'sess_facts_purge';
    const email = 'facts-purge@example.com';

    db.prepare(
      `INSERT INTO patient_sessions (session_id, email, patient_id, expires_at) VALUES (?, ?, ?, datetime('now','+1 day'))`,
    ).run(sessionId, email, patientId);
    db.prepare(
      `INSERT INTO patient_portal_sessions (id, patient_id, email, expires_at) VALUES (?, ?, ?, datetime('now','+1 day'))`,
    ).run(sessionId, patientId, email);

    const markFact = factsRepo.insertFact(db, {
      patient_id: patientId,
      session_id: sessionId,
      owner_key: `patient:${patientId}`,
      tag: 'mark',
      ai_or_manual: 'manual',
      media_type: 'photo',
      storage_ref: `local://${path.posix.join('patient-media', 'pat_facts', 'records', 'mark.jpg')}`,
      storage_provider: 'local',
      storage_key: path.posix.join('patient-media', 'pat_facts', 'records', 'mark.jpg'),
      structured_json: { date: '2026-07-01', body_location: 'cheek', note: 'test mark note' },
      compare_group_id: 'cg_facts_purge',
      confirmed_at: '2026-07-01T12:00:00.000Z',
    });
    const noteFact = factsRepo.insertFact(db, {
      patient_id: patientId,
      session_id: sessionId,
      owner_key: `patient:${patientId}`,
      tag: 'skin',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-07-02', note: 'feeling calmer' },
      confirmed_at: '2026-07-02T12:00:00.000Z',
    });

    db.prepare(
      `INSERT INTO patient_record_media_tokens (token, fact_id, storage_ref, expires_at)
       VALUES ('tok_mark', ?, ?, datetime('now','+1 hour'))`,
    ).run(markFact.id, markFact.storage_ref || `local://x`);

    db.prepare(
      `INSERT INTO patient_physician_share_tokens (token, patient_id, expires_at, fact_count)
       VALUES ('share_1', ?, datetime('now','+1 day'), 2)`,
    ).run(patientId);
    db.prepare(
      `INSERT INTO patient_physician_share_access_log (token, patient_id, accessed_at, outcome)
       VALUES ('share_1', ?, datetime('now'), 'ok')`,
    ).run(patientId);

    db.prepare(
      `INSERT INTO pending_captures (id, patient_id, claimed_session_id) VALUES ('pc1', ?, ?)`,
    ).run(patientId, sessionId);
    db.prepare(
      `INSERT INTO capture_sessions (id, patient_id, session_id) VALUES ('cs1', ?, ?)`,
    ).run(patientId, sessionId);

    const beforeFacts = db
      .prepare(`SELECT COUNT(*) AS n FROM patient_record_facts WHERE patient_id = ?`)
      .get(patientId).n;
    expect(beforeFacts).toBe(2);
    expect(fs.existsSync(mediaAbs)).toBe(true);

    const result = await purgePatientAccount({ sqliteDb: db, sessionId, patientId, email });
    expect(result.success).toBe(true);
    expect(result.deleted.patient_record_facts).toBe(2);
    expect(result.deleted.patient_record_media_tokens).toBeGreaterThanOrEqual(1);
    expect(result.deleted.patient_physician_share_tokens).toBe(1);
    expect(result.deleted.pending_captures).toBeGreaterThanOrEqual(1);
    expect(result.deleted.capture_sessions).toBeGreaterThanOrEqual(1);

    const afterFacts = db
      .prepare(`SELECT COUNT(*) AS n FROM patient_record_facts WHERE patient_id = ?`)
      .get(patientId).n;
    expect(afterFacts).toBe(0);

    const afterTokens = db
      .prepare(`SELECT COUNT(*) AS n FROM patient_record_media_tokens WHERE fact_id = ?`)
      .get(markFact.id).n;
    expect(afterTokens).toBe(0);

    const afterShares = db
      .prepare(`SELECT COUNT(*) AS n FROM patient_physician_share_tokens WHERE patient_id = ?`)
      .get(patientId).n;
    expect(afterShares).toBe(0);

    expect(fs.existsSync(mediaAbs)).toBe(false);
    expect(result.deleted.media_blobs_deleted).toBeGreaterThanOrEqual(1);

    // ensure we actually seeded both ids (sanity)
    expect(noteFact.id).toBeTruthy();
  });
});
