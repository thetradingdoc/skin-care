'use strict';

const Database = require('better-sqlite3');
const { evaluatePatientLineup } = require('../services/patient-routine-evaluate-service');
const { evaluateWithGraph } = require('../services/consumer-analysis-graph');
const { ensureSqliteConsumerTables } = require('../db/client');

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

describe('consumer eval graph parity', () => {
  test('graph path matches legacy evaluate for minimal lineup', async () => {
    const db = new Database(':memory:');
    ensureSqliteConsumerTables(db);
    const sessionId = 'sess_parity';
    seedMinimalShelf(db, sessionId);
    process.env.LANGGRAPH_CONSUMER_EVAL_ROLLOUT_PCT = '0';

    const legacy = evaluatePatientLineup(db, { sessionId, patientId: null });
    const graph = await evaluateWithGraph(db, { sessionId, patientId: null });

    expect(graph.success).toBe(legacy.success);
    if (legacy.success) {
      expect(graph.overall).toBe(legacy.overall);
      expect(graph.lineup_hash).toBe(legacy.lineup_hash);
    }
    db.close();
  });

  test('graph path with rollout=1 matches legacy evaluate', async () => {
    const db = new Database(':memory:');
    ensureSqliteConsumerTables(db);
    const sessionId = 'sess_parity_rollout';
    seedMinimalShelf(db, sessionId);
    process.env.LANGGRAPH_CONSUMER_EVAL_ROLLOUT_PCT = '1';

    const legacy = evaluatePatientLineup(db, { sessionId, patientId: null });
    const graph = await evaluateWithGraph(db, { sessionId, patientId: null });

    expect(graph.success).toBe(legacy.success);
    if (legacy.success) {
      expect(graph.overall).toBe(legacy.overall);
      expect(graph.lineup_hash).toBe(legacy.lineup_hash);
    }
    db.close();
  });
});
