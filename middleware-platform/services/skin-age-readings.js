'use strict';

const crypto = require('crypto');

function ensureSkinAgeTables(db) {
  const migration = require('../migrations/029_skin_age_journey');
  if (migration?.up) migration.up(db);
}

function insertSkinAgeReading(db, row) {
  ensureSkinAgeTables(db);
  const id = row.id || `sar_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  db.prepare(`
    INSERT INTO skin_age_readings (
      id, patient_id, session_id, journey_id, source,
      apparent_age_estimate, model_id, model_version, media_id, payload_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    id,
    row.patient_id || null,
    row.session_id || null,
    row.journey_id || null,
    String(row.source || 'onboarding_scan'),
    Number.isFinite(Number(row.apparent_age_estimate)) ? Number(row.apparent_age_estimate) : null,
    row.model_id || null,
    row.model_version || null,
    row.media_id || null,
    row.payload_json ? JSON.stringify(row.payload_json) : null
  );
  return id;
}

function latestReadingForSession(db, sessionId, patientId) {
  ensureSkinAgeTables(db);
  if (!sessionId && !patientId) return null;
  if (patientId) {
    return (
      db
        .prepare(`
        SELECT apparent_age_estimate, model_id, created_at, source
        FROM skin_age_readings
        WHERE patient_id = ? OR session_id = ?
        ORDER BY datetime(created_at) DESC
        LIMIT 1
      `)
        .get(patientId, sessionId || '') || null
    );
  }
  return (
    db
      .prepare(`
      SELECT apparent_age_estimate, model_id, created_at, source
      FROM skin_age_readings
      WHERE session_id = ?
      ORDER BY datetime(created_at) DESC
      LIMIT 1
    `)
      .get(sessionId) || null
  );
}

function listReadingsForSession(db, sessionId, patientId, limit = 12) {
  ensureSkinAgeTables(db);
  const cap = Math.max(1, Math.min(Number(limit) || 12, 50));
  if (patientId) {
    return db
      .prepare(`
      SELECT apparent_age_estimate, model_id, created_at, source
      FROM skin_age_readings
      WHERE patient_id = ? OR session_id = ?
      ORDER BY datetime(created_at) ASC
      LIMIT ?
    `)
      .all(patientId, sessionId || '', cap);
  }
  if (!sessionId) return [];
  return db
    .prepare(`
    SELECT apparent_age_estimate, model_id, created_at, source
    FROM skin_age_readings
    WHERE session_id = ?
    ORDER BY datetime(created_at) ASC
    LIMIT ?
  `)
    .all(sessionId, cap);
}

module.exports = {
  ensureSkinAgeTables,
  insertSkinAgeReading,
  latestReadingForSession,
  listReadingsForSession,
};
