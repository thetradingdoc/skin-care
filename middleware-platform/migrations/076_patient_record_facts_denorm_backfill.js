'use strict';

/**
 * 076 — One-time backfill of 075 denorm columns for confirmed facts.
 *
 * Decrypt structured_json → extractDenormQueryables → write fact_subtype /
 * expiry_date / provider / issue_date. Idempotent via denorm_backfilled_at:
 * second run skips marked rows without re-decrypting.
 *
 * If the encryption key is unavailable in a prod-like environment, refuses to
 * pretend success — returns blocked_no_key with environment name + pending count.
 */

const {
  decryptStructuredJson,
  extractDenormQueryables,
  isEncryptedFactField,
  resolveFactsEncryptionKeySource,
} = require('../services/patient-record-field-crypto');

function resolveEnvironmentName() {
  return (
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.APP_ENV ||
    process.env.NODE_ENV ||
    'unknown'
  );
}

function isProdLikeEnvironment(envName) {
  const n = String(envName || '').toLowerCase();
  const node = String(process.env.NODE_ENV || '').toLowerCase();
  return (
    n === 'production' ||
    n === 'prod' ||
    n === 'staging' ||
    n === 'stage' ||
    node === 'production' ||
    node === 'prod'
  );
}

function denormEqual(a, b) {
  const na = a == null || a === '' ? null : String(a);
  const nb = b == null || b === '' ? null : String(b);
  return na === nb;
}

function ensureBackfillColumn(db) {
  const cols = db.prepare(`PRAGMA table_info(patient_record_facts)`).all();
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('denorm_backfilled_at')) {
    db.exec(`ALTER TABLE patient_record_facts ADD COLUMN denorm_backfilled_at TEXT`);
  }
}

