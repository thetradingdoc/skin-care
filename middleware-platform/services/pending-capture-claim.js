'use strict';

/**
 * P2.20–P2.26 — Pre-auth pending capture create / claim / purge.
 *
 * Facts live in patient_record_facts with patient_id NULL and session_id = anon_session_id.
 * Claim rebinds facts + merges AI meter usage onto the authenticated patient.
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { resolveOwnerKey, mergeOwnerUsage } = require('./ai-capture-meter');
const factsRepo = require('../repositories/patient-record-facts-repo');

const DEFAULT_TTL_HOURS = Math.max(1, Number(process.env.PENDING_CAPTURE_TTL_HOURS || 72));

function ensurePendingCapturesTable(db) {
  require('../migrations/069_pending_captures').up(db);
  require('../migrations/074_pending_captures_otp_bind').up(db);
  factsRepo.ensurePatientRecordFactsTable(db);
}

function mintToken() {
  return `cap_${crypto.randomBytes(24).toString('hex')}`;
}

function mintAnonSessionId() {
  return `anon_${uuidv4().replace(/-/g, '')}`;
}

function parseFactIds(row) {
  try {
    const arr = JSON.parse(row?.fact_ids_json || '[]');
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch (_) {
    return [];
  }
}

function getPendingByToken(db, captureToken) {
  if (!captureToken) return null;
  ensurePendingCapturesTable(db);
  return db
    .prepare(`SELECT * FROM pending_captures WHERE capture_token = ? LIMIT 1`)
    .get(String(captureToken).trim());
}

/**
 * Create a new pending capture bundle, or reuse an existing pending token.
 */
function createOrGetPending(db, { captureToken = null, ttlHours = DEFAULT_TTL_HOURS } = {}) {
  ensurePendingCapturesTable(db);

  if (captureToken) {
    const existing = getPendingByToken(db, captureToken);
    if (existing && existing.status === 'pending') {
      const exp = existing.expires_at ? new Date(existing.expires_at).getTime() : 0;
      if (exp > Date.now()) return existing;
    }
  }

  const id = `pc_${uuidv4()}`;
  const token = mintToken();
  const anonSessionId = mintAnonSessionId();
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();

  db.prepare(
    `INSERT INTO pending_captures (
      id, capture_token, anon_session_id, patient_id, fact_ids_json, status, expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, NULL, '[]', 'pending', ?, datetime('now'), datetime('now'))`,
  ).run(id, token, anonSessionId, expiresAt);

  return getPendingByToken(db, token);
}

