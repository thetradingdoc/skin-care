'use strict';

/**
 * P5.03 / P5.04 — Medical-tracker reminder jobs using existing push outbox.
 * Reuses patient-push-service.enqueuePush — no new delivery infra.
 */

const { v4: uuidv4 } = require('uuid');
const factsRepo = require('../../repositories/patient-record-facts-repo');
const { enqueuePush, flushOutboxViaExpo, ensureTables } = require('../patient-push-service');

function ensureReminderTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS medical_tracker_reminder_ledger (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      dedupe_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(patient_id, kind, dedupe_key)
    );
    CREATE TABLE IF NOT EXISTS medical_tracker_reminder_prefs (
      patient_id TEXT PRIMARY KEY,
      routine_reminder_opt_in INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function setRoutineReminderOptIn(db, { patientId, optIn }) {
  if (!patientId) {
    const err = new Error('PATIENT_ID_REQUIRED');
    err.code = 'PATIENT_ID_REQUIRED';
    throw err;
  }
  ensureReminderTables(db);
  db.prepare(
    `INSERT INTO medical_tracker_reminder_prefs (patient_id, routine_reminder_opt_in, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(patient_id) DO UPDATE SET
       routine_reminder_opt_in = excluded.routine_reminder_opt_in,
       updated_at = datetime('now')`,
  ).run(patientId, optIn ? 1 : 0);
  return { patient_id: patientId, routine_reminder_opt_in: Boolean(optIn) };
}

function hasRoutineReminderOptIn(db, { patientId }) {
  if (!patientId) return false;
  ensureReminderTables(db);
  const row = db
    .prepare(
      `SELECT routine_reminder_opt_in FROM medical_tracker_reminder_prefs WHERE patient_id = ?`,
    )
    .get(patientId);
  return Boolean(row && row.routine_reminder_opt_in === 1);
}

function alreadySent(db, { patientId, kind, dedupeKey }) {
  ensureReminderTables(db);
  const row = db
    .prepare(
      `SELECT id FROM medical_tracker_reminder_ledger
       WHERE patient_id = ? AND kind = ? AND dedupe_key = ? LIMIT 1`,
    )
    .get(patientId, kind, dedupeKey);
  return Boolean(row);
}

function markSent(db, { patientId, kind, dedupeKey }) {
  ensureReminderTables(db);
  db.prepare(
    `INSERT OR IGNORE INTO medical_tracker_reminder_ledger (id, patient_id, kind, dedupe_key)
     VALUES (?, ?, ?, ?)`,
  ).run(`mtrl_${uuidv4()}`, patientId, kind, dedupeKey);
}

function daysUntil(expiryIso, todayIso) {
  if (!expiryIso || !todayIso) return null;
  const a = Date.parse(`${expiryIso}T12:00:00.000Z`);
  const b = Date.parse(`${todayIso}T12:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((a - b) / (24 * 3600 * 1000));
}

/**
 * P5.03 — Rx expiry for prescription facts with reminder_opt_in === true only.
 *
 * Hot path (post-076): SQL filters on denorm expiry_date first so we do not
 * decrypt-all to discover expiry. Fallback decrypt only for confirmed rows the
 * backfill could not populate (expiry_date IS NULL).
 * reminder_opt_in / drug still require a structured_json read per candidate.
 */
async function runRxExpiryReminderJob(db, { todayIso, withinDays = 14, flush = false } = {}) {
  if (!todayIso || !/^\d{4}-\d{2}-\d{2}$/.test(todayIso)) {
    const err = new Error('TODAY_ISO_REQUIRED');
    err.code = 'TODAY_ISO_REQUIRED';
    throw err;
  }
  ensureTables(db);
  ensureReminderTables(db);
  factsRepo.ensurePatientRecordFactsTable(db);

  // Denorm-first window (075/076) — expiry known without JSON reach-in
  const denormRows = db
    .prepare(
      `SELECT * FROM patient_record_facts
       WHERE tag = 'prescription'
         AND patient_id IS NOT NULL
         AND confirmed_at IS NOT NULL
         AND expiry_date IS NOT NULL
         AND date(expiry_date) <= date(?, '+' || ? || ' days')
         AND date(expiry_date) >= date(?, '-30 days')`,
    )
    .all(todayIso, withinDays, todayIso);

  // Fallback: backfill could not reach these (or pre-076 leftovers)
  const fallbackRows = db
    .prepare(
      `SELECT * FROM patient_record_facts
       WHERE tag = 'prescription'
         AND patient_id IS NOT NULL
         AND confirmed_at IS NOT NULL
         AND expiry_date IS NULL`,
    )
    .all();

  const enqueued = [];
  const skipped = [];
  let usedDenormExpiry = 0;
  let usedDecryptExpiryFallback = 0;

  function considerRow(row, { preferDenorm }) {
    let structured = {};
    let mapped;
    try {
      mapped = factsRepo.mapRow(row);
      structured = mapped.structured_json || {};
    } catch (_) {
      skipped.push({ fact_id: row.id, reason: 'INVALID_JSON' });
      return;
    }
    if (structured.reminder_opt_in !== true) {
      skipped.push({ fact_id: row.id, reason: 'OPT_OUT' });
      return;
    }

    let expiry = null;
    if (preferDenorm) {
      expiry = mapped.expiry_date || row.expiry_date || null;
      if (expiry) usedDenormExpiry += 1;
    } else {
      expiry = structured.expiry || structured.expiry_date || null;
      if (expiry) usedDecryptExpiryFallback += 1;
    }

    const left = daysUntil(expiry, todayIso);
    if (left == null) {
      skipped.push({ fact_id: row.id, reason: 'NO_EXPIRY' });
      return;
    }
    if (left > withinDays || left < -30) return;

    const patientId = row.patient_id;
    const dedupeKey = `${row.id}:${expiry}:${left <= 0 ? 'expired' : 'soon'}`;
    if (alreadySent(db, { patientId, kind: 'rx_expiry', dedupeKey })) {
      skipped.push({ fact_id: row.id, reason: 'ALREADY_SENT' });
      return;
    }

    const drug = structured.drug || 'Prescription';
    const pushId = enqueuePush(db, {
      patientId,
      sessionId: row.session_id || null,
      kind: 'rx_expiry',
      title: left <= 0 ? 'Prescription expired' : 'Prescription expiring soon',
      body:
        left <= 0
          ? `${drug} is past its expiry date.`
          : `${drug} expires in ${left} day${left === 1 ? '' : 's'}.`,
      data: {
        route: '/(tabs)/progress',
        kind: 'rx_expiry',
        fact_id: row.id,
        patient_id: patientId,
      },
    });
    markSent(db, { patientId, kind: 'rx_expiry', dedupeKey });
    enqueued.push({
      fact_id: row.id,
      patient_id: patientId,
      push_id: pushId,
      days_left: left,
      expiry_source: preferDenorm ? 'denorm' : 'decrypt_fallback',
    });
  }

  for (const row of denormRows) considerRow(row, { preferDenorm: true });
  for (const row of fallbackRows) considerRow(row, { preferDenorm: false });

  const result = {
    ok: true,
    kind: 'rx_expiry',
    enqueued,
    skipped_opt_out: skipped.filter((s) => s.reason === 'OPT_OUT').length,
    used_denorm_expiry: usedDenormExpiry,
    used_decrypt_expiry_fallback: usedDecryptExpiryFallback,
  };
  if (flush) result.flush = await flushOutboxViaExpo(db);
  return result;
}

/**
 * P5.04 — Routine cadence. Explicit opt-in only (never journey_modes alone).
 */
async function runRoutineCadenceReminderJob(db, { todayIso, flush = false } = {}) {
  if (!todayIso || !/^\d{4}-\d{2}-\d{2}$/.test(todayIso)) {
    const err = new Error('TODAY_ISO_REQUIRED');
    err.code = 'TODAY_ISO_REQUIRED';
    throw err;
  }
  ensureTables(db);
  ensureReminderTables(db);

  const opted = db
    .prepare(
      `SELECT patient_id FROM medical_tracker_reminder_prefs WHERE routine_reminder_opt_in = 1`,
    )
    .all();

  const enqueued = [];
  const skipped = [];

  for (const row of opted) {
    const patientId = row.patient_id;
    const dedupeKey = `routine:${todayIso}`;
    if (alreadySent(db, { patientId, kind: 'routine_cadence', dedupeKey })) {
      skipped.push({ patient_id: patientId, reason: 'ALREADY_SENT' });
      continue;
    }
    const pushId = enqueuePush(db, {
      patientId,
      sessionId: null,
      kind: 'routine_cadence',
      title: 'Routine reminder',
      body: 'Time for today’s routine check-in.',
      data: { route: '/capture', kind: 'routine_cadence', patient_id: patientId },
    });
    markSent(db, { patientId, kind: 'routine_cadence', dedupeKey });
    enqueued.push({ patient_id: patientId, push_id: pushId });
  }

  const result = {
    ok: true,
    kind: 'routine_cadence',
    enqueued,
    skipped_already: skipped.length,
  };
  if (flush) result.flush = await flushOutboxViaExpo(db);
  return result;
}

async function runMedicalTrackerReminderTick(db, { todayIso = null, flush = true } = {}) {
  const today = todayIso || new Date().toISOString().slice(0, 10);
  const rx = await runRxExpiryReminderJob(db, { todayIso: today, flush: false });
  const routine = await runRoutineCadenceReminderJob(db, { todayIso: today, flush: false });
  const flushRes = flush ? await flushOutboxViaExpo(db) : null;
  return { ok: true, today, rx, routine, flush: flushRes };
}

module.exports = {
  ensureReminderTables,
  setRoutineReminderOptIn,
  hasRoutineReminderOptIn,
  runRxExpiryReminderJob,
  runRoutineCadenceReminderJob,
  runMedicalTrackerReminderTick,
  daysUntil,
};
