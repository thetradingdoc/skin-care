'use strict';

/**
 * TOUCH-044 evidence — Skip writes routine daily item_logs, not just a toast.
 * Run: node __tests__/check-agent-skip.evidence.js
 */

const assert = require('assert');
const Database = require('better-sqlite3');
const { applySkipActivesTonight } = require('../services/check-agent-skip-service');

function setup() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE patient_routine_templates (
      id TEXT PRIMARY KEY, session_id TEXT, patient_id TEXT, name TEXT, is_active INTEGER, updated_at TEXT
    );
    CREATE TABLE patient_routine_template_items (
      id TEXT PRIMARY KEY, template_id TEXT, role TEXT, category TEXT, product_name TEXT, step_order INTEGER
    );
    CREATE TABLE patient_routine_daily_entries (
      id TEXT PRIMARY KEY, template_id TEXT, session_id TEXT, patient_id TEXT, entry_date TEXT,
      skin_report TEXT, notes TEXT, completion_score INTEGER, created_at TEXT, updated_at TEXT
    );
    CREATE TABLE patient_routine_daily_item_logs (
      id TEXT PRIMARY KEY, daily_entry_id TEXT, template_item_id TEXT, completed INTEGER, notes TEXT,
      created_at TEXT, updated_at TEXT
    );
  `);
  db.prepare(
    `INSERT INTO patient_routine_templates (id, session_id, patient_id, name, is_active, updated_at)
     VALUES ('tmpl1', 'ps1', 'pat1', 'Acne', 1, datetime('now'))`,
  ).run();
  db.prepare(
    `INSERT INTO patient_routine_template_items (id, template_id, role, category, product_name, step_order)
     VALUES ('i1', 'tmpl1', 'cleanser', 'cleanser', 'Gentle Wash', 0)`,
  ).run();
  db.prepare(
    `INSERT INTO patient_routine_template_items (id, template_id, role, category, product_name, step_order)
     VALUES ('i2', 'tmpl1', 'treatment', 'serum', 'Retinol Serum', 1)`,
  ).run();
  db.prepare(
    `INSERT INTO patient_routine_template_items (id, template_id, role, category, product_name, step_order)
     VALUES ('i3', 'tmpl1', 'moisturizer', 'moisturizer', 'Barrier Cream', 2)`,
  ).run();
  return db;
}

function main() {
  const db = setup();
  const result = applySkipActivesTonight(db, {
    sessionId: 'ps1',
    patientId: 'pat1',
    entryDate: '2026-07-14',
  });
  console.log('SKIP_RESULT', JSON.stringify(result, null, 2));
  assert.strictEqual(result.applied, true);
  assert.strictEqual(result.path, 'routine_daily_item_logs');
  assert.ok(result.skipped_count >= 1);

  const entry = db
    .prepare(`SELECT * FROM patient_routine_daily_entries WHERE entry_date = '2026-07-14'`)
    .get();
  assert.ok(entry, 'daily entry created');
  assert.ok(String(entry.notes).includes('agent_skip'));
  const report = JSON.parse(entry.skin_report);
  assert.strictEqual(report.agent_skip_tonight, true);

  const logs = db
    .prepare(`SELECT template_item_id, completed, notes FROM patient_routine_daily_item_logs WHERE daily_entry_id = ?`)
    .all(entry.id);
  console.log('ITEM_LOGS', logs);
  const retinol = logs.find((l) => l.template_item_id === 'i2');
  assert.ok(retinol);
  assert.strictEqual(retinol.completed, 0);
  assert.strictEqual(retinol.notes, 'skipped_tonight_agent');

  console.log('TOUCH-044 EVIDENCE: PASS');
  db.close();
}

main();
