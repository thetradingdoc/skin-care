'use strict';

/**
 * Postgres read path for routine/shelf/bio when DATA_STORE=postgres.
 * Falls back to SQLite via caller when Postgres is unavailable.
 */
const { getDataStoreMode, getPostgresSql, ensurePostgresConsumerTables, isPostgresEnabled } = require('../db/client');

async function getActiveRoutineTemplate(sqliteDb, { patientId, sessionId }) {
  if (getDataStoreMode() !== 'postgres' || !isPostgresEnabled()) {
    const whereSql = patientId
      ? `WHERE (patient_id = ? OR session_id = ?) AND is_active = 1`
      : `WHERE session_id = ? AND is_active = 1`;
    const params = patientId ? [patientId, sessionId] : [sessionId];
    return sqliteDb
      .prepare(
        `SELECT * FROM patient_routine_templates ${whereSql} ORDER BY datetime(updated_at) DESC LIMIT 1`,
      )
      .get(...params);
  }

  await ensurePostgresConsumerTables();
  const sql = getPostgresSql();
  const rows = patientId
    ? await sql`
        SELECT * FROM patient_routine_templates
        WHERE (patient_id = ${patientId} OR session_id = ${sessionId}) AND is_active = TRUE
        ORDER BY updated_at DESC LIMIT 1
      `
    : await sql`
        SELECT * FROM patient_routine_templates
        WHERE session_id = ${sessionId} AND is_active = TRUE
        ORDER BY updated_at DESC LIMIT 1
      `;
  return rows[0] || null;
}

async function getBioProfileRow(sqliteDb, { patientId, sessionId }) {
  if (getDataStoreMode() !== 'postgres' || !isPostgresEnabled()) {
    const row = sqliteDb
      .prepare(
        `SELECT * FROM patient_bio_profiles WHERE session_id = ? OR patient_id = ? ORDER BY updated_at DESC LIMIT 1`,
      )
      .get(sessionId, patientId || sessionId);
    return row || null;
  }

  await ensurePostgresConsumerTables();
  const sql = getPostgresSql();
  const rows = await sql`
    SELECT * FROM patient_bio_profiles
    WHERE session_id = ${sessionId} OR patient_id = ${patientId || null}
    ORDER BY updated_at DESC LIMIT 1
  `;
  return rows[0] || null;
}

function shouldPreferPostgres() {
  return getDataStoreMode() === 'postgres' && isPostgresEnabled();
}

module.exports = {
  getActiveRoutineTemplate,
  getBioProfileRow,
  shouldPreferPostgres,
};