function attachFactId(db, captureToken, factId) {
  const row = getPendingByToken(db, captureToken);
  if (!row || row.status !== 'pending') return null;
  const ids = parseFactIds(row);
  if (!ids.includes(factId)) ids.push(factId);
  db.prepare(
    `UPDATE pending_captures
     SET fact_ids_json = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(JSON.stringify(ids), row.id);
  return getPendingByToken(db, captureToken);
}

/**
 * Bind capture_token → OTP session_id at verify/send (once).
 * Rebind from a different session is rejected (first bind wins).
 */
function bindCaptureTokenToOtpSession(db, { captureToken, otpSessionId }) {
  ensurePendingCapturesTable(db);
  const token = captureToken ? String(captureToken).trim() : '';
  const sessionId = otpSessionId ? String(otpSessionId).trim() : '';
  if (!token || !sessionId) {
    return { ok: false, reason: 'missing_token_or_session' };
  }
  const row = getPendingByToken(db, token);
  if (!row) return { ok: false, reason: 'not_found' };
  if (row.status !== 'pending') return { ok: false, reason: `status_${row.status}` };
  const exp = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (exp && exp < Date.now()) {
    return { ok: false, reason: 'expired' };
  }
  if (row.bound_otp_session_id) {
    if (row.bound_otp_session_id === sessionId) {
      return { ok: true, reason: 'already_bound', bound_otp_session_id: sessionId };
    }
    return {
      ok: false,
      reason: 'already_bound_other_session',
      bound_otp_session_id: row.bound_otp_session_id,
    };
  }
  db.prepare(
    `UPDATE pending_captures
     SET bound_otp_session_id = ?, bound_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`,
  ).run(sessionId, row.id);
  return { ok: true, reason: 'bound', bound_otp_session_id: sessionId };
}

/**
 * P2.22 / P2.24 — Claim pending facts + merge meter onto patient.
 * Requires prior bindCaptureTokenToOtpSession; portalSessionId must match.
 */
function claimPendingCaptures(db, { captureToken, patientId, portalSessionId }) {
  ensurePendingCapturesTable(db);
  const token = captureToken ? String(captureToken).trim() : '';
  if (!token || !patientId) {
    return { claimed: false, reason: 'missing_token_or_patient', facts_claimed: 0 };
  }

  const row = getPendingByToken(db, token);
  if (!row) return { claimed: false, reason: 'not_found', facts_claimed: 0 };
  if (row.status === 'claimed') {
    if (row.patient_id && row.patient_id !== patientId) {
      return {
        claimed: false,
        reason: 'claimed_by_other',
        facts_claimed: 0,
        patient_id: row.patient_id,
      };
    }
    return {
      claimed: true,
      reason: 'already_claimed',
      facts_claimed: parseFactIds(row).length,
      capture_token: token,
      patient_id: row.patient_id,
    };
  }
  if (row.status !== 'pending') {
    return { claimed: false, reason: `status_${row.status}`, facts_claimed: 0 };
  }

  const exp = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (exp && exp < Date.now()) {
    db.prepare(
      `UPDATE pending_captures SET status = 'expired', updated_at = datetime('now') WHERE id = ?`,
    ).run(row.id);
    return { claimed: false, reason: 'expired', facts_claimed: 0 };
  }

  const bound = row.bound_otp_session_id ? String(row.bound_otp_session_id) : '';
  const portal = portalSessionId ? String(portalSessionId).trim() : '';
  if (!bound) {
    return { claimed: false, reason: 'otp_session_unbound', facts_claimed: 0 };
  }
  if (!portal || portal !== bound) {
    return { claimed: false, reason: 'otp_session_mismatch', facts_claimed: 0 };
  }

  const fromOwner = resolveOwnerKey({ sessionId: row.anon_session_id });
  const toOwner = resolveOwnerKey({ patientId });
  const factIds = parseFactIds(row);

  const rebound = factsRepo.claimFactsToPatient(db, {
    factIds,
    anonSessionId: row.anon_session_id,
    patientId,
    portalSessionId: portalSessionId || null,
  });

  let meterMerge = null;
  try {
    meterMerge = mergeOwnerUsage(db, {
      fromOwnerKey: fromOwner,
      toOwnerKey: toOwner,
      patientId,
      sessionId: portalSessionId || null,
    });
  } catch (e) {
    console.warn('[pending-capture] meter merge failed:', e.message);
    meterMerge = { ok: false, error: e.message };
  }

  db.prepare(
    `UPDATE pending_captures SET
      patient_id = ?,
      claimed_session_id = ?,
      status = 'claimed',
      claimed_at = datetime('now'),
      updated_at = datetime('now')
     WHERE id = ?`,
  ).run(patientId, portalSessionId || null, row.id);

  return {
    claimed: true,
    reason: 'ok',
    facts_claimed: rebound,
    capture_token: token,
    patient_id: patientId,
    meter_merge: meterMerge,
  };
}

/**
 * P2.26 — Expire + purge unclaimed pending captures and their session-owned facts.
 */
function purgeExpiredPendingCaptures(db, { nowIso = null } = {}) {
  ensurePendingCapturesTable(db);
  const now = nowIso || new Date().toISOString();

  const expired = db
    .prepare(
      `SELECT * FROM pending_captures
       WHERE status = 'pending' AND datetime(expires_at) <= datetime(?)`,
    )
    .all(now);

  let factsDeleted = 0;
  for (const row of expired) {
    const factIds = parseFactIds(row);
    for (const fid of factIds) {
      const del = db.prepare(`DELETE FROM patient_record_facts WHERE id = ? AND patient_id IS NULL`).run(fid);
      factsDeleted += del.changes || 0;
    }
    // Also clear any leftover anon-session facts not listed
    const extra = db
      .prepare(
        `DELETE FROM patient_record_facts
         WHERE session_id = ? AND patient_id IS NULL AND owner_key = ?`,
      )
      .run(row.anon_session_id, `session:${row.anon_session_id}`);
    factsDeleted += extra.changes || 0;

    db.prepare(
      `UPDATE pending_captures
       SET status = 'purged', updated_at = datetime('now')
       WHERE id = ?`,
    ).run(row.id);
  }

  return { purged_bundles: expired.length, facts_deleted: factsDeleted };
}

module.exports = {
  ensurePendingCapturesTable,
  createOrGetPending,
  getPendingByToken,
  attachFactId,
  bindCaptureTokenToOtpSession,
  claimPendingCaptures,
  purgeExpiredPendingCaptures,
  DEFAULT_TTL_HOURS,
};
