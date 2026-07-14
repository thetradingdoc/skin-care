'use strict';

/**
 * TOUCH-039/042 evidence — severity enums + ranks.
 * Run: node __tests__/journal-severity.evidence.js
 */

const assert = require('assert');
const Database = require('better-sqlite3');
const { up } = require('../migrations/060_journal_severity_levels');
const { normalizeSeverityPayload, levelToRank } = require('../lib/journal-severity');
const { upsertEntry, getByDateRange, getYesterdaySeverity } = require('../repositories/patient-journal-repo');

function main() {
  const db = new Database(':memory:');
  up(db);

  assert.strictEqual(levelToRank('low'), 1);
  assert.strictEqual(levelToRank('some'), 2);
  assert.strictEqual(levelToRank('a_lot'), 3);

  const sev = normalizeSeverityPayload({
    dryness_level: 'some',
    breakout_level: 'a lot',
    calm_flag: 'no',
  });
  assert.strictEqual(sev.breakout_level, 'a_lot');
  assert.strictEqual(sev.breakout_rank, 3);

  const sessionId = 'ps_sev';
  upsertEntry(db, {
    patientId: 'pat_sev',
    sessionId,
    entryDate: '2026-07-13',
    drynessLevel: 'low',
    breakoutLevel: 'some',
    calmFlag: 'yes',
    source: 'check_camera',
  });
  upsertEntry(db, {
    patientId: 'pat_sev',
    sessionId,
    entryDate: '2026-07-14',
    drynessLevel: 'a_lot',
    breakoutLevel: 'a_lot',
    calmFlag: 'no',
    source: 'check_camera',
  });

  const y = getYesterdaySeverity(db, {
    patientId: 'pat_sev',
    sessionId,
    todayIso: '2026-07-14',
  });
  assert.strictEqual(y.dryness_level, 'low');
  assert.strictEqual(y.dryness_rank, 1);

  const hist = getByDateRange(db, {
    patientId: 'pat_sev',
    sessionId,
    startIso: '2026-07-01',
    endIso: '2026-07-14',
  });
  assert.strictEqual(hist.length, 2);
  assert.ok(hist.every((h) => h.dryness_rank >= 1 && h.dryness_rank <= 3));

  // Invalid enum rejected by trigger
  let threw = false;
  try {
    upsertEntry(db, {
      patientId: 'pat_sev',
      sessionId,
      entryDate: '2026-07-12',
      drynessLevel: 'severe',
      breakoutLevel: 'low',
      calmFlag: 'yes',
    });
  } catch {
    threw = true;
  }
  assert.ok(threw, 'invalid dryness_level must abort');

  console.log('TOUCH-039/042 EVIDENCE: PASS', {
    yesterday: y.dryness_level,
    ranks: hist.map((h) => h.dryness_rank),
  });
  db.close();
}

main();
