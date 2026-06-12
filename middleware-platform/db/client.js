'use strict';

const fs = require('fs');
const path = require('path');
const { createPool } = require('../utils/postgres');

let postgresSql = null;
let postgresReady = false;

function isPostgresEnabled() {
  return Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL);
}

function getDataStoreMode() {
  if (process.env.DATA_STORE === 'sqlite') return 'sqlite';
  if (isPostgresEnabled()) return 'postgres';
  return 'sqlite';
}

function getPostgresSql() {
  if (!isPostgresEnabled()) return null;
  if (!postgresSql) {
    postgresSql = createPool();
  }
  return postgresSql;
}

async function ensurePostgresConsumerTables() {
  if (!isPostgresEnabled() || postgresReady) return;
  const sql = getPostgresSql();
  for (const file of ['0001_consumer_v3.sql', '0002_routine_port.sql', '0003_patient_goals.sql']) {
    const migrationPath = path.join(__dirname, 'migrations', file);
    if (fs.existsSync(migrationPath)) {
      const ddl = fs.readFileSync(migrationPath, 'utf8');
      await sql.unsafe(ddl);
    }
  }
  postgresReady = true;
}

function ensureSqliteConsumerTables(sqliteDb) {
  const migration = require('../migrations/056_consumer_v3');
  if (migration?.up) migration.up(sqliteDb);
}

function resolveOwnerKey({ patientId, sessionId }) {
  const pid = patientId != null ? String(patientId).trim() : '';
  const sid = sessionId != null ? String(sessionId).trim() : '';
  return pid || sid || '';
}

module.exports = {
  isPostgresEnabled,
  getDataStoreMode,
  getPostgresSql,
  ensurePostgresConsumerTables,
  ensureSqliteConsumerTables,
  resolveOwnerKey,
};
