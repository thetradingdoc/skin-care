'use strict';

const Database = require('better-sqlite3');
const { ensureSqliteConsumerTables } = require('../db/client');
const { seedDefaultGoals } = require('../repositories/patient-goals-repo');
const { getNextActions } = require('../services/consumer-journey-agent');

function seedMinimalShelf(db, sessionId) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS patient_onboarding_step3_products (
      id TEXT PRIMARY KEY, session_id TEXT, patient_id TEXT, selection_mode TEXT,
      catalog_product_id TEXT, custom_product_name TEXT, category TEXT, usage_time TEXT,
      goal TEXT, ingredients_text TEXT, barcode TEXT, ingredient_canonical_ids_json TEXT,
      key_ingredients TEXT, inventory_status TEXT, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS patient_routine_templates (
      id TEXT PRIMARY KEY, session_id TEXT, patient_id TEXT, name TEXT, concern_id TEXT,
      start_date TEXT, program_week INTEGER, duration_weeks INTEGER, metadata_json TEXT,
      is_active INTEGER, created_at TEXT, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS patient_bio_profiles (
      id TEXT PRIMARY KEY, session_id TEXT, patient_id TEXT, conditions_json TEXT,
      prescriptions_json TEXT, sensitivity TEXT, fitzpatrick TEXT, zip TEXT,
      profile_complete INTEGER, created_at TEXT, updated_at TEXT
    );
    INSERT INTO patient_onboarding_step3_products (
      id, session_id, custom_product_name, category, usage_time, inventory_status, updated_at
    ) VALUES ('shelf_1', '${sessionId}', 'Gentle Cleanser', 'cleanser', 'am', 'stock', datetime('now'));
  `);
  const migration = require('../migrations/055_conflict_engine');
  if (migration?.up) migration.up(db);
}

describe('home next-actions', () => {
  let db;
  const sessionId = 'sess_next_actions';

  beforeEach(() => {
    db = new Database(':memory:');
    ensureSqliteConsumerTables(db);
    const migration = require('../migrations/057_patient_goals');
    if (migration?.up) migration.up(db);
    seedMinimalShelf(db, sessionId);
    process.env.NEXT_GEN_PIPELINE = '0';
    delete process.env.POSTGRES_URL;
  });

  afterEach(() => {
    db.close();
  });

  test('getNextActions returns rule-based actions when pipeline off', async () => {
    await seedDefaultGoals(db, {
      sessionId,
      patientId: null,
      journeyModes: ['watch'],
      primaryMode: 'watch',
    });

    const result = await getNextActions(db, {
      sessionId,
      patientId: null,
      loadShelfRows: () => [],
    });

    expect(result.actions).toBeDefined();
    expect(Array.isArray(result.actions)).toBe(true);
    expect(result.actions.some((a) => a.type === 'track_spot')).toBe(true);
    expect(result.actions[0]).toMatchObject({
      title: expect.any(String),
      message: expect.any(String),
      route: expect.any(String),
      priority: expect.any(Number),
    });
  });
});
