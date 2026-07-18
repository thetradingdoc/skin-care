'use strict';

const { v4: uuidv4 } = require('uuid');
const { resolveOwnerKey } = require('../services/ai-capture-meter');
const {
  encryptStructuredJson,
  decryptStructuredJson,
  encryptRawExtractText,
  decryptRawExtractText,
  extractEntryDate,
  extractDenormQueryables,
  isEncryptedFactField,
} = require('../services/patient-record-field-crypto');

function ensurePatientRecordFactsTable(db) {
  require('../migrations/067_patient_record_facts').up(db);
  require('../migrations/068_patient_record_facts_owner_request_id').up(db);
  require('../migrations/072_patient_record_facts_entry_date').up(db);
  require('../migrations/073_bill_amount_cents_canonical').up(db);
  require('../migrations/075_patient_record_facts_denorm_queryables').up(db);
  require('../migrations/076_patient_record_facts_denorm_backfill').up(db);
}

function serializeStructuredForStorage(structured) {
  return encryptStructuredJson(structured);
}

function insertFact(db, row) {
  ensurePatientRecordFactsTable(db);
  const id = row.id || `prf_${uuidv4()}`;
  const ownerKey =
    row.owner_key ||
    resolveOwnerKey({ patientId: row.patient_id, sessionId: row.session_id });
  const structuredPlain =
    typeof row.structured_json === 'string'
      ? row.structured_json
      : JSON.stringify(row.structured_json || {});
  let structuredObj = {};
  try {
    structuredObj =
      typeof row.structured_json === 'object' && row.structured_json
        ? row.structured_json
        : JSON.parse(structuredPlain || '{}');
  } catch (_) {
    structuredObj = {};
  }
  const entryDate = extractEntryDate(structuredObj);
  const denorm = extractDenormQueryables(structuredObj, row.tag);
  const structuredCipher = serializeStructuredForStorage(structuredObj);
  const rawCipher = encryptRawExtractText(row.raw_extract_text || null);

  db.prepare(
    `INSERT INTO patient_record_facts (
      id, patient_id, session_id, owner_key, tag, media_type, ai_or_manual,
      storage_ref, storage_provider, storage_key,
      structured_json, raw_extract_text, source_language, display_language,
      compare_group_id, request_id, confirmed_at, entry_date,
      fact_subtype, expiry_date, provider, issue_date, denorm_backfilled_at,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, datetime('now'),
      datetime('now'), datetime('now')
    )`,
  ).run(
    id,
    row.patient_id || null,
    row.session_id || null,
    ownerKey || null,
    row.tag,
    row.media_type || null,
    row.ai_or_manual,
    row.storage_ref || null,
    row.storage_provider || null,
    row.storage_key || null,
    structuredCipher,
    rawCipher,
    row.source_language || null,
    row.display_language || null,
    row.compare_group_id || null,
    row.request_id || null,
    row.confirmed_at || null,
    entryDate,
    denorm.fact_subtype,
    denorm.expiry_date,
    denorm.provider,
    denorm.issue_date,
  );
  return getFactById(db, id);
}

