'use strict';

/**
 * P5.11 / P5.12 — Marks list + compare_group timeline.
 * Ownership-scoped; no AI interpretation.
 */

const factsRepo = require('../../repositories/patient-record-facts-repo');
const { presentFact } = require('../patient-record-media-access');

function requirePatientId(patientId) {
  if (!patientId) {
    const err = new Error('PATIENT_ID_REQUIRED');
    err.code = 'PATIENT_ID_REQUIRED';
    throw err;
  }
}

/**
 * P5.11 — Marks for compare_group picker (authenticated patient only).
 */
function listMarksForPatient(db, { patientId, limit = 50 } = {}) {
  requirePatientId(patientId);
  factsRepo.ensurePatientRecordFactsTable(db);
  const facts = factsRepo
    .listFacts(db, { patientId, tag: 'mark', limit })
    .filter((f) => f.confirmed_at);

  // Fail-loud ownership: every row must match patientId
  for (const f of facts) {
    if (f.patient_id !== patientId) {
      const err = new Error('OWNERSHIP_VIOLATION');
      err.code = 'OWNERSHIP_VIOLATION';
      err.fact_id = f.id;
      throw err;
    }
  }

  return {
    success: true,
    marks: facts.map((f) => {
      const presented = presentFact(f, { db });
      return {
        id: f.id,
        date: f.structured_json?.date || f.entry_date || null,
        body_location: f.structured_json?.body_location || null,
        note: f.structured_json?.note || null,
        compare_group_id: f.compare_group_id || null,
        media_url: presented.media_url || null,
        media_url_expires_at: presented.media_url_expires_at || null,
        // Named-zone pointer only (no narrative prose, no scores/%).
        visual_pointer: f.structured_json?.visual_pointer || null,
      };
    }),
  };
}

/**
 * P5.12 — Ordered compare_group timeline. No AI narrative.
 * Uses entry_date (plaintext denorm) for ORDER BY — structured_json is ciphertext at rest.
 */
function getCompareGroupTimeline(db, { patientId, compareGroupId } = {}) {
  requirePatientId(patientId);
  if (!compareGroupId) {
    const err = new Error('COMPARE_GROUP_ID_REQUIRED');
    err.code = 'COMPARE_GROUP_ID_REQUIRED';
    throw err;
  }
  factsRepo.ensurePatientRecordFactsTable(db);

  const rows = db
    .prepare(
      `SELECT * FROM patient_record_facts
       WHERE patient_id = ?
         AND compare_group_id = ?
         AND tag = 'mark'
         AND confirmed_at IS NOT NULL
       ORDER BY date(COALESCE(entry_date, date(confirmed_at)), 'start of day') ASC,
                datetime(confirmed_at) ASC`,
    )
    .all(patientId, compareGroupId);

  for (const row of rows) {
    if (row.patient_id !== patientId) {
      const err = new Error('OWNERSHIP_VIOLATION');
      err.code = 'OWNERSHIP_VIOLATION';
      throw err;
    }
  }

  const facts = rows.map((row) => {
    const fact = factsRepo.mapRow(row);
    const presented = presentFact(fact, { db });
    return {
      id: fact.id,
      date: fact.structured_json?.date || fact.entry_date || null,
      body_location: fact.structured_json?.body_location || null,
      note: fact.structured_json?.note || null,
      compare_group_id: fact.compare_group_id,
      media_url: presented.media_url || null,
      media_url_expires_at: presented.media_url_expires_at || null,
      confirmed_at: fact.confirmed_at,
      // Approximate named-zone overlay data — never AI narrative prose.
      visual_pointer: fact.structured_json?.visual_pointer || null,
    };
  });

  return {
    success: true,
    compare_group_id: compareGroupId,
    facts,
    narrative: null,
    interpretation: null,
    ai_generated: false,
    summary: null,
  };
}

module.exports = {
  listMarksForPatient,
  getCompareGroupTimeline,
};
