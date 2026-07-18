'use strict';

/**
 * P5.07 — Physician share-link tokens (expiring, revocable, access-audited).
 *
 * Product decision (reusable TTL — intentional):
 * Links remain multi-use until expiry or revoke so a clinician can reopen the PDF
 * during a visit. Single-use would force patients to re-issue mid-appointment.
 * Mitigations: short default TTL, explicit revoke, access audit log.
 */

const crypto = require('crypto');
const { buildPhysicianPdf } = require('./physician-export-pdf');

const DEFAULT_TTL_SEC = Math.max(
  60,
  Number(process.env.PHYSICIAN_SHARE_TTL_SEC || process.env.PATIENT_RECORD_MEDIA_TTL_SEC || 3600),
);

function ensureShareTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS patient_physician_share_tokens (
      token TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      fact_count INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      revoked_at TEXT
    );
    CREATE TABLE IF NOT EXISTS patient_physician_share_access_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      accessed_at TEXT NOT NULL DEFAULT (datetime('now')),
      ip_address TEXT,
      user_agent TEXT,
      outcome TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_physician_share_access_token
      ON patient_physician_share_access_log(token, accessed_at);
  `);
}

function logShareAccess(db, { token, patientId, ip = null, userAgent = null, outcome }) {
  ensureShareTable(db);
  db.prepare(
    `INSERT INTO patient_physician_share_access_log
       (token, patient_id, ip_address, user_agent, outcome)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    String(token || ''),
    String(patientId || ''),
    ip != null ? String(ip).slice(0, 128) : null,
    userAgent != null ? String(userAgent).slice(0, 256) : null,
    String(outcome || 'ok').slice(0, 40),
  );
}

/**
 * Create expiring share token for a patient. Fail-loud without patientId.
 */
async function createPhysicianShareLink(db, { patientId, ttlSec = DEFAULT_TTL_SEC, baseUrl = '' } = {}) {
  if (!patientId) {
    const err = new Error('PATIENT_ID_REQUIRED');
    err.code = 'PATIENT_ID_REQUIRED';
    throw err;
  }
  const built = await buildPhysicianPdf(db, { patientId });
  if (!built.ok) {
    return { ok: false, error_code: built.error_code, error: built.error };
  }

  ensureShareTable(db);
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();
  db.prepare(
    `INSERT INTO patient_physician_share_tokens (token, patient_id, expires_at, fact_count)
     VALUES (?, ?, ?, ?)`,
  ).run(token, patientId, expiresAt, built.fact_count);

  const path = `/api/public/physician-share/${token}`;
  return {
    ok: true,
    token,
    expires_at: expiresAt,
    ttl_sec: ttlSec,
    url: baseUrl ? `${String(baseUrl).replace(/\/$/, '')}${path}` : path,
    fact_count: built.fact_count,
    permanent: false,
    reusable_until_expiry: true,
  };
}

/**
 * Revoke a share link before TTL. Owner-scoped.
 */
function revokePhysicianShare(db, { token, patientId } = {}) {
  if (!token) {
    const err = new Error('TOKEN_REQUIRED');
    err.code = 'TOKEN_REQUIRED';
    throw err;
  }
  if (!patientId) {
    const err = new Error('PATIENT_ID_REQUIRED');
    err.code = 'PATIENT_ID_REQUIRED';
    throw err;
  }
  ensureShareTable(db);
  const row = db
    .prepare(`SELECT * FROM patient_physician_share_tokens WHERE token = ? LIMIT 1`)
    .get(String(token).trim());
  if (!row || row.patient_id !== patientId) {
    const err = new Error('SHARE_NOT_FOUND');
    err.code = 'SHARE_NOT_FOUND';
    err.status = 404;
    throw err;
  }
  if (row.revoked_at) {
    return { ok: true, token: row.token, revoked_at: row.revoked_at, already_revoked: true };
  }
  const revokedAt = new Date().toISOString();
  db.prepare(
    `UPDATE patient_physician_share_tokens SET revoked_at = ? WHERE token = ? AND patient_id = ?`,
  ).run(revokedAt, row.token, patientId);
  return { ok: true, token: row.token, revoked_at: revokedAt, already_revoked: false };
}