function upsertFactByRequestId(db, row) {
  ensurePatientRecordFactsTable(db);
  const ownerKey =
    row.owner_key ||
    resolveOwnerKey({ patientId: row.patient_id, sessionId: row.session_id });
  if (!row.request_id || !ownerKey) return insertFact(db, { ...row, owner_key: ownerKey });

  const existing = getFactByRequestId(db, { ownerKey, requestId: row.request_id });
  if (!existing) return insertFact(db, { ...row, owner_key: ownerKey });

  const structuredObj =
    row.structured_json != null
      ? typeof row.structured_json === 'string'
        ? (() => {
            try {
              return JSON.parse(row.structured_json);
            } catch (_) {
              return existing.structured_json || {};
            }
          })()
        : row.structured_json
      : existing.structured_json || {};
  const entryDate = extractEntryDate(structuredObj);
  const denorm = extractDenormQueryables(structuredObj, existing.tag || row.tag);
  const structuredCipher = serializeStructuredForStorage(structuredObj);
  const rawCipher =
    row.raw_extract_text !== undefined
      ? encryptRawExtractText(row.raw_extract_text)
      : undefined;

  db.prepare(
    `UPDATE patient_record_facts SET
      structured_json = ?,
      entry_date = ?,
      fact_subtype = ?,
      expiry_date = ?,
      provider = ?,
      issue_date = ?,
      denorm_backfilled_at = COALESCE(denorm_backfilled_at, datetime('now')),
      media_type = COALESCE(?, media_type),
      storage_ref = COALESCE(?, storage_ref),
      storage_provider = COALESCE(?, storage_provider),
      storage_key = COALESCE(?, storage_key),
      compare_group_id = COALESCE(?, compare_group_id),
      source_language = COALESCE(?, source_language),
      display_language = COALESCE(?, display_language),
      raw_extract_text = COALESCE(?, raw_extract_text),
      confirmed_at = COALESCE(?, confirmed_at),
      updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    structuredCipher,
    entryDate,
    denorm.fact_subtype,
    denorm.expiry_date,
    denorm.provider,
    denorm.issue_date,
    row.media_type || null,
    row.storage_ref || null,
    row.storage_provider || null,
    row.storage_key || null,
    row.compare_group_id || null,
    row.source_language || null,
    row.display_language || null,
    rawCipher !== undefined ? rawCipher : null,
    row.confirmed_at || null,
    existing.id,
  );
  return getFactById(db, existing.id);
}

function getFactById(db, id) {
  ensurePatientRecordFactsTable(db);
  const row = db.prepare(`SELECT * FROM patient_record_facts WHERE id = ? LIMIT 1`).get(id);
  return row ? mapRow(row) : null;
}

/** Owner-scoped request_id lookup (P2.28). */
function getFactByRequestId(db, { ownerKey, requestId, patientId, sessionId } = {}) {
  if (!requestId) return null;
  ensurePatientRecordFactsTable(db);
  const key = ownerKey || resolveOwnerKey({ patientId, sessionId });
  if (!key) return null;
  const row = db
    .prepare(
      `SELECT * FROM patient_record_facts
       WHERE owner_key = ? AND request_id = ? LIMIT 1`,
    )
    .get(key, String(requestId));
  return row ? mapRow(row) : null;
}

function updateFactConfirm(db, { id, patientId, sessionId, patch }) {
  ensurePatientRecordFactsTable(db);
  const fact = getFactById(db, id);
  if (!fact) return null;
  const ownerKey = resolveOwnerKey({ patientId, sessionId });
  if (fact.owner_key && ownerKey && fact.owner_key !== ownerKey) {
    const owns =
      (patientId && fact.patient_id === patientId) ||
      (sessionId && fact.session_id === sessionId);
    if (!owns) return null;
  }

  const structuredObj =
    patch.structured_json != null
      ? typeof patch.structured_json === 'string'
        ? (() => {
            try {
              return JSON.parse(patch.structured_json);
            } catch (_) {
              return fact.structured_json || {};
            }
          })()
        : patch.structured_json
      : fact.structured_json || {};
  const entryDate = extractEntryDate(structuredObj);
  const denorm = extractDenormQueryables(structuredObj, fact.tag);
  const structuredCipher = serializeStructuredForStorage(structuredObj);
  const rawCipher =
    patch.raw_extract_text !== undefined
      ? encryptRawExtractText(patch.raw_extract_text)
      : undefined;

  db.prepare(
    `UPDATE patient_record_facts SET
      structured_json = ?,
      entry_date = ?,
      fact_subtype = ?,
      expiry_date = ?,
      provider = ?,
      issue_date = ?,
      denorm_backfilled_at = COALESCE(denorm_backfilled_at, datetime('now')),
      source_language = COALESCE(?, source_language),
      display_language = COALESCE(?, display_language),
      compare_group_id = COALESCE(?, compare_group_id),
      raw_extract_text = COALESCE(?, raw_extract_text),
      confirmed_at = COALESCE(?, confirmed_at, datetime('now')),
      updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    structuredCipher,
    entryDate,
    denorm.fact_subtype,
    denorm.expiry_date,
    denorm.provider,
    denorm.issue_date,
    patch.source_language != null ? patch.source_language : null,
    patch.display_language != null ? patch.display_language : null,
    patch.compare_group_id != null ? patch.compare_group_id : null,
    rawCipher !== undefined ? rawCipher : null,
    patch.confirmed_at != null ? patch.confirmed_at : new Date().toISOString(),
    id,
  );
  return getFactById(db, id);
}

