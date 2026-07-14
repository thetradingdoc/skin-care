'use strict';

/**
 * TOUCH-018 / TOUCH-053 — allergen exclusions CRUD for patient session.
 */

const { resolveAllergenClassId } = require('../lib/allergen-class-catalog');

function ensureAllergenTable(sqliteDb) {
  require('../migrations/061_patient_allergen_exclusions').up(sqliteDb);
}

function registerPatientAllergenRoutes(app, deps) {
  const { apiLimiter, express, db, requirePatientSession, resolvePatientIdFromSession } = deps;

  app.get('/api/patient/allergens', apiLimiter, requirePatientSession, (req, res) => {
    try {
      const sqliteDb = db.db;
      ensureAllergenTable(sqliteDb);
      const sessionId = req.patientSessionId;
      const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
      const rows = sqliteDb
        .prepare(
          `SELECT id, allergen_class, label, created_at FROM patient_allergen_exclusions
           WHERE session_id = ? OR (? IS NOT NULL AND patient_id = ?)
           ORDER BY datetime(created_at) ASC`,
        )
        .all(sessionId, patientId || null, patientId || null);
      return res.json({ success: true, allergens: rows });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post(
    '/api/patient/allergens',
    apiLimiter,
    requirePatientSession,
    express.json({ limit: '16kb' }),
    (req, res) => {
      try {
        const sqliteDb = db.db;
        ensureAllergenTable(sqliteDb);
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const items = Array.isArray(req.body?.allergens) ? req.body.allergens : [];
        const tx = sqliteDb.transaction(() => {
          sqliteDb
            .prepare(
              `DELETE FROM patient_allergen_exclusions WHERE session_id = ? OR (? IS NOT NULL AND patient_id = ?)`,
            )
            .run(sessionId, patientId || null, patientId || null);
          const ins = sqliteDb.prepare(
            `INSERT INTO patient_allergen_exclusions (id, patient_id, session_id, allergen_class, label, created_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          );
          for (const raw of items.slice(0, 40)) {
            const allergen_class = resolveAllergenClassId(
              raw.allergen_class || raw.class,
              raw.label,
            );
            if (!allergen_class) continue;
            const label = String(raw.label || allergen_class).trim().slice(0, 80);
            ins.run(
              `al_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              patientId || null,
              sessionId,
              allergen_class.slice(0, 64),
              label,
            );
          }
        });
        tx();
        const allergens = sqliteDb
          .prepare(
            `SELECT id, allergen_class, label, created_at FROM patient_allergen_exclusions WHERE session_id = ?`,
          )
          .all(sessionId);
        return res.json({ success: true, allergens });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );
}

module.exports = { registerPatientAllergenRoutes, ensureAllergenTable };
