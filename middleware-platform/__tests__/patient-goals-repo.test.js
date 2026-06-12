'use strict';

const Database = require('better-sqlite3');
const { listGoals, createGoal, updateGoal, seedDefaultGoals } = require('../repositories/patient-goals-repo');

describe('patient-goals-repo', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    const migration = require('../migrations/057_patient_goals');
    migration.up(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch (_) {}
  });

  test('creates and lists goals', async () => {
    const goal = await createGoal(db, {
      sessionId: 'sess_goals_1',
      patientId: null,
      goalType: 'watch_spot',
      source: 'user',
    });
    expect(goal.goal_type).toBe('watch_spot');
    const goals = await listGoals(db, { sessionId: 'sess_goals_1', status: 'active' });
    expect(goals.length).toBe(1);
  });

  test('updateGoal dismisses goal', async () => {
    const created = await createGoal(db, {
      sessionId: 'sess_update_1',
      goalType: 'watch_spot',
    });
    const updated = await updateGoal(db, {
      sessionId: 'sess_update_1',
      goalId: created.id,
      patch: { status: 'dismissed' },
    });
    expect(updated.status).toBe('dismissed');
  });

  test('seedDefaultGoals creates watch and routine goals', async () => {
    const created = await seedDefaultGoals(db, {
      sessionId: 'sess_seed_1',
      journeyModes: ['watch', 'routine'],
    });
    expect(created.length).toBe(2);
    const again = await seedDefaultGoals(db, {
      sessionId: 'sess_seed_1',
      journeyModes: ['watch', 'routine'],
    });
    expect(again.length).toBe(2);
  });
});
