'use strict';

/**
 * STEP 7 — One-time denorm backfill (076) + reminder denorm-first hot path.
 */

const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const factsRepo = require('../repositories/patient-record-facts-repo');
const {
  encryptStructuredJson,
  extractDenormQueryables,
  resolveFactsEncryptionKeySource,
} = require('../services/patient-record-field-crypto');
const {
  up: denormBackfill,
  countPendingBackfill,
} = require('../migrations/076_patient_record_facts_denorm_backfill');
const { runRxExpiryReminderJob } = require('../services/medical-tracker-domain/reminder-jobs');
const { ensureTables: ensurePushTables } = require('../services/patient-push-service');

function seedPre075ConfirmedRow(db, structured, { tag = 'prescription', patientId = 'pat_pre075' } = {}) {
  require('../migrations/067_patient_record_facts').up(db);
  require('../migrations/068_patient_record_facts_owner_request_id').up(db);
  require('../migrations/072_patient_record_facts_entry_date').up(db);
  require('../migrations/075_patient_record_facts_denorm_queryables').up(db);
  require('../migrations/076_patient_record_facts_denorm_backfill').ensureBackfillColumn(db);

  const id = `prf_${uuidv4()}`;
  const cipher = encryptStructuredJson(structured);
  db.prepare(
    `INSERT INTO patient_record_facts (
      id, patient_id, session_id, owner_key, tag, media_type, ai_or_manual,
      structured_json, confirmed_at, entry_date,
      fact_subtype, expiry_date, provider, issue_date, denorm_backfilled_at,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, NULL, 'manual',
      ?, datetime('now'), NULL,
      NULL, NULL, NULL, NULL, NULL,
      datetime('now'), datetime('now')
    )`,
  ).run(id, patientId, 'sess_pre075', patientId, tag, cipher);
  return id;
}

