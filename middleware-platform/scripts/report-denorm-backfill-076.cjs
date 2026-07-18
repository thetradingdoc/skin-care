'use strict';

/**
 * Report 076 denorm backfill status against a SQLite DB (prod/staging snapshot).
 *
 * Usage:
 *   DB_PATH=/path/to/middleware-prod.db node scripts/report-denorm-backfill-076.cjs
 *
 * Does not mutate the DB unless --run is passed (then calls migration up()).
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const {
  up,
  countPendingBackfill,
  resolveEnvironmentName,
} = require('../migrations/076_patient_record_facts_denorm_backfill');
const { resolveFactsEncryptionKeySource } = require('../services/patient-record-field-crypto');

const dbPath = process.env.DB_PATH || process.argv[2];
const shouldRun = process.argv.includes('--run');

if (!dbPath || !fs.existsSync(dbPath)) {
  console.error('Usage: DB_PATH=/path/to.db node scripts/report-denorm-backfill-076.cjs [--run]');
  process.exit(2);
}

const db = new Database(dbPath, { readonly: !shouldRun });
const cols = db.prepare(`PRAGMA table_info(patient_record_facts)`).all().map((c) => c.name);
const hasDenorm = cols.includes('expiry_date') && cols.includes('fact_subtype');
const hasMarker = cols.includes('denorm_backfilled_at');
const key = resolveFactsEncryptionKeySource();

const confirmed = hasDenorm
  ? db.prepare(`SELECT COUNT(*) AS n FROM patient_record_facts WHERE confirmed_at IS NOT NULL`).get().n
  : null;

let pending = null;
let marked = null;
if (hasMarker) {
  pending = countPendingBackfill(db);
  marked = db
    .prepare(
      `SELECT COUNT(*) AS n FROM patient_record_facts
       WHERE confirmed_at IS NOT NULL AND denorm_backfilled_at IS NOT NULL`,
    )
    .get().n;
}

const report = {
  db_path: path.resolve(dbPath),
  environment: resolveEnvironmentName(),
  key_source: key.source,
  key_is_dev_fallback: key.isDevFallback,
  schema: {
    has_075_denorm_cols: hasDenorm,
    has_076_marker: hasMarker,
    columns: cols.filter((c) =>
      ['fact_subtype', 'expiry_date', 'provider', 'issue_date', 'denorm_backfilled_at', 'entry_date'].includes(c),
    ),
  },
  counts: {
    confirmed_facts: confirmed,
    pending_backfill: pending,
    already_marked: marked,
  },
};

console.log(JSON.stringify(report, null, 2));

if (shouldRun) {
  if (db.readonly) {
    console.error('Cannot --run on readonly open');
    process.exit(1);
  }
  try {
    const result = up(db);
    console.log('BACKFILL_RESULT', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('BACKFILL_THREW', e.code || e.message);
    console.error(
      JSON.stringify(
        {
          code: e.code,
          environment: e.environment,
          pending_rows: e.pending_rows,
          message: e.message,
          backfill_result: e.backfill_result || null,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
}

db.close();