function listFacts(db, { patientId, sessionId, tag, startIso, endIso, limit = 100 }) {
  ensurePatientRecordFactsTable(db);
  const ownerKey = resolveOwnerKey({ patientId, sessionId });
  const params = [];
  let where = 'WHERE 1=1';
  if (ownerKey) {
    where += ` AND (owner_key = ? OR patient_id = ? OR session_id = ?)`;
    params.push(ownerKey, patientId || null, sessionId || null);
  } else if (sessionId) {
    where += ` AND session_id = ?`;
    params.push(sessionId);
  } else {
    return [];
  }
  if (tag) {
    where += ` AND tag = ?`;
    params.push(String(tag));
  }
  // Date filter uses denormalized entry_date (structured_json is ciphertext)
  if (startIso) {
    where += ` AND date(COALESCE(entry_date, date(created_at)), 'start of day') >= date(?)`;
    params.push(startIso);
  }
  if (endIso) {
    where += ` AND date(COALESCE(entry_date, date(created_at)), 'start of day') <= date(?)`;
    params.push(endIso);
  }
  const lim = Math.max(1, Math.min(500, Number(limit) || 100));
  params.push(lim);
  const rows = db
    .prepare(
      `SELECT * FROM patient_record_facts ${where}
       ORDER BY datetime(created_at) DESC
       LIMIT ?`,
    )
    .all(...params);
  return rows.map(mapRow);
}

/**
 * P2.22 — Rebind anonymous facts onto authenticated patient.
 */
function claimFactsToPatient(db, { factIds = [], anonSessionId, patientId, portalSessionId }) {
  ensurePatientRecordFactsTable(db);
  if (!patientId) return 0;
  const newOwner = resolveOwnerKey({ patientId });
  let changed = 0;

  const ids = Array.isArray(factIds) ? factIds.filter(Boolean) : [];
  for (const id of ids) {
    const r = db
      .prepare(
        `UPDATE patient_record_facts SET
          patient_id = ?,
          session_id = COALESCE(?, session_id),
          owner_key = ?,
          updated_at = datetime('now')
         WHERE id = ? AND (patient_id IS NULL OR patient_id = ?)`,
      )
      .run(patientId, portalSessionId || null, newOwner, id, patientId);
    changed += r.changes || 0;
  }

  if (anonSessionId) {
    const anonOwner = resolveOwnerKey({ sessionId: anonSessionId });
    const r = db
      .prepare(
        `UPDATE patient_record_facts SET
          patient_id = ?,
          session_id = COALESCE(?, session_id),
          owner_key = ?,
          updated_at = datetime('now')
         WHERE patient_id IS NULL
           AND (session_id = ? OR owner_key = ?)`,
      )
      .run(patientId, portalSessionId || null, newOwner, anonSessionId, anonOwner);
    changed += r.changes || 0;
  }

  return changed;
}

/**
 * Hydrate a DB row for application use (decrypt PHI fields).
 * Bypass this (raw SQL) to observe ciphertext — used by adversarial at-rest tests.
 */
function mapRow(row) {
  const structured = decryptStructuredJson(row.structured_json);
  let rawExtract = null;
  try {
    rawExtract = decryptRawExtractText(row.raw_extract_text);
  } catch (_) {
    rawExtract = null;
  }
  return {
    id: row.id,
    patient_id: row.patient_id,
    session_id: row.session_id,
    owner_key: row.owner_key || null,
    tag: row.tag,
    media_type: row.media_type,
    ai_or_manual: row.ai_or_manual,
    storage_ref: row.storage_ref,
    storage_provider: row.storage_provider,
    storage_key: row.storage_key,
    structured_json: structured,
    raw_extract_text: rawExtract,
    source_language: row.source_language,
    display_language: row.display_language,
    compare_group_id: row.compare_group_id,
    request_id: row.request_id,
    confirmed_at: row.confirmed_at,
    entry_date: row.entry_date || extractEntryDate(structured) || null,
    fact_subtype: row.fact_subtype || null,
    expiry_date: row.expiry_date || null,
    provider: row.provider || null,
    issue_date: row.issue_date || row.entry_date || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

module.exports = {
  ensurePatientRecordFactsTable,
  insertFact,
  upsertFactByRequestId,
  getFactById,
  getFactByRequestId,
  updateFactConfirm,
  listFacts,
  claimFactsToPatient,
  mapRow,
  isEncryptedFactField,
};
