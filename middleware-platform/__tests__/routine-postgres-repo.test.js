'use strict';

const Database = require('better-sqlite3');
const { getActiveRoutineTemplate, shouldPreferPostgres } = require('../repositories/routine-postgres-repo');
const { ensureSqliteConsumerTables } = require('../db/client');

describe('routine-postgres-repo sqlite fallback', () => {
  test('reads template from sqlite when postgres disabled', async () => {
    delete process.env.POSTGRES_URL;
    delete process.env.DATA_STORE;
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE patient_routine_templates (
        id TEXT PRIMARY KEY, session_id TEXT, patient_id TEXT, name TEXT,
        concern_id TEXT, start_date TEXT, program_week INTEGER, duration_weeks INTEGER,
        metadata_json TEXT, is_active INTEGER, created_at TEXT, updated_at TEXT
      );
      INSERT INTO patient_routine_templates (id, session_id, name, is_active, updated_at)
      VALUES ('tpl_1', 'sess_r', 'Test', 1, datetime('now'));
    `);
    const row = await getActiveRoutineTemplate(db, { sessionId: 'sess_r' });
    expect(row?.id).toBe('tpl_1');
    expect(shouldPreferPostgres()).toBe(false);
    db.close();
  });
});
