'use strict';

const {
  getDataStoreMode,
  getPostgresSql,
  ensurePostgresConsumerTables,
  ensureSqliteConsumerTables,
  resolveOwnerKey,
} = require('../db/client');

const VALID_MODES = new Set(['watch', 'routine', 'spot', 'journal']);

function normalizeModes(modes) {
  if (!Array.isArray(modes)) return [];
  return [
    ...new Set(
      modes
        .map((m) => {
          const s = String(m).trim();
          if (s === 'journal') return 'watch';
          return s;
        })
        .filter((m) => m === 'watch' || m === 'routine' || m === 'spot'),
    ),
  ];
}

function rowToProfile(row) {
  if (!row) return null;
  let modes = [];
  if (Array.isArray(row.journey_modes)) {
    modes = normalizeModes(row.journey_modes);
  } else if (row.journey_modes_json) {
    try {
      modes = normalizeModes(JSON.parse(row.journey_modes_json));
    } catch {
      modes = [];
    }
  }
  return {
    owner_key: row.owner_key,
    patient_id: row.patient_id || null,
    session_id: row.session_id || null,
    journey_modes: modes,
    primary_mode: row.primary_mode || modes[0] || null,
    onboarding_complete: Boolean(row.onboarding_complete),
    bio_calibration_complete: Boolean(row.bio_calibration_complete),
    needs_first_photo: Boolean(row.needs_first_photo),
    chosen_at: row.chosen_at || null,
    updated_at: row.updated_at || null,
  };
}

function toApiProfile(profile) {
  if (!profile) {
    return {
      journey_modes: [],
      primary_mode: null,
      onboarding_complete: false,
      bio_calibration_complete: false,
      needs_first_photo: false,
      chosen_at: null,
    };
  }
  return {
    journey_modes: profile.journey_modes,
    primary: profile.primary_mode,
    primary_mode: profile.primary_mode,
    modes: profile.journey_modes,
    onboarding_complete: profile.onboarding_complete,
    bio_calibration_complete: profile.bio_calibration_complete,
    needs_first_photo: profile.needs_first_photo,
    chosen_at: profile.chosen_at,
    chosenAt: profile.chosen_at,
  };
}

async function getConsumerProfile(sqliteDb, { patientId, sessionId }) {
  const ownerKey = resolveOwnerKey({ patientId, sessionId });
  if (!ownerKey) return null;

  if (getDataStoreMode() === 'postgres') {
    await ensurePostgresConsumerTables();
    const sql = getPostgresSql();
    const rows = await sql`
      SELECT * FROM patient_consumer_profiles WHERE owner_key = ${ownerKey} LIMIT 1
    `;
    return rowToProfile(rows[0]);
  }

  ensureSqliteConsumerTables(sqliteDb);
  const row = sqliteDb
    .prepare(`SELECT * FROM patient_consumer_profiles WHERE owner_key = ? LIMIT 1`)
    .get(ownerKey);
  return rowToProfile(row);
}

async function upsertConsumerProfile(sqliteDb, { patientId, sessionId, patch = {} }) {
  const ownerKey = resolveOwnerKey({ patientId, sessionId });
  if (!ownerKey) throw new Error('owner_key_required');

  const existing = await getConsumerProfile(sqliteDb, { patientId, sessionId });
  const modes = patch.journey_modes != null ? normalizeModes(patch.journey_modes) : existing?.journey_modes || [];
  const primaryMode =
    patch.primary_mode != null
      ? String(patch.primary_mode).trim()
      : patch.primary != null
        ? String(patch.primary).trim()
        : existing?.primary_mode || modes[0] || null;
  const safePrimary = VALID_MODES.has(primaryMode) ? primaryMode : modes[0] || null;

  const next = {
    journey_modes: modes,
    primary_mode: safePrimary,
    onboarding_complete:
      patch.onboarding_complete != null ? Boolean(patch.onboarding_complete) : Boolean(existing?.onboarding_complete),
    bio_calibration_complete:
      patch.bio_calibration_complete != null
        ? Boolean(patch.bio_calibration_complete)
        : Boolean(existing?.bio_calibration_complete),
    needs_first_photo:
      patch.needs_first_photo != null ? Boolean(patch.needs_first_photo) : Boolean(existing?.needs_first_photo),
    chosen_at: patch.chosen_at || existing?.chosen_at || new Date().toISOString(),
  };

  if (getDataStoreMode() === 'postgres') {
    await ensurePostgresConsumerTables();
    const sql = getPostgresSql();
    await sql`
      INSERT INTO patient_consumer_profiles (
        owner_key, patient_id, session_id, journey_modes, primary_mode,
        onboarding_complete, bio_calibration_complete, needs_first_photo, chosen_at, updated_at
      ) VALUES (
        ${ownerKey}, ${patientId || null}, ${sessionId || null}, ${next.journey_modes},
        ${next.primary_mode}, ${next.onboarding_complete}, ${next.bio_calibration_complete},
        ${next.needs_first_photo}, ${next.chosen_at}, NOW()
      )
      ON CONFLICT (owner_key) DO UPDATE SET
        patient_id = COALESCE(EXCLUDED.patient_id, patient_consumer_profiles.patient_id),
        session_id = COALESCE(EXCLUDED.session_id, patient_consumer_profiles.session_id),
        journey_modes = EXCLUDED.journey_modes,
        primary_mode = EXCLUDED.primary_mode,
        onboarding_complete = EXCLUDED.onboarding_complete,
        bio_calibration_complete = EXCLUDED.bio_calibration_complete,
        needs_first_photo = EXCLUDED.needs_first_photo,
        chosen_at = COALESCE(patient_consumer_profiles.chosen_at, EXCLUDED.chosen_at),
        updated_at = NOW()
    `;
    return getConsumerProfile(sqliteDb, { patientId, sessionId });
  }

  ensureSqliteConsumerTables(sqliteDb);
  sqliteDb
    .prepare(
      `INSERT INTO patient_consumer_profiles (
        owner_key, patient_id, session_id, journey_modes_json, primary_mode,
        onboarding_complete, bio_calibration_complete, needs_first_photo, chosen_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(owner_key) DO UPDATE SET
        patient_id = COALESCE(excluded.patient_id, patient_id),
        session_id = COALESCE(excluded.session_id, session_id),
        journey_modes_json = excluded.journey_modes_json,
        primary_mode = excluded.primary_mode,
        onboarding_complete = excluded.onboarding_complete,
        bio_calibration_complete = excluded.bio_calibration_complete,
        needs_first_photo = excluded.needs_first_photo,
        chosen_at = COALESCE(patient_consumer_profiles.chosen_at, excluded.chosen_at),
        updated_at = datetime('now')`,
    )
    .run(
      ownerKey,
      patientId || null,
      sessionId || null,
      JSON.stringify(next.journey_modes),
      next.primary_mode,
      next.onboarding_complete ? 1 : 0,
      next.bio_calibration_complete ? 1 : 0,
      next.needs_first_photo ? 1 : 0,
      next.chosen_at,
    );

  return getConsumerProfile(sqliteDb, { patientId, sessionId });
}

module.exports = {
  getConsumerProfile,
  upsertConsumerProfile,
  toApiProfile,
  normalizeModes,
};
