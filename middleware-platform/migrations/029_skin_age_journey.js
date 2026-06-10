'use strict';

/** Funnel journey persistence + skin age reading history. */

module.exports = {
  id: '029_skin_age_journey',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS funnel_journeys (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'active',
        linked_patient_id TEXT,
        linked_session_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS funnel_journey_events (
        id TEXT PRIMARY KEY,
        journey_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (journey_id) REFERENCES funnel_journeys(id)
      );

      CREATE INDEX IF NOT EXISTS idx_funnel_journey_events_journey
        ON funnel_journey_events(journey_id, created_at);

      CREATE TABLE IF NOT EXISTS skin_age_readings (
        id TEXT PRIMARY KEY,
        patient_id TEXT,
        session_id TEXT,
        journey_id TEXT,
        source TEXT NOT NULL,
        apparent_age_estimate REAL,
        model_id TEXT,
        model_version TEXT,
        media_id TEXT,
        payload_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_skin_age_readings_patient
        ON skin_age_readings(patient_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_skin_age_readings_session
        ON skin_age_readings(session_id, created_at);
    `);
  },
};
