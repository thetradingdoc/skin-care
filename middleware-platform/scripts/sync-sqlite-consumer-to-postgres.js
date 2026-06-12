#!/usr/bin/env node
'use strict';

/**
 * One-way sync of consumer v3 SQLite tables to Postgres when DATA_STORE=postgres.
 * Usage: POSTGRES_URL=... DB_PATH=... node scripts/sync-sqlite-consumer-to-postgres.js
 */
const Database = require('better-sqlite3');
const path = require('path');
const { getPostgresSql, ensurePostgresConsumerTables, isPostgresEnabled } = require('../db/client');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'middleware.db');

async function main() {
  if (!isPostgresEnabled()) {
    console.error('POSTGRES_URL required');
    process.exit(1);
  }
  await ensurePostgresConsumerTables();
  const sql = getPostgresSql();
  const sqlite = new Database(dbPath, { readonly: true });

  const profiles = sqlite.prepare('SELECT * FROM patient_consumer_profiles').all();
  for (const row of profiles) {
    let modes = [];
    try {
      modes = JSON.parse(row.journey_modes_json || '[]');
    } catch {
      modes = [];
    }
    await sql`
      INSERT INTO patient_consumer_profiles (
        owner_key, patient_id, session_id, journey_modes, primary_mode,
        onboarding_complete, bio_calibration_complete, needs_first_photo, chosen_at, updated_at
      ) VALUES (
        ${row.owner_key}, ${row.patient_id}, ${row.session_id}, ${modes},
        ${row.primary_mode}, ${!!row.onboarding_complete}, ${!!row.bio_calibration_complete},
        ${!!row.needs_first_photo}, ${row.chosen_at}, NOW()
      )
      ON CONFLICT (owner_key) DO NOTHING
    `;
  }

  const spots = sqlite.prepare('SELECT * FROM patient_spots').all();
  for (const spot of spots) {
    await sql`
      INSERT INTO patient_spots (id, owner_key, label, body_region, created_at, archived_at)
      VALUES (${spot.id}, ${spot.owner_key}, ${spot.label}, ${spot.body_region}, ${spot.created_at}, ${spot.archived_at})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  const snaps = sqlite.prepare('SELECT * FROM patient_spot_snapshots').all();
  for (const snap of snaps) {
    let analysis = null;
    try {
      analysis = snap.analysis_json ? JSON.parse(snap.analysis_json) : null;
    } catch {
      analysis = null;
    }
    await sql`
      INSERT INTO patient_spot_snapshots (
        id, spot_id, captured_at, storage_ref, thumb_storage_ref, journal_entry_id, analysis_json
      ) VALUES (
        ${snap.id}, ${snap.spot_id}, ${snap.captured_at}, ${snap.storage_ref},
        ${snap.thumb_storage_ref}, ${snap.journal_entry_id}, ${analysis ? JSON.stringify(analysis) : null}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  sqlite.close();
  console.log(`✅ Synced ${profiles.length} profiles, ${spots.length} spots, ${snaps.length} snapshots`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
