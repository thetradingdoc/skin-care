'use strict';

/**
 * TOUCH-099 — Hard purge consumer account data for App Store 5.1.1(v).
 * Deletes (or anonymizes) rows for session_id / patient_id / email.
 * Safe to call when optional tables are missing (checks sqlite_master).
 *
 * Async: after DB deletes, best-effort deletes object-storage media refs
 * collected from patient_record_facts (and journal/routine/spot pointers).
 *
 * Export PDFs (physician export) are generated on the fly — not stored as files.
 * Live share links are revoked by deleting patient_physician_share_tokens.
 */

const crypto = require('crypto');
const {
  clearPatientRecordFactsRows,
  deleteCollectedMediaRefs,
} = require('./patient-record-facts-purge');

function tableExists(db, name) {
  try {
    const row = db.prepare(`SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`).get(name);
    return Boolean(row);
  } catch {
    return false;
  }
}

function runDelete(db, sql, params = []) {
  try {
    const info = db.prepare(sql).run(...params);
    return Number(info.changes) || 0;
  } catch (e) {
    // Missing table / column — skip
    return 0;
  }
}

function collectOwnerKeys({ sessionId, patientId }) {
  const keys = new Set();
  if (sessionId) keys.add(String(sessionId));
  if (patientId) keys.add(String(patientId));
  return [...keys];
}

/**
 * Collect opaque media refs from tables about to be deleted (journal / routine / spots).
 */