function listPhysicianShares(db, { patientId, limit = 20 } = {}) {
  if (!patientId) {
    const err = new Error('PATIENT_ID_REQUIRED');
    err.code = 'PATIENT_ID_REQUIRED';
    throw err;
  }
  ensureShareTable(db);
  const rows = db
    .prepare(
      `SELECT token, expires_at, fact_count, created_at, revoked_at
       FROM patient_physician_share_tokens
       WHERE patient_id = ?
       ORDER BY datetime(created_at) DESC
       LIMIT ?`,
    )
    .all(patientId, Math.min(100, Math.max(1, limit)));
  return {
    success: true,
    shares: rows.map((r) => ({
      token: r.token,
      expires_at: r.expires_at,
      fact_count: r.fact_count,
      created_at: r.created_at,
      revoked_at: r.revoked_at,
      active: !r.revoked_at && Date.parse(r.expires_at) > Date.now(),
    })),
  };
}

/**
 * Resolve share token → PDF. Expired/revoked/wrong → fail loud (404/410).
 * Logs every access attempt (ok / revoked / expired / not_found).
 */
async function resolvePhysicianShare(db, { token, ip = null, userAgent = null } = {}) {
  if (!token) {
    const err = new Error('TOKEN_REQUIRED');
    err.code = 'TOKEN_REQUIRED';
    throw err;
  }
  ensureShareTable(db);
  const row = db
    .prepare(`SELECT * FROM patient_physician_share_tokens WHERE token = ? LIMIT 1`)
    .get(token);
  if (!row) {
    logShareAccess(db, {
      token,
      patientId: '',
      ip,
      userAgent,
      outcome: 'not_found',
    });
    const err = new Error('SHARE_NOT_FOUND');
    err.code = 'SHARE_NOT_FOUND';
    err.status = 404;
    throw err;
  }
  if (row.revoked_at) {
    logShareAccess(db, {
      token: row.token,
      patientId: row.patient_id,
      ip,
      userAgent,
      outcome: 'revoked',
    });
    const err = new Error('SHARE_REVOKED');
    err.code = 'SHARE_REVOKED';
    err.status = 410;
    throw err;
  }
  if (Date.parse(row.expires_at) <= Date.now()) {
    logShareAccess(db, {
      token: row.token,
      patientId: row.patient_id,
      ip,
      userAgent,
      outcome: 'expired',
    });
    const err = new Error('SHARE_EXPIRED');
    err.code = 'SHARE_EXPIRED';
    err.status = 410;
    throw err;
  }

  const built = await buildPhysicianPdf(db, { patientId: row.patient_id });
  if (!built.ok) {
    logShareAccess(db, {
      token: row.token,
      patientId: row.patient_id,
      ip,
      userAgent,
      outcome: 'build_failed',
    });
    const err = new Error(built.error_code || 'BUILD_FAILED');
    err.code = built.error_code || 'BUILD_FAILED';
    err.status = 500;
    throw err;
  }

  logShareAccess(db, {
    token: row.token,
    patientId: row.patient_id,
    ip,
    userAgent,
    outcome: 'ok',
  });

  return {
    ok: true,
    patient_id: row.patient_id,
    expires_at: row.expires_at,
    buffer: built.buffer,
    content_type: built.content_type,
    narrative: null,
    interpretation: null,
  };
}

module.exports = {
  createPhysicianShareLink,
  resolvePhysicianShare,
  revokePhysicianShare,
  listPhysicianShares,
  ensureShareTable,
  logShareAccess,
  DEFAULT_TTL_SEC,
};
