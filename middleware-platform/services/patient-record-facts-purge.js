'use strict';

/**
 * Account-deletion helpers for patient_record_facts + associated media.
 * Phase 1 hard requirement: account purge must remove marks/photos/notes facts
 * and best-effort delete object-storage bytes (not only DB rows).
 */

function tableExists(db, name) {
  try {
    const row = db
      .prepare(`SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`)
      .get(name);
    return Boolean(row);
  } catch {
    return false;
  }
}

function ownerKeysFor({ patientId, sessionId }) {
  const keys = new Set();
  if (patientId) {
    const p = String(patientId).trim();
    if (p) {
      keys.add(p);
      keys.add(`patient:${p}`);
    }
  }
  if (sessionId) {
    const s = String(sessionId).trim();
    if (s) {
      keys.add(s);
      keys.add(`session:${s}`);
    }
  }
  return [...keys];
}

/**
 * Select fact rows owned by this account (patient_id, session_id, or owner_key forms).
 */
function listFactsForAccount(db, { patientId, sessionId }) {
  if (!tableExists(db, 'patient_record_facts')) return [];
  const keys = ownerKeysFor({ patientId, sessionId });
  if (!keys.length && !patientId && !sessionId) return [];

  const clauses = [];
  const params = [];
  if (patientId) {
    clauses.push('patient_id = ?');
    params.push(String(patientId));
  }
  if (sessionId) {
    clauses.push('session_id = ?');
    params.push(String(sessionId));
  }
  for (const k of keys) {
    clauses.push('owner_key = ?');
    params.push(k);
  }
  if (!clauses.length) return [];

  return db
    .prepare(
      `SELECT id, storage_ref, storage_provider, storage_key, tag, patient_id, session_id, owner_key
       FROM patient_record_facts
       WHERE ${clauses.join(' OR ')}`,
    )
    .all(...params);
}

/**
 * Delete media tokens + fact rows for an account. Returns storage refs to scrub.
 * Does NOT delete object-storage bytes — caller must await deleteCollectedMediaRefs.
 */
function clearPatientRecordFactsRows(db, { patientId, sessionId }) {
  const facts = listFactsForAccount(db, { patientId, sessionId });
  const factIds = [...new Set(facts.map((f) => f.id).filter(Boolean))];
  const mediaRefs = [
    ...new Set(facts.map((f) => f.storage_ref).filter((r) => r && String(r).trim())),
  ];

  let tokensDeleted = 0;
  if (factIds.length && tableExists(db, 'patient_record_media_tokens')) {
    const delTok = db.prepare(`DELETE FROM patient_record_media_tokens WHERE fact_id = ?`);
    for (const id of factIds) {
      tokensDeleted += Number(delTok.run(id).changes) || 0;
    }
  }

  let factsDeleted = 0;
  if (factIds.length) {
    const delFact = db.prepare(`DELETE FROM patient_record_facts WHERE id = ?`);
    for (const id of factIds) {
      factsDeleted += Number(delFact.run(id).changes) || 0;
    }
  }

  return {
    facts_deleted: factsDeleted,
    media_tokens_deleted: tokensDeleted,
    media_refs: mediaRefs,
    fact_ids: factIds,
    tags: facts.map((f) => f.tag),
  };
}

/**
 * Best-effort delete of object-storage bytes for collected refs.
 * Uses patient-record-media.deleteRecordMedia (gs://, azure://, local://).
 */
async function deleteCollectedMediaRefs(mediaRefs = []) {
  const { deleteRecordMedia } = require('./patient-record-media');
  let media_deleted = 0;
  let media_failed = 0;
  const failures = [];
  for (const ref of mediaRefs) {
    const out = await deleteRecordMedia({ storage_ref: ref });
    if (out && out.deleted) media_deleted += 1;
    else {
      media_failed += 1;
      failures.push({ ref: String(ref).slice(0, 120), reason: out?.reason || 'unknown' });
    }
  }
  return { media_deleted, media_failed, failures };
}

module.exports = {
  ownerKeysFor,
  listFactsForAccount,
  clearPatientRecordFactsRows,
  deleteCollectedMediaRefs,
  tableExists,
};