function collectLegacyMediaRefs(sqliteDb, { sessionId, patientId, ownerKeys }) {
  const refs = [];
  const pushRef = (r) => {
    if (r && String(r).trim() && !/^https?:\/\//i.test(String(r))) refs.push(String(r).trim());
  };

  if (tableExists(sqliteDb, 'patient_journal_entries')) {
    try {
      if (patientId) {
        for (const r of sqliteDb
          .prepare(`SELECT photo_storage_ref AS ref FROM patient_journal_entries WHERE patient_id = ?`)
          .all(patientId)) {
          pushRef(r.ref);
        }
      }
      if (sessionId) {
        for (const r of sqliteDb
          .prepare(`SELECT photo_storage_ref AS ref FROM patient_journal_entries WHERE session_id = ?`)
          .all(sessionId)) {
          pushRef(r.ref);
        }
      }
    } catch (_) {}
  }

  if (tableExists(sqliteDb, 'patient_routine_daily_media') && tableExists(sqliteDb, 'patient_routine_daily_entries')) {
    try {
      const entryIds = new Set();
      if (sessionId) {
        for (const r of sqliteDb
          .prepare(`SELECT id FROM patient_routine_daily_entries WHERE session_id = ?`)
          .all(sessionId)) {
          entryIds.add(r.id);
        }
      }
      if (patientId) {
        for (const r of sqliteDb
          .prepare(`SELECT id FROM patient_routine_daily_entries WHERE patient_id = ?`)
          .all(patientId)) {
          entryIds.add(r.id);
        }
      }
      for (const id of entryIds) {
        for (const r of sqliteDb
          .prepare(`SELECT media_url AS ref FROM patient_routine_daily_media WHERE daily_entry_id = ?`)
          .all(id)) {
          pushRef(r.ref);
        }
      }
    } catch (_) {}
  }

  if (tableExists(sqliteDb, 'patient_spots') && tableExists(sqliteDb, 'patient_spot_snapshots')) {
    try {
      const spotIds = [];
      for (const ok of ownerKeys) {
        for (const r of sqliteDb.prepare(`SELECT id FROM patient_spots WHERE owner_key = ?`).all(ok)) {
          spotIds.push(r.id);
        }
      }
      for (const id of spotIds) {
        try {
          for (const r of sqliteDb
            .prepare(
              `SELECT storage_ref AS ref FROM patient_spot_snapshots WHERE spot_id = ?
               UNION ALL
               SELECT photo_storage_ref AS ref FROM patient_spot_snapshots WHERE spot_id = ?
               UNION ALL
               SELECT media_url AS ref FROM patient_spot_snapshots WHERE spot_id = ?`,
            )
            .all(id, id, id)) {
            pushRef(r.ref);
          }
        } catch (_) {
          // column set varies — best effort
        }
      }
    } catch (_) {}
  }

  return [...new Set(refs)];
}

/**
 * @param {object} opts
 * @param {import('better-sqlite3').Database} opts.sqliteDb
 * @param {string} opts.sessionId
 * @param {string|null} opts.patientId
 * @param {string|null} opts.email
 * @returns {Promise<{ success: true, deleted: Record<string, number>, emailHash: string|null, media: object }>}
 */
async function purgePatientAccount({ sqliteDb, sessionId, patientId = null, email = null }) {
  if (!sqliteDb) throw new Error('sqliteDb required');
  if (!sessionId && !patientId && !email) throw new Error('sessionId, patientId, or email required');

  const deleted = {};
  const ownerKeys = collectOwnerKeys({ sessionId, patientId });
  const emailNorm = email ? String(email).trim().toLowerCase() : null;
  const emailHash = emailNorm
    ? crypto.createHash('sha256').update(`purge:${emailNorm}`).digest('hex').slice(0, 16)
    : null;

  /** @type {string[]} */
  let mediaRefsToDelete = [];

  const tx = sqliteDb.transaction(() => {
    // --- Medical tracker core: patient_record_facts (+ tokens); collect media refs ---
    const factsPurge = clearPatientRecordFactsRows(sqliteDb, { patientId, sessionId });
    deleted.patient_record_facts = factsPurge.facts_deleted;
    deleted.patient_record_media_tokens = factsPurge.media_tokens_deleted;
    mediaRefsToDelete = mediaRefsToDelete.concat(factsPurge.media_refs || []);

    // Legacy journal/routine/spot media refs before those rows go away
    mediaRefsToDelete = mediaRefsToDelete.concat(
      collectLegacyMediaRefs(sqliteDb, { sessionId, patientId, ownerKeys }),
    );

    // --- Capture pipeline ---
    if (patientId) {
      deleted.pending_captures =
        (deleted.pending_captures || 0) +
        runDelete(sqliteDb, `DELETE FROM pending_captures WHERE patient_id = ?`, [patientId]);
      deleted.capture_sessions =
        (deleted.capture_sessions || 0) +
        runDelete(sqliteDb, `DELETE FROM capture_sessions WHERE patient_id = ?`, [patientId]);
    }
    if (sessionId) {
      deleted.pending_captures =
        (deleted.pending_captures || 0) +
        runDelete(sqliteDb, `DELETE FROM pending_captures WHERE claimed_session_id = ? OR anon_session_id = ?`, [
          sessionId,
          sessionId,
        ]);
      deleted.capture_sessions =
        (deleted.capture_sessions || 0) +
        runDelete(sqliteDb, `DELETE FROM capture_sessions WHERE session_id = ?`, [sessionId]);
    }

    // --- Physician share links (Export); PDFs are ephemeral, tokens are the live access ---
    if (patientId && tableExists(sqliteDb, 'patient_physician_share_tokens')) {
      if (tableExists(sqliteDb, 'patient_physician_share_access_log')) {
        const tokens = sqliteDb
          .prepare(`SELECT token FROM patient_physician_share_tokens WHERE patient_id = ?`)
          .all(patientId)
          .map((r) => r.token);
        let nLog = 0;
        for (const t of tokens) {
          nLog += runDelete(sqliteDb, `DELETE FROM patient_physician_share_access_log WHERE token = ?`, [t]);
        }
        deleted.patient_physician_share_access_log = nLog;
      }
      deleted.patient_physician_share_tokens = runDelete(
        sqliteDb,
        `DELETE FROM patient_physician_share_tokens WHERE patient_id = ?`,
        [patientId],
      );
    }

    // --- Spots + snapshots ---
    if (tableExists(sqliteDb, 'patient_spots') && ownerKeys.length) {
      const spotIds = [];
      for (const ok of ownerKeys) {
        const rows = sqliteDb.prepare(`SELECT id FROM patient_spots WHERE owner_key = ?`).all(ok);
        for (const r of rows) spotIds.push(r.id);
      }
      if (spotIds.length && tableExists(sqliteDb, 'patient_spot_snapshots')) {
        const delSnap = sqliteDb.prepare(`DELETE FROM patient_spot_snapshots WHERE spot_id = ?`);
        let n = 0;
        for (const id of spotIds) n += delSnap.run(id).changes;
        deleted.patient_spot_snapshots = n;
      }
      let nSpots = 0;
      for (const ok of ownerKeys) {
        nSpots += runDelete(sqliteDb, `DELETE FROM patient_spots WHERE owner_key = ?`, [ok]);
      }
      deleted.patient_spots = nSpots;
    }

    // --- Journal ---
    if (tableExists(sqliteDb, 'patient_journal_entries')) {
      let n = 0;
      if (patientId) n += runDelete(sqliteDb, `DELETE FROM patient_journal_entries WHERE patient_id = ?`, [patientId]);
      if (sessionId) n += runDelete(sqliteDb, `DELETE FROM patient_journal_entries WHERE session_id = ?`, [sessionId]);
      for (const ok of ownerKeys) {
        n += runDelete(sqliteDb, `DELETE FROM patient_journal_entries WHERE owner_key = ?`, [ok]);
      }
      deleted.patient_journal_entries = n;
    }

    // --- Routine media/logs/entries/templates ---
    if (tableExists(sqliteDb, 'patient_routine_daily_entries')) {
      const entryIds = [];
      if (sessionId) {
        for (const r of sqliteDb
          .prepare(`SELECT id FROM patient_routine_daily_entries WHERE session_id = ?`)
          .all(sessionId)) {
          entryIds.push(r.id);
        }
      }
      if (patientId) {
        for (const r of sqliteDb
          .prepare(`SELECT id FROM patient_routine_daily_entries WHERE patient_id = ?`)
          .all(patientId)) {
          entryIds.push(r.id);
        }
      }
      const uniq = [...new Set(entryIds)];
      if (uniq.length) {
        let nMedia = 0;
        let nLogs = 0;
        for (const id of uniq) {
          nMedia += runDelete(sqliteDb, `DELETE FROM patient_routine_daily_media WHERE daily_entry_id = ?`, [id]);
          nLogs += runDelete(sqliteDb, `DELETE FROM patient_routine_daily_item_logs WHERE daily_entry_id = ?`, [id]);
        }
        deleted.patient_routine_daily_media = nMedia;
        deleted.patient_routine_daily_item_logs = nLogs;
      }
      let nEnt = 0;
      if (sessionId) nEnt += runDelete(sqliteDb, `DELETE FROM patient_routine_daily_entries WHERE session_id = ?`, [sessionId]);
      if (patientId) nEnt += runDelete(sqliteDb, `DELETE FROM patient_routine_daily_entries WHERE patient_id = ?`, [patientId]);
      deleted.patient_routine_daily_entries = nEnt;
    }

    if (tableExists(sqliteDb, 'patient_routine_templates')) {
      const tmplIds = [];
      if (sessionId) {
        for (const r of sqliteDb.prepare(`SELECT id FROM patient_routine_templates WHERE session_id = ?`).all(sessionId)) {
          tmplIds.push(r.id);
        }
      }
      if (patientId) {
        for (const r of sqliteDb.prepare(`SELECT id FROM patient_routine_templates WHERE patient_id = ?`).all(patientId)) {
          tmplIds.push(r.id);
        }
      }
      for (const id of [...new Set(tmplIds)]) {
        runDelete(sqliteDb, `DELETE FROM patient_routine_template_items WHERE template_id = ?`, [id]);
      }
      let n = 0;
      if (sessionId) n += runDelete(sqliteDb, `DELETE FROM patient_routine_templates WHERE session_id = ?`, [sessionId]);
      if (patientId) n += runDelete(sqliteDb, `DELETE FROM patient_routine_templates WHERE patient_id = ?`, [patientId]);
      deleted.patient_routine_templates = n;
    }

    runDelete(sqliteDb, `DELETE FROM patient_routine_lineup_snapshots WHERE session_id = ?`, [sessionId]);
    if (patientId) {
      runDelete(sqliteDb, `DELETE FROM patient_routine_lineup_snapshots WHERE patient_id = ?`, [patientId]);
    }

    // --- Bio / allergens ---
    let nBio = 0;
    if (sessionId) nBio += runDelete(sqliteDb, `DELETE FROM patient_bio_profiles WHERE session_id = ?`, [sessionId]);
    if (patientId) nBio += runDelete(sqliteDb, `DELETE FROM patient_bio_profiles WHERE patient_id = ?`, [patientId]);
    deleted.patient_bio_profiles = nBio;

    if (tableExists(sqliteDb, 'patient_allergen_exclusions')) {
      let n = 0;
      if (sessionId) n += runDelete(sqliteDb, `DELETE FROM patient_allergen_exclusions WHERE session_id = ?`, [sessionId]);
      if (patientId) n += runDelete(sqliteDb, `DELETE FROM patient_allergen_exclusions WHERE patient_id = ?`, [patientId]);
      deleted.patient_allergen_exclusions = n;
    }

    // --- Shelf / product lists ---
    if (tableExists(sqliteDb, 'patient_product_lists')) {
      const listIds = [];
      for (const ownerId of ownerKeys) {
        for (const r of sqliteDb
          .prepare(
            `SELECT id FROM patient_product_lists WHERE owner_id = ? OR (owner_type = 'session' AND owner_id = ?) OR (owner_type = 'patient' AND owner_id = ?)`,
          )
          .all(ownerId, sessionId || ownerId, patientId || ownerId)) {
          listIds.push(r.id);
        }
      }
      let nItems = 0;
      for (const id of [...new Set(listIds)]) {
        nItems += runDelete(sqliteDb, `DELETE FROM patient_product_list_items WHERE list_id = ?`, [id]);
        runDelete(sqliteDb, `DELETE FROM patient_product_lists WHERE id = ?`, [id]);
      }
      deleted.patient_product_list_items = nItems;
      deleted.patient_product_lists = [...new Set(listIds)].length;
    }

    // step3 shelf
    if (sessionId) {
      deleted.patient_onboarding_step3_products =
        runDelete(sqliteDb, `DELETE FROM patient_onboarding_step3_products WHERE session_id = ?`, [sessionId]);
      deleted.patient_onboarding_step3_state =
        runDelete(sqliteDb, `DELETE FROM patient_onboarding_step3_state WHERE session_id = ?`, [sessionId]);
      runDelete(sqliteDb, `DELETE FROM patient_onboarding_enrichment_queue WHERE session_id = ?`, [sessionId]);
    }
    if (patientId) {
      runDelete(sqliteDb, `DELETE FROM patient_onboarding_step3_products WHERE patient_id = ?`, [patientId]);
      runDelete(sqliteDb, `DELETE FROM patient_onboarding_enrichment_queue WHERE patient_id = ?`, [patientId]);
    }

    // consumer profile + goals
    for (const ok of ownerKeys) {
      runDelete(sqliteDb, `DELETE FROM patient_consumer_profiles WHERE owner_key = ? OR session_id = ? OR patient_id = ?`, [
        ok,
        sessionId || ok,
        patientId || ok,
      ]);
      runDelete(sqliteDb, `DELETE FROM patient_goals WHERE owner_key = ?`, [ok]);
    }

    // Shopify dead letters by email
    if (tableExists(sqliteDb, 'shopify_order_dead_letters') && emailNorm) {
      deleted.shopify_order_dead_letters = runDelete(
        sqliteDb,
        `DELETE FROM shopify_order_dead_letters WHERE LOWER(email) = LOWER(?)`,
        [emailNorm],
      );
    }

    // portal events
    if (sessionId) runDelete(sqliteDb, `DELETE FROM patient_portal_events WHERE session_id = ?`, [sessionId]);
    if (patientId) runDelete(sqliteDb, `DELETE FROM patient_portal_events WHERE patient_id = ?`, [patientId]);

    // OTP / verification codes
    if (emailNorm && tableExists(sqliteDb, 'email_verification_codes')) {
      deleted.email_verification_codes = runDelete(
        sqliteDb,
        `DELETE FROM email_verification_codes WHERE LOWER(email) = LOWER(?)`,
        [emailNorm],
      );
    }

    // Funnel / skin-age links
    if (sessionId) {
      runDelete(sqliteDb, `DELETE FROM skin_age_readings WHERE session_id = ?`, [sessionId]);
      runDelete(sqliteDb, `UPDATE funnel_journeys SET linked_session_id = NULL WHERE linked_session_id = ?`, [
        sessionId,
      ]);
    }
    if (patientId) {
      runDelete(sqliteDb, `DELETE FROM skin_age_readings WHERE patient_id = ?`, [patientId]);
      runDelete(sqliteDb, `UPDATE funnel_journeys SET linked_patient_id = NULL WHERE linked_patient_id = ?`, [
        patientId,
      ]);
    }

    // Anonymize FHIR patient identity
    if (patientId && tableExists(sqliteDb, 'fhir_patients')) {
      deleted.fhir_patients_anonymized = runDelete(
        sqliteDb,
        `UPDATE fhir_patients SET email = NULL, phone = NULL, resource_json = NULL WHERE resource_id = ?`,
        [patientId],
      );
    }

    // Sessions last
    if (sessionId) {
      deleted.patient_sessions = runDelete(sqliteDb, `DELETE FROM patient_sessions WHERE session_id = ?`, [sessionId]);
      deleted.patient_portal_sessions = runDelete(
        sqliteDb,
        `DELETE FROM patient_portal_sessions WHERE id = ?`,
        [sessionId],
      );
    }
    if (emailNorm) {
      deleted.patient_sessions =
        (deleted.patient_sessions || 0) +
        runDelete(sqliteDb, `DELETE FROM patient_sessions WHERE LOWER(email) = LOWER(?)`, [emailNorm]);
      deleted.patient_portal_sessions =
        (deleted.patient_portal_sessions || 0) +
        runDelete(sqliteDb, `DELETE FROM patient_portal_sessions WHERE LOWER(email) = LOWER(?)`, [emailNorm]);
    }
    if (patientId) {
      deleted.patient_sessions =
        (deleted.patient_sessions || 0) +
        runDelete(sqliteDb, `DELETE FROM patient_sessions WHERE patient_id = ?`, [patientId]);
      deleted.patient_portal_sessions =
        (deleted.patient_portal_sessions || 0) +
        runDelete(sqliteDb, `DELETE FROM patient_portal_sessions WHERE patient_id = ?`, [patientId]);
    }

    // Progress Kelly nudge / rate-limit state
    if (patientId) {
      try {
        const { clearNudgeStateForPatient } = require('./progress-kelly-nudge-state');
        deleted.progress_kelly_nudge_state = clearNudgeStateForPatient(sqliteDb, { patientId });
      } catch (_) {
        if (tableExists(sqliteDb, 'progress_kelly_nudge_state')) {
          deleted.progress_kelly_nudge_state = runDelete(
            sqliteDb,
            `DELETE FROM progress_kelly_nudge_state WHERE patient_id = ?`,
            [patientId],
          );
        }
      }
    }

    // Audit tombstone
    if (tableExists(sqliteDb, 'patient_account_deletions')) {
      sqliteDb
        .prepare(
          `INSERT INTO patient_account_deletions (id, email_hash, patient_id, deleted_at, deleted_summary_json)
           VALUES (?, ?, ?, datetime('now'), ?)`,
        )
        .run(
          `del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          emailHash,
          patientId,
          JSON.stringify(deleted),
        );
    }
  });

  tx();

  // Object storage after DB commit — row deletion must not wait on remote I/O
  const uniqueRefs = [...new Set(mediaRefsToDelete)];
  const media = await deleteCollectedMediaRefs(uniqueRefs);
  deleted.media_refs_attempted = uniqueRefs.length;
  deleted.media_blobs_deleted = media.media_deleted;
  deleted.media_blobs_failed = media.media_failed;

  return { success: true, deleted, emailHash, media };
}

function ensurePurgeSupportTables(sqliteDb) {
  sqliteDb
    .prepare(
      `CREATE TABLE IF NOT EXISTS patient_account_deletions (
        id TEXT PRIMARY KEY,
        email_hash TEXT,
        patient_id TEXT,
        deleted_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_summary_json TEXT
      )`,
    )
    .run();
  sqliteDb
    .prepare(
      `CREATE TABLE IF NOT EXISTS patient_allergen_exclusions (
        id TEXT PRIMARY KEY,
        patient_id TEXT,
        session_id TEXT,
        allergen_class TEXT NOT NULL,
        label TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    )
    .run();
  sqliteDb
    .prepare(
      `CREATE TABLE IF NOT EXISTS shopify_order_dead_letters (
        id TEXT PRIMARY KEY,
        shopify_order_id TEXT NOT NULL,
        email TEXT,
        payload_json TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        resolved_at TEXT
      )`,
    )
    .run();
}

module.exports = {
  purgePatientAccount,
  ensurePurgeSupportTables,
  tableExists,
  collectLegacyMediaRefs,
};
