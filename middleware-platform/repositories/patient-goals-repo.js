'use strict';

const {
  getDataStoreMode,
  getPostgresSql,
  ensurePostgresConsumerTables,
  ensureSqliteConsumerTables,
  resolveOwnerKey,
} = require('../db/client');

const VALID_TYPES = new Set(['watch_spot', 'keep_journal', 'improve_routine', 'reduce_conflicts']);
const VALID_STATUS = new Set(['active', 'completed', 'dismissed']);

function goalId() {
  return `goal_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function rowToGoal(row) {
  if (!row) return null;
  return {
    id: row.id,
    owner_key: row.owner_key,
    goal_type: row.goal_type,
    target_ref: row.target_ref || null,
    status: row.status,
    source: row.source,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function ensureGoalsTable(sqliteDb) {
  const migration = require('../migrations/057_patient_goals');
  if (migration?.up) migration.up(sqliteDb);
}

async function listGoals(sqliteDb, { patientId, sessionId, status }) {
  const ownerKey = resolveOwnerKey({ patientId, sessionId });
  if (!ownerKey) return [];
  ensureGoalsTable(sqliteDb);

  if (getDataStoreMode() === 'postgres') {
    await ensurePostgresConsumerTables();
    const sql = getPostgresSql();
    if (status) {
      const rows = await sql`
        SELECT * FROM patient_goals WHERE owner_key = ${ownerKey} AND status = ${status}
        ORDER BY created_at DESC
      `;
      return rows.map(rowToGoal);
    }
    const rows = await sql`
      SELECT * FROM patient_goals WHERE owner_key = ${ownerKey} ORDER BY created_at DESC
    `;
    return rows.map(rowToGoal);
  }

  const rows = status
    ? sqliteDb
        .prepare(`SELECT * FROM patient_goals WHERE owner_key = ? AND status = ? ORDER BY datetime(created_at) DESC`)
        .all(ownerKey, status)
    : sqliteDb
        .prepare(`SELECT * FROM patient_goals WHERE owner_key = ? ORDER BY datetime(created_at) DESC`)
        .all(ownerKey);
  return rows.map(rowToGoal);
}

async function createGoal(sqliteDb, { patientId, sessionId, goalType, targetRef, source }) {
  const ownerKey = resolveOwnerKey({ patientId, sessionId });
  if (!ownerKey) throw new Error('owner_key_required');
  const type = String(goalType || '').trim();
  if (!VALID_TYPES.has(type)) throw new Error('invalid_goal_type');
  ensureGoalsTable(sqliteDb);

  const id = goalId();
  const now = new Date().toISOString();
  const src = source || 'user';

  if (getDataStoreMode() === 'postgres') {
    await ensurePostgresConsumerTables();
    const sql = getPostgresSql();
    await sql`
      INSERT INTO patient_goals (id, owner_key, goal_type, target_ref, status, source, created_at, updated_at)
      VALUES (${id}, ${ownerKey}, ${type}, ${targetRef || null}, 'active', ${src}, NOW(), NOW())
    `;
    const rows = await sql`SELECT * FROM patient_goals WHERE id = ${id} LIMIT 1`;
    return rowToGoal(rows[0]);
  }

  sqliteDb
    .prepare(
      `INSERT INTO patient_goals (id, owner_key, goal_type, target_ref, status, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
    )
    .run(id, ownerKey, type, targetRef || null, src, now, now);
  return rowToGoal(sqliteDb.prepare(`SELECT * FROM patient_goals WHERE id = ?`).get(id));
}

async function updateGoal(sqliteDb, { patientId, sessionId, goalId: id, patch }) {
  const ownerKey = resolveOwnerKey({ patientId, sessionId });
  if (!ownerKey || !id) return null;
  ensureGoalsTable(sqliteDb);

  if (getDataStoreMode() === 'postgres') {
    await ensurePostgresConsumerTables();
    const sql = getPostgresSql();
    const existingRows = await sql`
      SELECT * FROM patient_goals WHERE id = ${id} AND owner_key = ${ownerKey} LIMIT 1
    `;
    const existing = existingRows[0];
    if (!existing) return null;
    const status = patch.status != null ? String(patch.status) : existing.status;
    if (!VALID_STATUS.has(status)) throw new Error('invalid_status');
    await sql`
      UPDATE patient_goals SET status = ${status}, updated_at = NOW() WHERE id = ${id} AND owner_key = ${ownerKey}
    `;
    const rows = await sql`SELECT * FROM patient_goals WHERE id = ${id} LIMIT 1`;
    return rowToGoal(rows[0]);
  }

  const existing = sqliteDb
    .prepare(`SELECT * FROM patient_goals WHERE id = ? AND owner_key = ? LIMIT 1`)
    .get(id, ownerKey);
  if (!existing) return null;

  const status = patch.status != null ? String(patch.status) : existing.status;
  if (!VALID_STATUS.has(status)) throw new Error('invalid_status');
  const now = new Date().toISOString();

  sqliteDb
    .prepare(`UPDATE patient_goals SET status = ?, updated_at = ? WHERE id = ? AND owner_key = ?`)
    .run(status, now, id, ownerKey);
  return rowToGoal(sqliteDb.prepare(`SELECT * FROM patient_goals WHERE id = ?`).get(id));
}

async function seedDefaultGoals(sqliteDb, { patientId, sessionId, journeyModes }) {
  const modes = Array.isArray(journeyModes) ? journeyModes : [];
  const existing = await listGoals(sqliteDb, { patientId, sessionId, status: 'active' });
  if (existing.length) return existing;

  const created = [];
  if (modes.includes('watch')) {
    created.push(
      await createGoal(sqliteDb, {
        patientId,
        sessionId,
        goalType: 'keep_journal',
        source: 'onboarding',
      }),
    );
  }
  if (modes.includes('spot')) {
    created.push(
      await createGoal(sqliteDb, {
        patientId,
        sessionId,
        goalType: 'watch_spot',
        source: 'onboarding',
      }),
    );
  }
  if (modes.includes('routine')) {
    created.push(
      await createGoal(sqliteDb, {
        patientId,
        sessionId,
        goalType: 'improve_routine',
        source: 'onboarding',
      }),
    );
  }
  return created;
}

module.exports = {
  listGoals,
  createGoal,
  updateGoal,
  seedDefaultGoals,
  VALID_TYPES,
};
