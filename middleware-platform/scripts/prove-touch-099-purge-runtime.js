'use strict';

/**
 * TOUCH-099 — Real runtime DB account purge proof (not :memory:).
 *
 * Usage: node scripts/prove-touch-099-purge-runtime.js
 */

const path = require('path');
const { v4: uuidv4 } = require('uuid');

process.chdir(path.join(__dirname, '..'));

const express = require('express');
const request = require('supertest');
const db = require('../database');
const PatientPortalService = require('../services/patient-portal-service');
const {
  requirePatientSession,
  resolvePatientIdFromSession,
  recordPatientPortalEvent,
} = require('../middleware/patient-session');
const { registerPatientAuthRoutes } = require('../routes/patient-auth');
const { upsertBioProfile } = require('../services/patient-bio-profile-service');
const { ensurePatientShelfInventoryColumns } = require('../lib/patient-shelf-api');
const { ensureAllergenTable } = require('../routes/patient-allergens');
const { ensurePurgeSupportTables } = require('../services/patient-account-purge-service');
const { ensureRoutineTables } = require('../lib/patient-routine-db');

const EMAIL = 'touch099.purge.runtime@trytouche.local';
const OTP = '424242';
const noop = (req, _res, next) => next();

function countFor(email, sessionId, patientId) {
  const sqlite = db.db;
  const q = (sql, params = []) => {
    try {
      return Number(sqlite.prepare(sql).get(...params)?.n || 0);
    } catch {
      return 0;
    }
  };
  return {
    patient_portal_sessions: q(
      `SELECT COUNT(*) AS n FROM patient_portal_sessions WHERE LOWER(email)=LOWER(?) OR id=?`,
      [email, sessionId],
    ),
    patient_sessions: q(
      `SELECT COUNT(*) AS n FROM patient_sessions WHERE LOWER(email)=LOWER(?) OR session_id=?`,
      [email, sessionId],
    ),
    patient_bio_profiles: q(
      `SELECT COUNT(*) AS n FROM patient_bio_profiles WHERE session_id=? OR patient_id=?`,
      [sessionId, patientId || ''],
    ),
    patient_allergen_exclusions: q(
      `SELECT COUNT(*) AS n FROM patient_allergen_exclusions WHERE session_id=? OR patient_id=?`,
      [sessionId, patientId || ''],
    ),
    patient_product_list_items: (() => {
      try {
        const lists = sqlite
          .prepare(
            `SELECT id FROM patient_product_lists WHERE owner_id IN (?, ?) OR owner_id=?`,
          )
          .all(sessionId, patientId || '', sessionId);
        if (!lists.length) return 0;
        let n = 0;
        for (const l of lists) {
          n += q(`SELECT COUNT(*) AS n FROM patient_product_list_items WHERE list_id=?`, [l.id]);
        }
        return n;
      } catch {
        return 0;
      }
    })(),
    patient_onboarding_step3_products: q(
      `SELECT COUNT(*) AS n FROM patient_onboarding_step3_products WHERE session_id=?`,
      [sessionId],
    ),
    patient_routine_daily_media: (() => {
      try {
        const entries = sqlite
          .prepare(
            `SELECT id FROM patient_routine_daily_entries WHERE session_id=? OR patient_id=?`,
          )
          .all(sessionId, patientId || '');
        let n = 0;
        for (const e of entries) {
          n += q(`SELECT COUNT(*) AS n FROM patient_routine_daily_media WHERE daily_entry_id=?`, [
            e.id,
          ]);
        }
        return n;
      } catch {
        return 0;
      }
    })(),
    shopify_order_dead_letters: q(
      `SELECT COUNT(*) AS n FROM shopify_order_dead_letters WHERE LOWER(email)=LOWER(?)`,
      [email],
    ),
    email_verification_codes: q(
      `SELECT COUNT(*) AS n FROM email_verification_codes WHERE LOWER(email)=LOWER(?)`,
      [email],
    ),
  };
}

function clearEmail(email) {
  const sqlite = db.db;
  const sessions = sqlite
    .prepare(`SELECT id FROM patient_portal_sessions WHERE LOWER(email)=LOWER(?)`)
    .all(email);
  for (const s of sessions) {
    try {
      sqlite.prepare(`DELETE FROM patient_sessions WHERE session_id=?`).run(s.id);
    } catch (_) {}
    try {
      sqlite.prepare(`DELETE FROM patient_bio_profiles WHERE session_id=?`).run(s.id);
    } catch (_) {}
    try {
      sqlite.prepare(`DELETE FROM patient_allergen_exclusions WHERE session_id=?`).run(s.id);
    } catch (_) {}
    try {
      sqlite.prepare(`DELETE FROM patient_onboarding_step3_products WHERE session_id=?`).run(s.id);
    } catch (_) {}
  }
  sqlite.prepare(`DELETE FROM patient_portal_sessions WHERE LOWER(email)=LOWER(?)`).run(email);
  try {
    sqlite.prepare(`DELETE FROM email_verification_codes WHERE LOWER(email)=LOWER(?)`).run(email);
  } catch (_) {}
  try {
    sqlite.prepare(`DELETE FROM shopify_order_dead_letters WHERE LOWER(email)=LOWER(?)`).run(email);
  } catch (_) {}
}

function createVerifiedSession(email) {
  clearEmail(email);
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  db.insertVerificationSession({
    sessionId,
    email,
    code: OTP,
    expiresAt,
    ip: '127.0.0.1',
    userAgent: 'touch-099-purge-prove',
  });
  const result = PatientPortalService.verifyCode(email, OTP);
  if (!result.success || !result.session_id) {
    throw new Error(`verify failed: ${result.error}`);
  }
  try {
    db.touchLastSeen(result.session_id);
  } catch (_) {}
  return {
    session_id: result.session_id,
    patient_id: result.patient_id || null,
    email,
  };
}

