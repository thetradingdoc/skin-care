#!/usr/bin/env node
'use strict';

/**
 * Seed Phase 3 acceptance sessions against the REAL runtime DB opened by database.js.
 *
 * Auth path: insertVerificationSession → PatientPortalService.verifyCode (same path as OTP confirm).
 * Does not hand-fabricate a bypass token.
 *
 * Usage (from middleware-platform/):
 *   node scripts/seed-phase3-acceptance-session.js
 *
 * Idempotent: revokes prior portal sessions for the seed emails and clears prior seed shelf/allergens/bio.
 */

const path = require('path');
const { v4: uuidv4 } = require('uuid');

process.chdir(path.join(__dirname, '..'));

const db = require('../database');
const PatientPortalService = require('../services/patient-portal-service');
const { upsertBioProfile } = require('../services/patient-bio-profile-service');
const { ensurePatientShelfInventoryColumns } = require('../lib/patient-shelf-api');
const { ensureRoutineTables } = require('../lib/patient-routine-db');
const { ensureAllergenTable } = require('../routes/patient-allergens');

const ALERT_EMAIL = 'phase3.accept.alert@trytouche.local';
const ZERO_EMAIL = 'phase3.accept.zero@trytouche.local';
const SHELF_PRODUCT_ID = 'shelf_phase3_accept_acrylate';
const SHELF_RETINOL_ID = 'shelf_phase3_accept_retinol';
const SHELF_EXPIRY_ID = 'shelf_phase3_accept_expiry';
const OTP = '424242';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIso(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function clearEmailOwnership(email) {
  const sqlite = db.db;
  const sessions = sqlite
    .prepare(
      `SELECT id FROM patient_portal_sessions WHERE LOWER(email) = LOWER(?)`,
    )
    .all(email);
  for (const s of sessions) {
    sqlite
      .prepare(
        `UPDATE patient_portal_sessions SET revoked_at = datetime('now') WHERE id = ?`,
      )
      .run(s.id);
    try {
      sqlite.prepare(`DELETE FROM patient_sessions WHERE session_id = ?`).run(s.id);
    } catch (_) {}
    try {
      sqlite
        .prepare(`DELETE FROM patient_onboarding_step3_products WHERE session_id = ?`)
        .run(s.id);
    } catch (_) {}
    try {
      sqlite.prepare(`DELETE FROM patient_allergen_exclusions WHERE session_id = ?`).run(s.id);
    } catch (_) {}
    try {
      sqlite.prepare(`DELETE FROM patient_bio_profiles WHERE session_id = ?`).run(s.id);
    } catch (_) {}
  }
  sqlite
    .prepare(`DELETE FROM patient_portal_sessions WHERE LOWER(email) = LOWER(?) AND verified = 0`)
    .run(email);
}

function createVerifiedSession(email) {
  clearEmailOwnership(email);
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  db.insertVerificationSession({
    sessionId,
    email,
    code: OTP,
    expiresAt,
    ip: '127.0.0.1',
    userAgent: 'phase3-acceptance-seed',
  });
  const result = PatientPortalService.verifyCode(email, OTP);
  if (!result.success || !result.session_id) {
    throw new Error(`verifyCode failed for ${email}: ${result.error || 'unknown'}`);
  }
  // Keep inactivity TTL green for subsequent HTTP proofs.
  try {
    db.touchLastSeen(result.session_id);
  } catch (_) {}
  const validation = PatientPortalService.validateSession(result.session_id);
  if (!validation.valid) {
    throw new Error(`validateSession failed for ${email}: ${validation.error}`);
  }
  return {
    session_id: result.session_id,
    patient_id: result.patient_id || validation.patient_id || null,
    email: result.email || email,
  };
}

function seedAlertBearing(sess) {
  const sqlite = db.db;
  ensureAllergenTable(sqlite);
  ensurePatientShelfInventoryColumns();

  sqlite
    .prepare(`DELETE FROM patient_allergen_exclusions WHERE session_id = ?`)
    .run(sess.session_id);
  sqlite
    .prepare(
      `INSERT INTO patient_allergen_exclusions (id, patient_id, session_id, allergen_class, label, created_at)
       VALUES (?, ?, ?, 'acrylates', 'acrylates', datetime('now'))`,
    )
    .run(`al_phase3_${Date.now()}`, sess.patient_id, sess.session_id);

  sqlite
    .prepare(`DELETE FROM patient_onboarding_step3_products WHERE id IN (?, ?, ?) OR session_id = ?`)
    .run(SHELF_PRODUCT_ID, SHELF_RETINOL_ID, SHELF_EXPIRY_ID, sess.session_id);
  sqlite
    .prepare(
      `INSERT INTO patient_onboarding_step3_products (
        id, session_id, patient_id, selection_mode, custom_product_name, category, usage_time, goal,
        ingredients_text, key_ingredients, ingredient_canonical_ids_json,
        cost_per_use, expiry_date, inventory_status, verdict_status, kept_despite_conflict
      ) VALUES (?, ?, ?, 'custom', ?, 'treatment', 'pm', 'conflict_track',
        ?, ?, ?,
        NULL, NULL, 'stock', 'unknown', 0)`,
    )
    .run(
      SHELF_PRODUCT_ID,
      sess.session_id,
      sess.patient_id,
      'Phase3 Acrylate Nail Primer',
      'ethylhexyl acrylate, glycerin, water',
      'ethylhexyl acrylate',
      JSON.stringify(['ethylhexyl acrylate', 'glycerin']),
    );

  // Active for TOUCH-100 safe-mode suppress (retinol is an isActiveStep match).
  sqlite
    .prepare(
      `INSERT INTO patient_onboarding_step3_products (
        id, session_id, patient_id, selection_mode, custom_product_name, category, usage_time, goal,
        ingredients_text, key_ingredients, ingredient_canonical_ids_json,
        inventory_status, verdict_status, kept_despite_conflict
      ) VALUES (?, ?, ?, 'custom', ?, 'treatment', 'pm', 'conflict_track',
        ?, ?, ?, 'stock', 'unknown', 0)`,
    )
    .run(
      SHELF_RETINOL_ID,
      sess.session_id,
      sess.patient_id,
      'Phase3 Retinol Serum',
      'retinol, squalane',
      'retinol',
      JSON.stringify(['retinol', 'squalane']),
    );

  // Near-expiry caution for TOUCH-067 hard_no vs caution distinction in alerts payload.
  sqlite
    .prepare(
      `INSERT INTO patient_onboarding_step3_products (
        id, session_id, patient_id, selection_mode, custom_product_name, category, usage_time, goal,
        ingredients_text, inventory_status, verdict_status, kept_despite_conflict, expiry_date
      ) VALUES (?, ?, ?, 'custom', ?, 'moisturizer', 'am', 'conflict_track',
        ?, 'stock', 'unknown', 0, ?)`,
    )
    .run(
      SHELF_EXPIRY_ID,
      sess.session_id,
      sess.patient_id,
      'Phase3 Expiring Moisturizer',
      'glycerin, water',
      plusDaysIso(14),
    );

  upsertBioProfile(sqlite, {
    sessionId: sess.session_id,
    patientId: sess.patient_id,
    patch: {
      conditions: ['sensitive'],
      procedure_date: todayIso(),
      procedure_type: 'laser',
      profile_complete: true,
    },
  });

  return {
    acrylate_product_id: SHELF_PRODUCT_ID,
    retinol_product_id: SHELF_RETINOL_ID,
    expiry_product_id: SHELF_EXPIRY_ID,
  };
}

function seedZeroAlert(sess) {
  const sqlite = db.db;
  ensureAllergenTable(sqlite);
  ensurePatientShelfInventoryColumns();
  sqlite
    .prepare(`DELETE FROM patient_allergen_exclusions WHERE session_id = ?`)
    .run(sess.session_id);
  sqlite
    .prepare(`DELETE FROM patient_onboarding_step3_products WHERE session_id = ?`)
    .run(sess.session_id);
  upsertBioProfile(sqlite, {
    sessionId: sess.session_id,
    patientId: sess.patient_id,
    patch: {
      conditions: ['sensitive'],
      procedure_date: '2020-01-01',
      procedure_type: 'laser',
      profile_complete: true,
    },
  });
}

function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Phase 3 acceptance seed');
  console.log('Runtime DB:', db.sqliteDatabasePath);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  ensureRoutineTables();

  const alert = createVerifiedSession(ALERT_EMAIL);
  const products = seedAlertBearing(alert);
  const zero = createVerifiedSession(ZERO_EMAIL);
  seedZeroAlert(zero);

  const out = {
    runtime_db: db.sqliteDatabasePath,
    alert_bearing: {
      email: alert.email,
      session_id: alert.session_id,
      patient_id: alert.patient_id,
      shelf_product_id: products.acrylate_product_id,
      retinol_product_id: products.retinol_product_id,
      expiry_product_id: products.expiry_product_id,
      allergens: ['acrylates'],
      procedure_date: todayIso(),
      procedure_type: 'laser',
      header: { 'x-session-id': alert.session_id },
    },
    zero_alert: {
      email: zero.email,
      session_id: zero.session_id,
      patient_id: zero.patient_id,
      header: { 'x-session-id': zero.session_id },
    },
  };

  console.log(JSON.stringify(out, null, 2));
  console.log('\n✅ Seed complete. Use x-session-id header values above for HTTP proofs.');
}

main();
