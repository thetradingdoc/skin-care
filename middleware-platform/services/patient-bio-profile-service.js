'use strict';

const migration = require('../migrations/055_conflict_engine');

const VALID_CONDITIONS = new Set([
  'acne',
  'rosacea',
  'hyperpigmentation',
  'dark_marks',
  'eczema',
  'sensitive',
  'barrier_compromised',
  'inflamed',
  'dehydrated',
  'none',
]);

const VALID_PRESCRIPTIONS = new Set(['tretinoin', 'isotretinoin', 'adapalene', 'none']);

const CONCERN_TO_CONDITION = {
  acne: 'acne',
  rosacea: 'rosacea',
  hyperpigmentation: 'hyperpigmentation',
  hyperpigmentation_dark_skin: 'dark_marks',
  barrier_repair: 'barrier_compromised',
  anti_aging: 'none',
};

function ensureBioProfileTables(db) {
  if (migration?.up) migration.up(db);
  require('../migrations/062_bio_procedure_safe_mode').up(db);
  require('../migrations/064_bio_budget_climate').up(db);
}

function parseJsonArray(raw, fallback = []) {
  try {
    const v = JSON.parse(String(raw || '[]'));
    return Array.isArray(v) ? v : fallback;
  } catch (_) {
    return fallback;
  }
}

function normalizeConditions(list) {
  return [...new Set((Array.isArray(list) ? list : []).map((c) => String(c || '').trim().toLowerCase()).filter(Boolean))]
    .filter((c) => VALID_CONDITIONS.has(c) || c !== 'none');
}

function normalizePrescriptions(list) {
  return [...new Set((Array.isArray(list) ? list : []).map((p) => String(p || '').trim().toLowerCase()).filter(Boolean))]
    .filter((p) => VALID_PRESCRIPTIONS.has(p) && p !== 'none');
}

function isProfileComplete(profile) {
  if (!profile) return false;
  const conditions = profile.conditions || [];
  return conditions.length > 0 || profile.profile_complete === true;
}

function rowToProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    session_id: row.session_id,
    patient_id: row.patient_id || null,
    conditions: parseJsonArray(row.conditions_json),
    prescriptions: parseJsonArray(row.prescriptions_json),
    sensitivity: row.sensitivity || 'none',
    fitzpatrick: row.fitzpatrick || null,
    zip: row.zip || null,
    procedure_date: row.procedure_date || null,
    procedure_type: row.procedure_type || null,
    procedure_recovery_days:
      row.procedure_recovery_days != null ? Number(row.procedure_recovery_days) : null,
    budget_band: row.budget_band || null,
    climate_zone: row.climate_zone || null,
    profile_complete: Boolean(row.profile_complete),
    updated_at: row.updated_at,
  };
}

function getBioProfile(db, { sessionId, patientId }) {
  ensureBioProfileTables(db);
  let row = null;
  if (sessionId) {
    row = db.prepare(`SELECT * FROM patient_bio_profiles WHERE session_id = ? LIMIT 1`).get(sessionId);
  }
  if (!row && patientId) {
    row = db
      .prepare(`SELECT * FROM patient_bio_profiles WHERE patient_id = ? ORDER BY datetime(updated_at) DESC LIMIT 1`)
      .get(patientId);
  }
  const profile = rowToProfile(row);
  if (profile && !profile.profile_complete) {
    profile.profile_complete = isProfileComplete(profile);
  }
  return profile;
}

