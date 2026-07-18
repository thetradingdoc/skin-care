'use strict';

/**
 * TOUCH-114 — store device push tokens per patient/session.
 */

function ensureDeviceTable(sqliteDb) {
  sqliteDb
    .prepare(
      `CREATE TABLE IF NOT EXISTS patient_device_push_tokens (
        id TEXT PRIMARY KEY,
        patient_id TEXT,
        session_id TEXT,
        platform TEXT NOT NULL,
        token TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(token)
      )`,
    )
    .run();
}

function registerPatientDeviceRoutes(app, deps) {
  const { apiLimiter, express, db, requirePatientSession, resolvePatientIdFromSession } = deps;

  app.post(
    '/api/patient/devices/push-token',
    apiLimiter,
    requirePatientSession,
    express.json({ limit: '8kb' }),
    (req, res) => {
      try {
        const sqliteDb = db.db;
        ensureDeviceTable(sqliteDb);
        const token = String(req.body?.token || '').trim();
        const platform = String(req.body?.platform || 'ios').trim().toLowerCase();
        if (!token) return res.status(400).json({ success: false, error: 'token required' });
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        sqliteDb
          .prepare(
            `INSERT INTO patient_device_push_tokens (id, patient_id, session_id, platform, token, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
             ON CONFLICT(token) DO UPDATE SET
               patient_id = excluded.patient_id,
               session_id = excluded.session_id,
               platform = excluded.platform,
               updated_at = datetime('now')`,
          )
          .run(id, patientId || null, sessionId, platform, token);
        const row = sqliteDb
          .prepare(`SELECT id, patient_id, session_id, platform, token, updated_at FROM patient_device_push_tokens WHERE token = ?`)
          .get(token);
        return res.json({ success: true, device: row });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  /** TOUCH-115 — schedule intent for daily reminder (client also schedules locally). */
  app.post(
    '/api/patient/devices/push-reminder',
    apiLimiter,
    requirePatientSession,
    express.json({ limit: '4kb' }),
    (req, res) => {
      try {
        const sqliteDb = db.db;
        const { enqueuePush, ensureTables } = require('../services/patient-push-service');
        ensureTables(sqliteDb);
        const enabled = Boolean(req.body?.enabled);
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        if (enabled) {
          const id = enqueuePush(sqliteDb, {
            patientId,
            sessionId,
            kind: 'daily_reminder',
            title: 'touche',
            body: "Time for today's Check photo.",
            data: { route: '/capture', kind: 'daily_reminder' },
          });
          return res.json({ success: true, enabled: true, outbox_id: id });
        }
        return res.json({ success: true, enabled: false });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );
}

module.exports = { registerPatientDeviceRoutes, ensureDeviceTable };
