'use strict';

jest.mock('../services/product-identity-resolver', () => ({
  resolveProductIdentityFromBarcode: jest.fn(async () => ({
    success: true,
    normalized: { product_name: 'Niacinamide', ingredients_text: 'niacinamide' },
  })),
}));

const request = require('supertest');
const Database = require('better-sqlite3');
const { evaluateWithGraph } = require('../services/consumer-analysis-graph');
const { ensureSqliteConsumerTables } = require('../db/client');
const { buildShelfRouteApp } = require('./helpers/shelf-route-test-app');

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
      id, session_id, custom_product_name, category, usage_time, inventory_status, updated_at,
      ingredients_text, ingredient_canonical_ids_json
    ) VALUES (
      'shelf_parity_1', '${sessionId}', 'Retinol Serum', 'treatment', 'pm', 'stock', datetime('now'),
      'retinol', '["retinol"]'
    );
    INSERT INTO patient_onboarding_step3_products (
      id, session_id, custom_product_name, category, usage_time, inventory_status, updated_at,
      ingredients_text, ingredient_canonical_ids_json
    ) VALUES (
      'shelf_parity_2', '${sessionId}', 'Gentle Cleanser', 'cleanser', 'am', 'stock', datetime('now'),
      'glycerin', '["glycerin"]'
    );
  `);
  const migration = require('../migrations/055_conflict_engine');
  if (migration?.up) migration.up(db);
}

describe('consumer eval routes parity', () => {
  const sessionId = 'sess_route_parity';

  beforeEach(() => {
    process.env.LANGGRAPH_CONSUMER_EVAL_ROLLOUT_PCT = '1';
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    delete process.env.LANGGRAPH_CONSUMER_EVAL_ROLLOUT_PCT;
  });

  test('evaluateWithGraph consistent across highlight and session', async () => {
    const db = new Database(':memory:');
    ensureSqliteConsumerTables(db);
    seedShelf(db, sessionId);

    const base = await evaluateWithGraph(db, { sessionId, patientId: null });
    const highlighted = await evaluateWithGraph(db, {
      sessionId,
      patientId: null,
      highlightProductId: 'shelf_parity_1',
    });

    expect(base.success).toBe(highlighted.success);
    if (base.success) {
      expect(base.lineup_hash).toBe(highlighted.lineup_hash);
      expect(base.overall).toBe(highlighted.overall);
    }
    db.close();
  });

  test('evaluate-pair and layering-check return matching lineup_hash + overall', async () => {
    const db = new Database(':memory:');
    ensureSqliteConsumerTables(db);
    seedShelf(db, sessionId);
    const app = buildShelfRouteApp(db, sessionId);

    const pairRes = await request(app)
      .post('/api/patient/shelf/evaluate-pair')
      .send({ product_ids: ['shelf_parity_1', 'shelf_parity_2'], highlight_product_id: 'shelf_parity_1' });

    const layerRes = await request(app).get('/api/patient/routine/layering-check');

    expect(pairRes.status).toBe(200);
    expect(layerRes.status).toBe(200);
    expect(pairRes.body.overall).toBe(layerRes.body.overall);
    expect(pairRes.body.compatibility_score).toBe(layerRes.body.compatibility_score);
    expect(pairRes.body.lineup_hash).toBeTruthy();
    db.close();
  });

  test('scan POST returns evaluate with lineup_hash + overall via graph path', async () => {
    const db = new Database(':memory:');
    ensureSqliteConsumerTables(db);
    seedShelf(db, sessionId);
    const app = buildShelfRouteApp(db, sessionId);

    const scanRes = await request(app)
      .post('/api/patient/shelf/products/scan')
      .send({ barcode: '9998887776665', usage_time: 'am' });

    expect(scanRes.status).toBe(200);
    expect(scanRes.body.evaluate.success).toBe(true);
    expect(typeof scanRes.body.evaluate.lineup_hash).toBe('string');
    expect(scanRes.body.evaluate.overall).toBeTruthy();
    db.close();
  });
});
