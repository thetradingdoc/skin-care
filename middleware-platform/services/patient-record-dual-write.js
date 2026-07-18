'use strict';

/**
 * Best-effort dual-write helpers: primary journal/spots/billing paths stay authoritative.
 * Facts write failures never throw to the caller (primary already committed).
 * M18: every silent catch increments Metrics dual-write failure counters (total + per-bridge)
 * and may emit an [ALERT] when PATIENT_RECORD_DUAL_WRITE_FAIL_ALERT is crossed (default 5).
 *
 * Bridges (all three go through safeDualWrite → Metrics.recordDualWriteFailure):
 *   journal→skin | spots→mark | billing→bill
 *
 * Media: store opaque azure://|local:// + storage_key (never permanent HTTPS).
 */

const { resolveOwnerKey } = require('./ai-capture-meter');
const factsRepo = require('../repositories/patient-record-facts-repo');
const {
  validateTagStructured,
} = require('./patient-record-fact-validators');
const { parseStorageRef } = require('./gcs-billing-storage');
const Metrics = require('./metrics');

function safeDualWrite(db, label, fn) {
  try {
    factsRepo.ensurePatientRecordFactsTable(db);
    require('../migrations/068_patient_record_facts_owner_request_id').up(db);
    return fn();
  } catch (e) {
    Metrics.recordDualWriteFailure(label, { errorMessage: e.message });
    return null;
  }
}

function mediaFieldsFromRef(storageRef, explicit = {}) {
  if (explicit.storage_key) {
    return {
      storage_ref: explicit.storage_ref || storageRef || null,
      storage_provider: explicit.storage_provider || explicit.provider || null,
      storage_key: explicit.storage_key,
    };
  }
  const parsed = parseStorageRef(storageRef);
  if (!parsed) {
    return { storage_ref: null, storage_provider: null, storage_key: null };
  }
  // Drop permanent HTTPS — keep opaque only
  const opaque =
    parsed.storage_ref && !/^https?:\/\//i.test(parsed.storage_ref)
      ? parsed.storage_ref
      : parsed.provider && parsed.key
        ? parsed.provider === 'local'
          ? `local://${parsed.key}`
          : parsed.bucket
            ? `azure://${parsed.bucket}/${parsed.key}`
            : null
        : null;
  return {
    storage_ref: opaque,
    storage_provider: parsed.provider || null,
    storage_key: parsed.key || null,
  };
}

function dualWriteJournalSkin(db, { patientId, sessionId, entry, media = null }) {
  return safeDualWrite(db, 'journal→skin', () => {
    const ownerKey = resolveOwnerKey({ patientId, sessionId });
    if (!ownerKey || !entry?.entry_date) return null;
    const structured = validateTagStructured('skin', {
      date: entry.entry_date,
      body_area: Array.isArray(entry.condition_tags) ? entry.condition_tags[0] || null : null,
      note: entry.note || null,
      ai_suggestion: null,
    });
    if (!structured.valid) return null;
    const requestId = `dual:journal:${ownerKey}:${entry.entry_date}`;
    const mediaFields = mediaFieldsFromRef(entry.photo_storage_ref, media || {});
    return factsRepo.upsertFactByRequestId(db, {
      patient_id: patientId || null,
      session_id: sessionId || null,
      owner_key: ownerKey,
      tag: 'skin',
      media_type: (mediaFields.storage_ref || entry.photo_storage_ref) ? 'photo' : null,
      ai_or_manual: 'manual',
      ...mediaFields,
      structured_json: structured.normalized,
      request_id: requestId,
      confirmed_at: new Date().toISOString(),
    });
  });
}

/**
 * P2.13 — compare_group_id = spot.id (existing spot grouping). Not null when spot known.
 */
function dualWriteSpotMark(db, { patientId, sessionId, spot, snapshot, media = null }) {
  return safeDualWrite(db, 'spots→mark', () => {
    const ownerKey = resolveOwnerKey({ patientId, sessionId });
    if (!ownerKey || !spot?.id) return null;
    const date =
      snapshot?.captured_at && String(snapshot.captured_at).slice(0, 10).match(/^\d{4}-\d{2}-\d{2}$/)
        ? String(snapshot.captured_at).slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    const structured = validateTagStructured('mark', {
      date,
      body_location: spot.body_region || spot.bodyRegion || 'unknown',
      note: spot.label || null,
      photo_ref: snapshot?.storage_ref || null,
      compare_group_id: spot.id,
    });
    if (!structured.valid) return null;
    const requestId = snapshot?.id
      ? `dual:spot_snap:${snapshot.id}`
      : `dual:spot:${spot.id}:${date}`;
    const mediaFields = mediaFieldsFromRef(snapshot?.storage_ref, media || {});
    return factsRepo.upsertFactByRequestId(db, {
      patient_id: patientId || null,
      session_id: sessionId || null,
      owner_key: ownerKey,
      tag: 'mark',
      media_type: (mediaFields.storage_ref || snapshot?.storage_ref) ? 'photo' : null,
      ai_or_manual: 'manual',
      ...mediaFields,
      compare_group_id: spot.id,
      structured_json: structured.normalized,
      request_id: requestId,
      confirmed_at: new Date().toISOString(),
    });
  });
}

function dualWriteBillingBill(db, { patientId, sessionId, document, event, media = null }) {
  return safeDualWrite(db, 'billing→bill', () => {
    const ownerKey = resolveOwnerKey({ patientId, sessionId });
    if (!ownerKey) return null;
    const date =
      (event?.service_date && String(event.service_date).slice(0, 10)) ||
      new Date().toISOString().slice(0, 10);
    const amountCents =
      event?.amount_cents != null && Number.isFinite(Number(event.amount_cents))
        ? Math.round(Number(event.amount_cents))
        : null;
    const structured = validateTagStructured('bill', {
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10),
      provider: event?.provider_name || null,
      amount_cents: amountCents,
      currency: event?.currency || 'USD',
      doc_type: document?.source_type || event?.event_type || 'upload',
    });
    if (!structured.valid) return null;
    const requestId = event?.id
      ? `dual:bevt:${event.id}`
      : document?.id
        ? `dual:bdoc:${document.id}`
        : null;
    if (!requestId) return null;
    const mime = String(document?.mime_type || '').toLowerCase();
    const mediaFields = mediaFieldsFromRef(document?.storage_ref, media || {});
    const mediaType = mime === 'application/pdf' ? 'pdf' : (mediaFields.storage_ref || document?.storage_ref) ? 'photo' : null;
    return factsRepo.upsertFactByRequestId(db, {
      patient_id: patientId || null,
      session_id: sessionId || null,
      owner_key: ownerKey,
      tag: 'bill',
      media_type: mediaType,
      ai_or_manual: 'manual',
      ...mediaFields,
      structured_json: structured.normalized,
      request_id: requestId,
      confirmed_at: new Date().toISOString(),
    });
  });
}

module.exports = {
  dualWriteJournalSkin,
  dualWriteSpotMark,
  dualWriteBillingBill,
  mediaFieldsFromRef,
};
