'use strict';

/**
 * Ownership check for Progress Kelly mark_id (compare_group_id).
 * Only looks at the authenticated patient's rows — never reveals whether
 * another patient's mark_id exists (404 either way).
 */

function assertMarkOwnedByPatient(db, { patientId, markId }) {
  const pid = patientId != null ? String(patientId).trim() : '';
  const mid = markId != null ? String(markId).trim() : '';
  if (!pid) {
    const err = new Error('PATIENT_ID_REQUIRED');
    err.code = 'PATIENT_ID_REQUIRED';
    err.status = 401;
    throw err;
  }
  if (!mid) {
    const err = new Error('MARK_ID_REQUIRED');
    err.code = 'MARK_ID_REQUIRED';
    err.status = 400;
    throw err;
  }

  require('../repositories/patient-record-facts-repo').ensurePatientRecordFactsTable(db);

  const row = db
    .prepare(
      `SELECT id FROM patient_record_facts
       WHERE patient_id = ?
         AND compare_group_id = ?
         AND tag = 'mark'
         AND confirmed_at IS NOT NULL
       LIMIT 1`,
    )
    .get(pid, mid);

  if (!row) {
    const err = new Error('MARK_NOT_FOUND');
    err.code = 'MARK_NOT_FOUND';
    err.status = 404;
    throw err;
  }
  return true;
}

module.exports = { assertMarkOwnedByPatient };