function upsertBioProfile(db, { sessionId, patientId, patch = {} }) {
  ensureBioProfileTables(db);
  const existing = getBioProfile(db, { sessionId, patientId });
  const conditions = patch.conditions != null ? normalizeConditions(patch.conditions) : existing?.conditions || [];
  const prescriptions =
    patch.prescriptions != null ? normalizePrescriptions(patch.prescriptions) : existing?.prescriptions || [];
  const sensitivity = patch.sensitivity != null ? String(patch.sensitivity || 'none') : existing?.sensitivity || 'none';
  const fitzpatrick = patch.fitzpatrick != null ? patch.fitzpatrick : existing?.fitzpatrick || null;
  const zip = patch.zip != null ? patch.zip : existing?.zip || null;
  const procedure_date =
    patch.procedure_date !== undefined
      ? patch.procedure_date
        ? String(patch.procedure_date).trim().slice(0, 10)
        : null
      : existing?.procedure_date || null;
  const procedure_type =
    patch.procedure_type !== undefined
      ? patch.procedure_type
        ? String(patch.procedure_type).trim().toLowerCase().slice(0, 40)
        : null
      : existing?.procedure_type || null;
  let procedure_recovery_days =
    patch.procedure_recovery_days !== undefined
      ? patch.procedure_recovery_days == null || patch.procedure_recovery_days === ''
        ? null
        : Number(patch.procedure_recovery_days)
      : existing?.procedure_recovery_days ?? null;
  if (procedure_recovery_days != null && (!Number.isFinite(procedure_recovery_days) || procedure_recovery_days < 1)) {
    procedure_recovery_days = null;
  }
  const budget_band =
    patch.budget_band !== undefined
      ? patch.budget_band
        ? String(patch.budget_band).trim().toLowerCase().slice(0, 32)
        : null
      : existing?.budget_band || null;
  const climate_zone =
    patch.climate_zone !== undefined
      ? patch.climate_zone
        ? String(patch.climate_zone).trim().toLowerCase().slice(0, 32)
        : null
      : existing?.climate_zone || null;
  const profileComplete =
    patch.profile_complete != null ? Boolean(patch.profile_complete) : conditions.length > 0;

  const id = existing?.id || `bio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  db.prepare(`
    INSERT INTO patient_bio_profiles (
      id, session_id, patient_id, conditions_json, prescriptions_json,
      sensitivity, fitzpatrick, zip, procedure_date, procedure_type, procedure_recovery_days,
      budget_band, climate_zone, profile_complete, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(session_id) DO UPDATE SET
      patient_id = COALESCE(excluded.patient_id, patient_bio_profiles.patient_id),
      conditions_json = excluded.conditions_json,
      prescriptions_json = excluded.prescriptions_json,
      sensitivity = excluded.sensitivity,
      fitzpatrick = excluded.fitzpatrick,
      zip = excluded.zip,
      procedure_date = excluded.procedure_date,
      procedure_type = excluded.procedure_type,
      procedure_recovery_days = excluded.procedure_recovery_days,
      budget_band = excluded.budget_band,
      climate_zone = excluded.climate_zone,
      profile_complete = excluded.profile_complete,
      updated_at = datetime('now')
  `).run(
    id,
    sessionId,
    patientId || null,
    JSON.stringify(conditions),
    JSON.stringify(prescriptions),
    sensitivity,
    fitzpatrick,
    zip,
    procedure_date,
    procedure_type,
    procedure_recovery_days,
    budget_band,
    climate_zone,
    profileComplete ? 1 : 0
  );

  return getBioProfile(db, { sessionId, patientId });
}

function hydrateBioProfileFromFunnel(db, { sessionId, patientId, funnelPayload = {} }) {
  const concernId = String(funnelPayload.concern_id || '').trim();
  const faceRead = funnelPayload.face_read && typeof funnelPayload.face_read === 'object' ? funnelPayload.face_read : null;
  const conditions = [];
  const mapped = CONCERN_TO_CONDITION[concernId];
  if (mapped && mapped !== 'none') conditions.push(mapped);
  if (Array.isArray(funnelPayload.secondary_concern_ids)) {
    for (const c of funnelPayload.secondary_concern_ids) {
      const m = CONCERN_TO_CONDITION[String(c || '').trim()];
      if (m && m !== 'none') conditions.push(m);
    }
  }
  const fitz =
    faceRead?.fitzpatrick_estimate != null
      ? String(faceRead.fitzpatrick_estimate)
      : faceRead?.fit_skin_tone != null
        ? String(faceRead.fit_skin_tone)
        : null;

  return upsertBioProfile(db, {
    sessionId,
    patientId,
    patch: {
      conditions,
      zip: funnelPayload.zip || null,
      fitzpatrick: fitz,
      profile_complete: conditions.length > 0,
    },
  });
}

function buildBioProfileContext(db, { sessionId, patientId }) {
  const profile = getBioProfile(db, { sessionId, patientId });
  if (!profile) {
    return {
      conditions: [],
      prescriptions: [],
      sensitivity: 'none',
      fitzpatrick: null,
      zip: null,
      procedure_date: null,
      procedure_type: null,
      procedure_recovery_days: null,
      profile_complete: false,
    };
  }
  return {
    conditions: profile.conditions.map((id) => ({ id, confidence: 'medium' })),
    prescriptions: profile.prescriptions,
    sensitivity: profile.sensitivity,
    fitzpatrick: profile.fitzpatrick,
    zip: profile.zip,
    procedure_date: profile.procedure_date,
    procedure_type: profile.procedure_type,
    procedure_recovery_days: profile.procedure_recovery_days,
    profile_complete: profile.profile_complete,
  };
}

module.exports = {
  ensureBioProfileTables,
  getBioProfile,
  upsertBioProfile,
  hydrateBioProfileFromFunnel,
  buildBioProfileContext,
  isProfileComplete,
  VALID_CONDITIONS,
  VALID_PRESCRIPTIONS,
};
