'use strict';

const Database = require('better-sqlite3');
const { updateGoal, createGoal } = require('../repositories/patient-goals-repo');

jest.mock('../db/client', () => {
  const goals = new Map();
  return {
    getDataStoreMode: () => 'postgres',
    ensurePostgresConsumerTables: jest.fn(async () => {}),
    resolveOwnerKey: ({ sessionId, patientId }) => patientId || sessionId,
    getPostgresSql: () => {
      const sql = (strings, ...values) => {
        const query = strings.join('?');
        if (query.includes('INSERT INTO patient_goals')) {
          const row = {
            id: values[0],
            owner_key: values[1],
            goal_type: values[2],
            target_ref: values[3],
            status: 'active',
            source: values[4],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          goals.set(row.id, row);
          return Promise.resolve([]);
        }
        if (query.includes('SELECT * FROM patient_goals WHERE id =') && query.includes('owner_key')) {
          const id = values[0];
          const owner = values[1];
          const row = goals.get(id);
          return Promise.resolve(row && row.owner_key === owner ? [row] : []);
        }
        if (query.includes('UPDATE patient_goals')) {
          const status = values[0];
          const id = values[1];
          const owner = values[2];
          const row = goals.get(id);
          if (row && row.owner_key === owner) {
            row.status = status;
            row.updated_at = new Date().toISOString();
          }
          return Promise.resolve([]);
        }
        if (query.includes('SELECT * FROM patient_goals WHERE id =') && !query.includes('owner_key')) {
          const id = values[0];
          const row = goals.get(id);
          return Promise.resolve(row ? [row] : []);
        }
        return Promise.resolve([]);
      };
      return sql;
    },
  };
});

describe('patient-goals-repo postgres', () => {
  let sqliteDb;

  beforeEach(() => {
    sqliteDb = new Database(':memory:');
    require('../migrations/057_patient_goals').up(sqliteDb);
  });

  afterEach(() => {
    sqliteDb.close();
  });

  test('updateGoal patches status in postgres mode', async () => {
    const created = await createGoal(sqliteDb, {
      sessionId: 'sess_pg_1',
      patientId: null,
      goalType: 'watch_spot',
    });
    const updated = await updateGoal(sqliteDb, {
      sessionId: 'sess_pg_1',
      patientId: null,
      goalId: created.id,
      patch: { status: 'dismissed' },
    });
    expect(updated.status).toBe('dismissed');
  });
});
