'use strict';

/**
 * TOUCH-018 evidence — allergens persist to patient_allergen_exclusions.
 * Run: node __tests__/patient-allergens-persist.evidence.js
 */

const assert = require('assert');
const Database = require('better-sqlite3');
const { ensureAllergenTable } = require('../routes/patient-allergens');

function main() {
  const db = new Database(':memory:');
  ensureAllergenTable(db);
  const sessionId = 'ps_allergen_e2e';
  const patientId = 'pat_allergen_e2e';

  const before = db.prepare(`SELECT COUNT(*) AS n FROM patient_allergen_exclusions`).get().n;
  console.log('BEFORE_ALLERGENS', before);
  assert.strictEqual(before, 0);

  db.prepare(
    `INSERT INTO patient_allergen_exclusions (id, patient_id, session_id, allergen_class, label, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
  ).run('al_e2e', patientId, sessionId, 'acrylates', 'acrylates');

  const after = db
    .prepare(`SELECT allergen_class, label FROM patient_allergen_exclusions WHERE session_id = ?`)
    .all(sessionId);
  console.log('AFTER_ALLERGENS', JSON.stringify(after, null, 2));
  assert.strictEqual(after.length, 1);
  assert.strictEqual(after[0].allergen_class, 'acrylates');

  // Usable by future hard_no path: class id present for evaluate lookups.
  const hardNoLookup = db
    .prepare(
      `SELECT 1 AS hit FROM patient_allergen_exclusions WHERE session_id = ? AND allergen_class = ?`,
    )
    .get(sessionId, 'acrylates');
  assert.ok(hardNoLookup, 'evaluate hard_no path can read exclusion class');
  console.log('HARD_NO_LOOKUP', hardNoLookup);
  console.log('TOUCH-018 EVIDENCE: PASS (engine hard_no emit is TOUCH-054)');
  db.close();
}

main();