describe('STEP 7 — denorm backfill (076)', () => {
  test('seeds pre-075 rows → backfill populates denorm; second run is no-op skip', () => {
    const db = new Database(':memory:');
    const structured = {
      date: '2026-01-15',
      drug: 'tretinoin',
      rx_kind: 'medication',
      template_id: 'prescription.medication',
      expiry: '2026-07-20',
      prescriber: 'Dr. Backfill',
      reminder_opt_in: true,
    };
    const expected = extractDenormQueryables(structured, 'prescription');
    expect(expected.expiry_date).toBe('2026-07-20');
    expect(expected.provider).toBe('Dr. Backfill');
    expect(expected.fact_subtype).toBe('medication');
    expect(expected.issue_date).toBe('2026-01-15');

    const id = seedPre075ConfirmedRow(db, structured);
    const before = db
      .prepare(
        `SELECT fact_subtype, expiry_date, provider, issue_date, denorm_backfilled_at
         FROM patient_record_facts WHERE id = ?`,
      )
      .get(id);
    expect(before.fact_subtype).toBeNull();
    expect(before.expiry_date).toBeNull();
    expect(before.provider).toBeNull();
    expect(before.issue_date).toBeNull();
    expect(before.denorm_backfilled_at).toBeNull();
    expect(countPendingBackfill(db)).toBe(1);

    const first = denormBackfill(db);
    expect(first.status).toBe('ok');
    expect(first.rows_processed).toBe(1);
    expect(first.rows_failed).toEqual([]);

    const after = db
      .prepare(
        `SELECT fact_subtype, expiry_date, provider, issue_date, denorm_backfilled_at, structured_json
         FROM patient_record_facts WHERE id = ?`,
      )
      .get(id);
    expect(after.fact_subtype).toBe(expected.fact_subtype);
    expect(after.expiry_date).toBe(expected.expiry_date);
    expect(after.provider).toBe(expected.provider);
    expect(after.issue_date).toBe(expected.issue_date);
    expect(after.denorm_backfilled_at).toBeTruthy();

    // Encrypted JSON still matches extract
    const hydrated = factsRepo.mapRow(after);
    expect(extractDenormQueryables(hydrated.structured_json, 'prescription')).toEqual(expected);

    const second = denormBackfill(db);
    expect(second.status).toBe('ok');
    expect(second.rows_seen).toBe(0);
    expect(second.rows_processed).toBe(0);
    expect(second.rows_skipped_already_populated).toBeGreaterThanOrEqual(1);
    expect(countPendingBackfill(db)).toBe(0);

    db.close();
  });

  test('blocked_no_key reports environment + pending count (does not soft-skip)', () => {
    const db = new Database(':memory:');
    seedPre075ConfirmedRow(db, {
      date: '2026-01-01',
      drug: 'x',
      expiry: '2026-08-01',
      rx_kind: 'medication',
    });

    const prevNode = process.env.NODE_ENV;
    const prevFacts = process.env.PATIENT_RECORD_FACTS_ENCRYPTION_KEY;
    const prevBilling = process.env.BILLING_DATA_ENCRYPTION_KEY;
    const prevSession = process.env.SESSION_SECRET;
    const prevApp = process.env.APP_ENV;
    try {
      process.env.NODE_ENV = 'production';
      process.env.APP_ENV = 'production';
      delete process.env.PATIENT_RECORD_FACTS_ENCRYPTION_KEY;
      delete process.env.BILLING_DATA_ENCRYPTION_KEY;
      delete process.env.SESSION_SECRET;

      const key = resolveFactsEncryptionKeySource();
      expect(key.isDevFallback).toBe(true);

      let thrown;
      try {
        denormBackfill(db);
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeTruthy();
      expect(thrown.code).toBe('BLOCKED_NO_KEY');
      expect(thrown.environment).toMatch(/production/i);
      expect(thrown.pending_rows).toBe(1);
      expect(thrown.message).toMatch(/BLOCKED_NO_KEY/);
      expect(thrown.backfill_result.status).toBe('blocked_no_key');
      expect(countPendingBackfill(db)).toBe(1);
    } finally {
      process.env.NODE_ENV = prevNode;
      if (prevFacts != null) process.env.PATIENT_RECORD_FACTS_ENCRYPTION_KEY = prevFacts;
      else delete process.env.PATIENT_RECORD_FACTS_ENCRYPTION_KEY;
      if (prevBilling != null) process.env.BILLING_DATA_ENCRYPTION_KEY = prevBilling;
      else delete process.env.BILLING_DATA_ENCRYPTION_KEY;
      if (prevSession != null) process.env.SESSION_SECRET = prevSession;
      else delete process.env.SESSION_SECRET;
      if (prevApp != null) process.env.APP_ENV = prevApp;
      else delete process.env.APP_ENV;
    }
    db.close();
  });

  test('reminder hot path uses denorm expiry after backfill (not decrypt-for-expiry)', async () => {
    const db = new Database(':memory:');
    ensurePushTables(db);
    const id = seedPre075ConfirmedRow(db, {
      date: '2026-01-01',
      drug: 'tretinoin',
      expiry: '2026-07-20',
      rx_kind: 'medication',
      reminder_opt_in: true,
    });
    denormBackfill(db);
    const raw = db.prepare(`SELECT expiry_date FROM patient_record_facts WHERE id = ?`).get(id);
    expect(raw.expiry_date).toBe('2026-07-20');

    const res = await runRxExpiryReminderJob(db, { todayIso: '2026-07-16', flush: false });
    expect(res.enqueued.some((e) => e.fact_id === id)).toBe(true);
    expect(res.used_denorm_expiry).toBeGreaterThanOrEqual(1);
    expect(res.enqueued.find((e) => e.fact_id === id).expiry_source).toBe('denorm');
    db.close();
  });

  test('reminder decrypt fallback only when expiry_date still null', async () => {
    const db = new Database(':memory:');
    ensurePushTables(db);
    // Schema + column, but leave denorm null and do NOT run successful backfill marker
    require('../migrations/067_patient_record_facts').up(db);
    require('../migrations/068_patient_record_facts_owner_request_id').up(db);
    require('../migrations/072_patient_record_facts_entry_date').up(db);
    require('../migrations/075_patient_record_facts_denorm_queryables').up(db);
    require('../migrations/076_patient_record_facts_denorm_backfill').ensureBackfillColumn(db);

    const id = `prf_${uuidv4()}`;
    const cipher = encryptStructuredJson({
      date: '2026-01-01',
      drug: 'fallback-rx',
      expiry: '2026-07-20',
      reminder_opt_in: true,
    });
    // Mark backfilled so ensure()/076 won't fill denorm — simulates unreachable row
    db.prepare(
      `INSERT INTO patient_record_facts (
        id, patient_id, session_id, owner_key, tag, ai_or_manual,
        structured_json, confirmed_at,
        fact_subtype, expiry_date, provider, issue_date, denorm_backfilled_at,
        created_at, updated_at
      ) VALUES (
        ?, 'pat_fb', 'sess_fb', 'pat_fb', 'prescription', 'manual',
        ?, datetime('now'),
        NULL, NULL, NULL, NULL, datetime('now'),
        datetime('now'), datetime('now')
      )`,
    ).run(id, cipher);

    const res = await runRxExpiryReminderJob(db, { todayIso: '2026-07-16', flush: false });
    expect(res.enqueued.some((e) => e.fact_id === id)).toBe(true);
    expect(res.used_decrypt_expiry_fallback).toBeGreaterThanOrEqual(1);
    expect(res.enqueued.find((e) => e.fact_id === id).expiry_source).toBe('decrypt_fallback');
    db.close();
  });
});
