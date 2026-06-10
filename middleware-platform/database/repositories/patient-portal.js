'use strict';

/**
 * Patient portal session SQL — OTP, verification, session TTL.
 * Wired from database.js via createPatientPortalRepository(sqliteDb).
 */

function createPatientPortalRepository(db) {
  function findActiveUnverifiedSessionByEmail(email) {
    return db.prepare(`
      SELECT id FROM patient_portal_sessions
      WHERE email = ? AND verified = 0 AND datetime(expires_at) > datetime('now')
    `).get(email);
  }

  function updateVerificationSession({ id, code, expiresAt, ip, userAgent }) {
    db.prepare(`
      UPDATE patient_portal_sessions
      SET verification_code = ?, expires_at = ?, created_at = datetime('now'),
          ip_address = ?, user_agent = ?, failed_attempts = 0, locked_until = NULL
      WHERE id = ?
    `).run(code, expiresAt, ip || null, userAgent || null, id);
  }

  function insertVerificationSession({ sessionId, email, code, expiresAt, ip, userAgent }) {
    db.prepare(`
      INSERT INTO patient_portal_sessions
      (id, email, verification_code, expires_at, verified, ip_address, user_agent, failed_attempts, locked_until)
      VALUES (?, ?, ?, ?, 0, ?, ?, 0, NULL)
    `).run(sessionId, email, code, expiresAt, ip || null, userAgent || null);
  }

  function getLatestLockForEmail(email) {
    return db.prepare(`
      SELECT locked_until FROM patient_portal_sessions
      WHERE email = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(email);
  }

  function findLatestUnverifiedSessionByEmail(email) {
    return db.prepare(`
      SELECT * FROM patient_portal_sessions
      WHERE email = ?
        AND verified = 0
        AND datetime(expires_at) > datetime('now')
      ORDER BY created_at DESC
      LIMIT 1
    `).get(email);
  }

  function incrementFailedAttempts(sessionId, lockedUntil) {
    db.prepare(`
      UPDATE patient_portal_sessions
      SET failed_attempts = failed_attempts + 1,
          locked_until = COALESCE(?, locked_until)
      WHERE id = ?
    `).run(lockedUntil || null, sessionId);
  }

  function markSessionVerified(sessionId) {
    db.prepare(`
      UPDATE patient_portal_sessions
      SET verified = 1, verified_at = datetime('now')
      WHERE id = ?
    `).run(sessionId);
  }

  function setSessionPatientId(sessionId, patientId) {
    db.prepare(`
      UPDATE patient_portal_sessions
      SET patient_id = COALESCE(patient_id, ?)
      WHERE id = ?
    `).run(patientId, sessionId);
  }

  function getVerifiedSession(sessionId) {
    return db.prepare(`
      SELECT * FROM patient_portal_sessions
      WHERE id = ? AND verified = 1
    `).get(sessionId);
  }

  function clearExpiredEmergencyFlag(sessionId) {
    db.prepare(`
      UPDATE patient_portal_sessions
      SET emergency_flag = 0, emergency_flag_at = NULL
      WHERE id = ?
    `).run(sessionId);
  }

  function touchLastSeen(sessionId) {
    db.prepare(`
      UPDATE patient_portal_sessions
      SET last_seen_at = datetime('now')
      WHERE id = ?
    `).run(sessionId);
  }

  return {
    findActiveUnverifiedSessionByEmail,
    updateVerificationSession,
    insertVerificationSession,
    getLatestLockForEmail,
    findLatestUnverifiedSessionByEmail,
    incrementFailedAttempts,
    markSessionVerified,
    setSessionPatientId,
    getVerifiedSession,
    clearExpiredEmergencyFlag,
    touchLastSeen,
  };
}

module.exports = { createPatientPortalRepository };