function seedAccount(sess) {
  const sqlite = db.db;
  ensureAllergenTable(sqlite);
  ensurePatientShelfInventoryColumns();
  ensurePurgeSupportTables(sqlite);
  ensureRoutineTables();

  upsertBioProfile(sqlite, {
    sessionId: sess.session_id,
    patientId: sess.patient_id,
    patch: { conditions: ['sensitive'], procedure_date: '2026-06-01', procedure_type: 'laser' },
  });

  sqlite
    .prepare(
      `INSERT INTO patient_allergen_exclusions (id, patient_id, session_id, allergen_class, label, created_at)
       VALUES (?, ?, ?, 'fragrance', 'fragrance', datetime('now'))`,
    )
    .run(`alg_099_${Date.now()}`, sess.patient_id, sess.session_id);

  // Shelf (step3 products — real shelf inventory table)
  const shelfId = `shelf_099_${Date.now()}`;
  sqlite
    .prepare(
      `INSERT INTO patient_onboarding_step3_products
       (id, session_id, patient_id, selection_mode, custom_product_name, category, usage_time, created_at, updated_at, ingredients_text)
       VALUES (?, ?, ?, 'custom', 'TOUCH-099 Purge Serum', 'treatment', 'pm', datetime('now'), datetime('now'), 'water, glycerin')`,
    )
    .run(shelfId, sess.session_id, sess.patient_id);

  // product list shelf (schema uses product_ref, not product_name)
  const listId = `list_099_${Date.now()}`;
  sqlite
    .prepare(
      `INSERT INTO patient_product_lists (id, owner_type, owner_id, list_type, list_name)
       VALUES (?, 'session', ?, 'shelf', 'My shelf')`,
    )
    .run(listId, sess.session_id);
  sqlite
    .prepare(
      `INSERT INTO patient_product_list_items (id, list_id, product_ref)
       VALUES (?, ?, ?)`,
    )
    .run(`item_099_${Date.now()}`, listId, 'TOUCH-099 Shelf Item');

  // media via routine daily entry
  try {
    const tmplId = `tmpl_099_${Date.now()}`;
    const entryId = `entry_099_${Date.now()}`;
    sqlite
      .prepare(
        `INSERT INTO patient_routine_templates (id, session_id, patient_id, name) VALUES (?, ?, ?, 'purge proof')`,
      )
      .run(tmplId, sess.session_id, sess.patient_id);
    sqlite
      .prepare(
        `INSERT INTO patient_routine_daily_entries (id, template_id, session_id, patient_id, entry_date)
         VALUES (?, ?, ?, ?, date('now'))`,
      )
      .run(entryId, tmplId, sess.session_id, sess.patient_id);
    sqlite
      .prepare(
        `INSERT INTO patient_routine_daily_media (id, daily_entry_id, media_url) VALUES (?, ?, ?)`,
      )
      .run(`media_099_${Date.now()}`, entryId, 'file:///tmp/touch099-proof.jpg');
  } catch (_) {}

  // dead letter
  try {
    sqlite
      .prepare(
        `INSERT INTO shopify_order_dead_letters (id, shopify_order_id, email, payload_json, reason)
         VALUES (?, ?, ?, '{}', 'email_unmatched')`,
      )
      .run(`dl_099_${Date.now()}`, `ord_099_${Date.now()}`, EMAIL);
  } catch (_) {}

  // leftover OTP row on email_verification_codes (required table in purge)
  sqlite
    .prepare(
      `INSERT INTO email_verification_codes (id, email, code, expires_at, created_at)
       VALUES (?, ?, ?, datetime('now', '+10 minutes'), datetime('now'))`,
    )
    .run(`otp_099_${Date.now()}`, EMAIL, '999999');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  registerPatientAuthRoutes(app, {
    botGuard: noop,
    authLimiter: noop,
    otpSendLimiter: noop,
    otpConfirmLimiter: noop,
    apiLimiter: noop,
    express,
    db,
    requirePatientSession,
    resolvePatientIdFromSession,
    recordPatientPortalEvent,
    PatientPortalService,
    issueCsrfCookie: () => 'csrf',
    getPatientStep3Status: () => ({ completed: true }),
    PatientIntakeService: null,
  });
  return app;
}

async function main() {
  const sess = createVerifiedSession(EMAIL);
  seedAccount(sess);

  const before = countFor(EMAIL, sess.session_id, sess.patient_id);
  const app = buildApp();

  const del = await request(app)
    .post('/api/patient/account/delete')
    .set('x-session-id', sess.session_id)
    .send({ confirm: true });

  const after = countFor(EMAIL, sess.session_id, sess.patient_id);

  const stale = await request(app)
    .post('/api/patient/account/delete')
    .set('x-session-id', sess.session_id)
    .send({ confirm: true });

  // also validateSession
  const validation = PatientPortalService.validateSession(sess.session_id);

  const zeros = Object.values(after).every((n) => n === 0);
  const hadData = Object.values(before).some((n) => n > 0);

  const report = {
    runtime_db: db.sqliteDatabasePath,
    session_id: sess.session_id,
    patient_id: sess.patient_id,
    email: EMAIL,
    before,
    after,
    delete_http: { status: del.status, body: del.body },
    stale_session_http: { status: stale.status, body: stale.body },
    validateSession_after: validation,
    pass:
      hadData &&
      zeros &&
      del.status === 200 &&
      del.body?.purged === true &&
      (stale.status === 401 || stale.status === 403 || validation.valid === false),
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exit(1);
  console.log('\nTOUCH-099: PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