function countPendingBackfill(db) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM patient_record_facts
       WHERE confirmed_at IS NOT NULL
         AND denorm_backfilled_at IS NULL`,
    )
    .get();
  return Number(row && row.n) || 0;
}

/**
 * @returns {{
 *   status: 'ok'|'blocked_no_key',
 *   environment: string,
 *   key_source: string,
 *   key_is_dev_fallback: boolean,
 *   rows_seen: number,
 *   rows_processed: number,
 *   rows_skipped_already_populated: number,
 *   rows_failed: Array<{ id: string, reason: string }>,
 *   pending_rows?: number,
 *   message?: string,
 * }}
 */
function up(db) {
  if (!db || typeof db.exec !== 'function') {
    return {
      status: 'ok',
      environment: resolveEnvironmentName(),
      key_source: resolveFactsEncryptionKeySource().source,
      key_is_dev_fallback: resolveFactsEncryptionKeySource().isDevFallback,
      rows_seen: 0,
      rows_processed: 0,
      rows_skipped_already_populated: 0,
      rows_failed: [],
    };
  }

  // 075 columns must exist
  require('./075_patient_record_facts_denorm_queryables').up(db);
  ensureBackfillColumn(db);

  const environment = resolveEnvironmentName();
  const keyInfo = resolveFactsEncryptionKeySource();
  const pending = countPendingBackfill(db);

  if (pending > 0 && keyInfo.isDevFallback && isProdLikeEnvironment(environment)) {
    const message =
      `[076 denorm backfill] BLOCKED_NO_KEY env=${environment} pending_rows=${pending} ` +
      `key_source=${keyInfo.source} — set PATIENT_RECORD_FACTS_ENCRYPTION_KEY (or BILLING_DATA_ENCRYPTION_KEY) and re-run`;
    console.error(message);
    const err = new Error(message);
    err.code = 'BLOCKED_NO_KEY';
    err.environment = environment;
    err.pending_rows = pending;
    err.backfill_result = {
      status: 'blocked_no_key',
      environment,
      key_source: keyInfo.source,
      key_is_dev_fallback: true,
      rows_seen: 0,
      rows_processed: 0,
      rows_skipped_already_populated: 0,
      rows_failed: [],
      pending_rows: pending,
      message,
    };
    throw err;
  }

  const alreadyMarked = db
    .prepare(
      `SELECT COUNT(*) AS n FROM patient_record_facts
       WHERE confirmed_at IS NOT NULL
         AND denorm_backfilled_at IS NOT NULL`,
    )
    .get();
  const skippedAlready = Number(alreadyMarked && alreadyMarked.n) || 0;

  const candidates = db
    .prepare(
      `SELECT id, tag, structured_json, fact_subtype, expiry_date, provider, issue_date
       FROM patient_record_facts
       WHERE confirmed_at IS NOT NULL
         AND denorm_backfilled_at IS NULL`,
    )
    .all();

  let rowsProcessed = 0;
  let rowsSkippedEqual = 0;
  const rowsFailed = [];

  const markStmt = db.prepare(
    `UPDATE patient_record_facts SET
       fact_subtype = ?,
       expiry_date = ?,
       provider = ?,
       issue_date = ?,
       denorm_backfilled_at = datetime('now'),
       updated_at = datetime('now')
     WHERE id = ?`,
  );
  const markOnlyStmt = db.prepare(
    `UPDATE patient_record_facts SET
       denorm_backfilled_at = datetime('now'),
       updated_at = datetime('now')
     WHERE id = ?`,
  );

  for (const row of candidates) {
    let structured;
    try {
      structured = decryptStructuredJson(row.structured_json);
    } catch (e) {
      const reason =
        keyInfo.isDevFallback && isEncryptedFactField(row.structured_json)
          ? 'decrypt_failure_key_unavailable_or_wrong'
          : e && e.code
            ? String(e.code)
            : 'decrypt_failure';
      rowsFailed.push({ id: row.id, reason });
      continue;
    }

    if (!structured || typeof structured !== 'object') {
      rowsFailed.push({ id: row.id, reason: 'malformed_structured_json' });
      continue;
    }

    let denorm;
    try {
      denorm = extractDenormQueryables(structured, row.tag);
    } catch (_) {
      rowsFailed.push({ id: row.id, reason: 'extract_denorm_failed' });
      continue;
    }

    const same =
      denormEqual(row.fact_subtype, denorm.fact_subtype) &&
      denormEqual(row.expiry_date, denorm.expiry_date) &&
      denormEqual(row.provider, denorm.provider) &&
      denormEqual(row.issue_date, denorm.issue_date);

    if (same) {
      markOnlyStmt.run(row.id);
      rowsSkippedEqual += 1;
      continue;
    }

    markStmt.run(
      denorm.fact_subtype,
      denorm.expiry_date,
      denorm.provider,
      denorm.issue_date,
      row.id,
    );
    rowsProcessed += 1;
  }

  // If every encrypted candidate failed decrypt under the fallback key, surface as blocked.
  const encryptedFailures = rowsFailed.filter((f) =>
    f.reason === 'decrypt_failure_key_unavailable_or_wrong',
  );
  if (
    candidates.length > 0 &&
    encryptedFailures.length === candidates.length &&
    keyInfo.isDevFallback
  ) {
    const message =
      `[076 denorm backfill] BLOCKED_NO_KEY env=${environment} pending_rows=${encryptedFailures.length} ` +
      `key_source=${keyInfo.source} — decrypt failed for all pending encrypted rows`;
    console.error(message);
    const err = new Error(message);
    err.code = 'BLOCKED_NO_KEY';
    err.environment = environment;
    err.pending_rows = encryptedFailures.length;
    err.backfill_result = {
      status: 'blocked_no_key',
      environment,
      key_source: keyInfo.source,
      key_is_dev_fallback: true,
      rows_seen: candidates.length,
      rows_processed: 0,
      rows_skipped_already_populated: skippedAlready,
      rows_failed: rowsFailed,
      pending_rows: encryptedFailures.length,
      message,
    };
    throw err;
  }

  const summary = {
    status: 'ok',
    environment,
    key_source: keyInfo.source,
    key_is_dev_fallback: keyInfo.isDevFallback,
    rows_seen: candidates.length,
    rows_processed: rowsProcessed,
    rows_skipped_already_populated: skippedAlready + rowsSkippedEqual,
    rows_failed: rowsFailed,
  };

  console.log(
    `[076 denorm backfill] env=${environment} seen=${summary.rows_seen} ` +
      `processed=${summary.rows_processed} skipped_populated=${summary.rows_skipped_already_populated} ` +
      `failed=${rowsFailed.length}`,
  );
  if (rowsFailed.length) {
    const byReason = {};
    for (const f of rowsFailed) {
      byReason[f.reason] = (byReason[f.reason] || 0) + 1;
    }
    console.warn(`[076 denorm backfill] failures by reason:`, byReason);
  }

  return summary;
}

module.exports = {
  up,
  resolveEnvironmentName,
  isProdLikeEnvironment,
  countPendingBackfill,
  ensureBackfillColumn,
};
