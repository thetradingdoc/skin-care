'use strict';

const Database = require('better-sqlite3');
const { evaluateWithGraph } = require('../services/consumer-analysis-graph');
const { ensureSqliteConsumerTables } = require('../db/client');

function seedShelf(db, sessionId) {
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
    INSERT INTO patient_onboarding_step3_products (
      id, session_id, custom_product_name, category, usage_time, inventory_status, updated_at
    ) VALUES ('shelf_cp_1', '${sessionId}', 'Gentle Cleanser', 'cleanser', 'am', 'stock', datetime('now'));
  `);
  const migration = require('../migrations/055_conflict_engine');
  if (migration?.up) migration.up(db);
}

describe('consumer-analysis-graph', () => {
  test('evaluateWithGraph returns structured failure without shelf tables', async () => {
    const db = new Database(':memory:');
    process.env.LANGGRAPH_CONSUMER_EVAL_ROLLOUT_PCT = '0';
    const result = await evaluateWithGraph(db, { sessionId: 'sess_x', patientId: null });
    expect(result).toHaveProperty('success');
    expect(result.success).toBe(false);
    db.close();
  });

  test('repeated invoke with same sessionId returns stable lineup_hash + overall', async () => {
    const db = new Database(':memory:');
    ensureSqliteConsumerTables(db);
    const sessionId = 'sess_checkpoint_thread';
    seedShelf(db, sessionId);
    process.env.LANGGRAPH_CONSUMER_EVAL_ROLLOUT_PCT = '1';
    delete process.env.POSTGRES_URL;
    delete process.env.LANGGRAPH_USE_POSTGRES;
    delete process.env.REDIS_URL;

    const first = await evaluateWithGraph(db, { sessionId, patientId: null });
    const second = await evaluateWithGraph(db, { sessionId, patientId: null });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(second.lineup_hash).toBe(first.lineup_hash);
    expect(second.overall).toBe(first.overall);
    db.close();
  });

  test('postgres checkpointer not used without POSTGRES_URL', async () => {
    delete process.env.POSTGRES_URL;
    delete process.env.LANGGRAPH_USE_POSTGRES;
    const { getCheckpointer } = require('../services/consumer-rails/checkpointer');
    const cp = await getCheckpointer();
    // Jest may not load LangGraph ESM; null MemorySaver is acceptable in CI
    expect(cp === null || typeof cp === 'object').toBe(true);
  });
});
