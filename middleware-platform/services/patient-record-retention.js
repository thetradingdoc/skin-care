'use strict';

/**
 * P8.03 — Retention for medical-tracker media + raw_extract_text.
 *
 * Product decision (locked for enforcement):
 * - structured_json (confirmed facts) retained indefinitely for the account
 * - original media blobs + raw_extract_text purged 90 days after confirmed_at
 * - unconfirmed drafts: media purged 30 days after created_at
 *
 * Deletes local:// and azure:// (remote) refs. DB pointers cleared only after
 * successful delete (or already-gone) so remote blobs are not orphaned silently.
 */

const DEFAULT_CONFIRMED_MEDIA_DAYS = 90;
const DEFAULT_DRAFT_MEDIA_DAYS = 30;

function retentionConfig() {
  return {
    confirmed_media_days: Math.max(
      1,
      parseInt(process.env.PATIENT_RECORD_MEDIA_RETENTION_DAYS || String(DEFAULT_CONFIRMED_MEDIA_DAYS), 10) ||
        DEFAULT_CONFIRMED_MEDIA_DAYS,
    ),
    draft_media_days: Math.max(
      1,
      parseInt(process.env.PATIENT_RECORD_DRAFT_MEDIA_RETENTION_DAYS || String(DEFAULT_DRAFT_MEDIA_DAYS), 10) ||
        DEFAULT_DRAFT_MEDIA_DAYS,
    ),
  };
}

/**
 * Delete local:// or azure:// media. Returns deleted=true when bytes are gone.
 */
async function deleteMediaRef(storageRef) {
  if (!storageRef || typeof storageRef !== 'string') return { deleted: false, reason: 'no_ref' };
  try {
    const gcs = require('./gcs-billing-storage');
    if (typeof gcs.deleteBuffer === 'function') {
      return await gcs.deleteBuffer(storageRef);
    }
  } catch (e) {
    return { deleted: false, reason: e.message || 'delete_failed' };
  }
  return { deleted: false, reason: 'delete_unavailable' };
}

/**
 * Purge expired media + raw_extract_text. Does NOT delete fact rows or structured_json.
 */
async function purgeExpiredPatientRecordMedia(db, { now = new Date() } = {}) {
  if (!db) return { scanned: 0, raw_cleared: 0, media_cleared: 0, media_deferred: 0 };
  const cfg = retentionConfig();
  const nowIso = now.toISOString();

  const rows = db
    .prepare(
      `SELECT id, confirmed_at, created_at, storage_ref, storage_key, raw_extract_text
       FROM patient_record_facts
       WHERE (raw_extract_text IS NOT NULL AND TRIM(raw_extract_text) != '')
          OR (storage_ref IS NOT NULL AND TRIM(storage_ref) != '')`,
    )
    .all();

  let rawCleared = 0;
  let mediaCleared = 0;
  let mediaDeferred = 0;
  for (const row of rows) {
    const anchor = row.confirmed_at || row.created_at;
    if (!anchor) continue;
    const ageMs = new Date(nowIso).getTime() - new Date(anchor).getTime();
    const limitDays = row.confirmed_at ? cfg.confirmed_media_days : cfg.draft_media_days;
    if (ageMs < limitDays * 24 * 60 * 60 * 1000) continue;

    if (row.raw_extract_text) {
      db.prepare(`UPDATE patient_record_facts SET raw_extract_text = NULL WHERE id = ?`).run(row.id);
      rawCleared += 1;
    }
    if (row.storage_ref) {
      const del = await deleteMediaRef(row.storage_ref);
      if (del.deleted) {
        db.prepare(
          `UPDATE patient_record_facts
           SET storage_ref = NULL, storage_key = NULL, storage_provider = NULL
           WHERE id = ?`,
        ).run(row.id);
        mediaCleared += 1;
      } else {
        mediaDeferred += 1;
        console.warn(
          `[retention] media purge deferred for ${row.id}: ${del.reason || 'unknown'} ref=${String(row.storage_ref).slice(0, 64)}`,
        );
      }
    }
  }

  return {
    scanned: rows.length,
    raw_cleared: rawCleared,
    media_cleared: mediaCleared,
    media_deferred: mediaDeferred,
    policy: cfg,
    enforced: true,
  };
}

module.exports = {
  retentionConfig,
  purgeExpiredPatientRecordMedia,
  deleteMediaRef,
  DEFAULT_CONFIRMED_MEDIA_DAYS,
  DEFAULT_DRAFT_MEDIA_DAYS,
};
