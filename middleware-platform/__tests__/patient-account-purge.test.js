'use strict';

/**
 * TOUCH-099 evidence: before/after purge + re-auth session invalid.
 * Run: node __tests__/patient-account-purge.test.js
 * (Also invoked via npm test when file matches *.test.js under middleware-platform)
 */

const assert = require('assert');
const Database = require('better-sqlite3');
const {
  purgePatientAccount,
  ensurePurgeSupportTables,
} = require('../services/patient-account-purge-service');

function setupDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE patient_sessions (
      session_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      patient_id TEXT,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE patient_portal_sessions (
      id TEXT PRIMARY KEY,
      patient_id TEXT,
      email TEXT,
      verified INTEGER DEFAULT 1,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE patient_bio_profiles (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      patient_id TEXT,
      conditions_json TEXT,
      prescriptions_json TEXT
    );
    CREATE TABLE patient_allergen_exclusions (
      id TEXT PRIMARY KEY,
      patient_id TEXT,
      session_id TEXT,
      allergen_class TEXT NOT NULL,
      label TEXT,
      created_at TEXT
    );
    CREATE TABLE patient_product_lists (
      id TEXT PRIMARY KEY,
      owner_type TEXT,
      owner_id TEXT,
      list_type TEXT,
      list_name TEXT
    );
    CREATE TABLE patient_product_list_items (
      id TEXT PRIMARY KEY,
      list_id TEXT,
      product_name TEXT
    );
    CREATE TABLE patient_routine_templates (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      patient_id TEXT,
      name TEXT
    );
    CREATE TABLE patient_routine_daily_entries (
      id TEXT PRIMARY KEY,
      template_id TEXT,
      session_id TEXT,
      patient_id TEXT,
      entry_date TEXT
    );
    CREATE TABLE patient_routine_daily_media (
      id TEXT PRIMARY KEY,
      daily_entry_id TEXT,
      media_url TEXT
    );
    CREATE TABLE shopify_order_dead_letters (
      id TEXT PRIMARY KEY,
      shopify_order_id TEXT,
      email TEXT,
      payload_json TEXT,
      reason TEXT
    );
    CREATE TABLE email_verification_codes (
      id TEXT PRIMARY KEY,
      email TEXT,
      code TEXT
    );
    CREATE TABLE fhir_patients (
      resource_id TEXT PRIMARY KEY,
      email TEXT,
      phone TEXT,
      resource_json TEXT
    );
  `);
  ensurePurgeSupportTables(db);
  return db;
}

function seed(db) {
  const sessionId = 'ps_purge_test';
  const patientId = 'pat_purge_test';
  const email = 'purge-evidence@example.com';

  db.prepare(
    `INSERT INTO fhir_patients (resource_id, email, phone, resource_json) VALUES (?, ?, ?, ?)`,
  ).run(patientId, email, null, '{"name":"Test"}');
  db.prepare(
    `INSERT INTO patient_sessions (session_id, email, patient_id, expires_at) VALUES (?, ?, ?, datetime('now','+1 day'))`,
  ).run(sessionId, email, patientId);
  db.prepare(
    `INSERT INTO patient_portal_sessions (id, patient_id, email, verified, expires_at) VALUES (?, ?, ?, 1, datetime('now','+1 day'))`,
  ).run(sessionId, patientId, email);
  db.prepare(
    `INSERT INTO patient_bio_profiles (id, session_id, patient_id, conditions_json, prescriptions_json) VALUES ('bio1', ?, ?, '["acne"]', '["iso"]')`,
  ).run(sessionId, patientId);
  db.prepare(
    `INSERT INTO patient_allergen_exclusions (id, session_id, patient_id, allergen_class, label, created_at) VALUES ('al1', ?, ?, 'acrylates', 'acrylates', datetime('now'))`,
  ).run(sessionId, patientId);
  db.prepare(
    `INSERT INTO patient_product_lists (id, owner_type, owner_id, list_type, list_name) VALUES ('list1', 'session', ?, 'shelf', 'Shelf')`,
  ).run(sessionId);
  db.prepare(
    `INSERT INTO patient_product_list_items (id, list_id, product_name) VALUES ('item1', 'list1', 'Retinol')`,
  ).run();
  db.prepare(
    `INSERT INTO patient_routine_templates (id, session_id, patient_id, name) VALUES ('tmpl1', ?, ?, 'Acne')`,
  ).run(sessionId, patientId);
  db.prepare(
    `INSERT INTO patient_routine_daily_entries (id, template_id, session_id, patient_id, entry_date) VALUES ('ent1', 'tmpl1', ?, ?, '2026-07-14')`,
  ).run(sessionId, patientId);
  db.prepare(
    `INSERT INTO patient_routine_daily_media (id, daily_entry_id, media_url) VALUES ('med1', 'ent1', 'local://patient-media/x.jpg')`,
  ).run();
  db.prepare(
    `INSERT INTO shopify_order_dead_letters (id, shopify_order_id, email, payload_json, reason) VALUES ('dl1', 'ord1', ?, '{}', 'email_unmatched')`,
  ).run(email);
  db.prepare(
    `INSERT INTO email_verification_codes (id, email, code) VALUES ('otp1', ?, '123456')`,
  ).run(email);

  return { sessionId, patientId, email };
}

function count(db, table, where, params) {
  return db.prepare(`SELECT COUNT(*) AS n FROM ${table} ${where}`).get(...params).n;
}

function main() {
  const db = setupDb();
  const { sessionId, patientId, email } = seed(db);

  const before = {
    sessions: count(db, 'patient_sessions', 'WHERE session_id = ?', [sessionId]),
    bio: count(db, 'patient_bio_profiles', 'WHERE session_id = ?', [sessionId]),
    allergens: count(db, 'patient_allergen_exclusions', 'WHERE session_id = ?', [sessionId]),
    shelf_items: count(db, 'patient_product_list_items', 'WHERE list_id = ?', ['list1']),
    media: count(db, 'patient_routine_daily_media', 'WHERE id = ?', ['med1']),
    dead_letters: count(db, 'shopify_order_dead_letters', 'WHERE LOWER(email)=LOWER(?)', [email]),
    otp: count(db, 'email_verification_codes', 'WHERE LOWER(email)=LOWER(?)', [email]),
    fhir_email: db.prepare(`SELECT email FROM fhir_patients WHERE resource_id = ?`).get(patientId).email,
  };

  console.log('BEFORE_PURGE', JSON.stringify(before, null, 2));
  assert.strictEqual(before.sessions, 1);
  assert.strictEqual(before.bio, 1);
  assert.strictEqual(before.allergens, 1);
  assert.strictEqual(before.shelf_items, 1);
  assert.strictEqual(before.media, 1);
  assert.strictEqual(before.dead_letters, 1);
  assert.strictEqual(before.otp, 1);
  assert.strictEqual(before.fhir_email, email);

  const result = purgePatientAccount({ sqliteDb: db, sessionId, patientId, email });
  console.log('PURGE_RESULT', JSON.stringify(result, null, 2));
  assert.strictEqual(result.success, true);

  const after = {
    sessions: count(db, 'patient_sessions', 'WHERE session_id = ?', [sessionId]),
    sessions_by_email: count(db, 'patient_sessions', 'WHERE LOWER(email)=LOWER(?)', [email]),
    bio: count(db, 'patient_bio_profiles', 'WHERE session_id = ?', [sessionId]),
    allergens: count(db, 'patient_allergen_exclusions', 'WHERE session_id = ?', [sessionId]),
    shelf_lists: count(db, 'patient_product_lists', 'WHERE id = ?', ['list1']),
    shelf_items: count(db, 'patient_product_list_items', 'WHERE id = ?', ['item1']),
    media: count(db, 'patient_routine_daily_media', 'WHERE id = ?', ['med1']),
    dead_letters: count(db, 'shopify_order_dead_letters', 'WHERE LOWER(email)=LOWER(?)', [email]),
    otp: count(db, 'email_verification_codes', 'WHERE LOWER(email)=LOWER(?)', [email]),
    fhir_email: db.prepare(`SELECT email FROM fhir_patients WHERE resource_id = ?`).get(patientId).email,
  };

  console.log('AFTER_PURGE', JSON.stringify(after, null, 2));

  assert.strictEqual(after.sessions, 0, 'session must be deleted');
  assert.strictEqual(after.sessions_by_email, 0, 'no sessions remain for email');
  assert.strictEqual(after.bio, 0);
  assert.strictEqual(after.allergens, 0);
  assert.strictEqual(after.shelf_lists, 0);
  assert.strictEqual(after.shelf_items, 0);
  assert.strictEqual(after.media, 0);
  assert.strictEqual(after.dead_letters, 0);
  assert.strictEqual(after.otp, 0, 'OTP codes cleared — cannot reuse prior code');
  assert.strictEqual(after.fhir_email, null, 'fhir email anonymized');

  // Re-auth attempt: validateSession-style lookup must fail (no session row)
  const reauth = db.prepare(`SELECT * FROM patient_sessions WHERE session_id = ?`).get(sessionId);
  assert.strictEqual(reauth, undefined, 're-auth with old session_id must fail');
  const reauthEmail = db
    .prepare(`SELECT * FROM patient_sessions WHERE LOWER(email)=LOWER(?)`)
    .get(email);
  assert.strictEqual(reauthEmail, undefined, 're-auth via email session must fail until new OTP');

  console.log('TOUCH-099 EVIDENCE: PASS');
  db.close();
}

main();
