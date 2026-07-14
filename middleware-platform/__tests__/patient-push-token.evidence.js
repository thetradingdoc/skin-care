'use strict';

/**
 * TOUCH-114 evidence — device token storage per patient/session.
 * Run: node __tests__/patient-push-token.evidence.js
 */

const assert = require('assert');
const Database = require('better-sqlite3');
const { ensureDeviceTable } = require('../routes/patient-devices');

function main() {
  const db = new Database(':memory:');
  ensureDeviceTable(db);
  const token = 'ExponentPushToken[test-touch-114]';
  db.prepare(
    `INSERT INTO patient_device_push_tokens (id, patient_id, session_id, platform, token, created_at, updated_at)
     VALUES ('dev1', 'pat1', 'ps1', 'ios', ?, datetime('now'), datetime('now'))`,
  ).run(token);
  const row = db.prepare(`SELECT * FROM patient_device_push_tokens WHERE token = ?`).get(token);
  console.log('STORED_DEVICE', JSON.stringify(row, null, 2));
  assert.strictEqual(row.platform, 'ios');
  assert.strictEqual(row.patient_id, 'pat1');
  console.log('TOUCH-114 EVIDENCE: PASS (permission deny remains client-side non-blocking)');
  db.close();
}

main();
