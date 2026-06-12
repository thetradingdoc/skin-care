'use strict';

jest.mock('../services/product-identity-resolver', () => ({
  resolveProductIdentityFromBarcode: jest.fn(async () => ({
    success: true,
    normalized: { product_name: 'BHA Toner', ingredients_text: 'salicylic acid' },
  })),
}));

const mockEvaluateWithGraph = jest.fn(async () => ({
  success: true,
  lineup_hash: 'hash_scan_graph',
  overall: 'caution',
  conflicts: [],
  compatibility_score: 55,
  barrier_friction_index: 55,
}));

jest.mock('../services/consumer-analysis-graph', () => ({
  evaluateWithGraph: (...args) => mockEvaluateWithGraph(...args),
}));

const request = require('supertest');
const Database = require('better-sqlite3');
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
    INSERT INTO patient_onboarding_step3_products (
      id, session_id, custom_product_name, category, usage_time, inventory_status, updated_at,
      ingredients_text, ingredient_canonical_ids_json
    ) VALUES (
      'shelf_existing', '${sessionId}', 'Retinol Serum', 'treatment', 'pm', 'stock', datetime('now'),
      'retinol', '["retinol"]'
    );
  `);
  const migration = require('../migrations/055_conflict_engine');
  if (migration?.up) migration.up(db);
}

describe('shelf scan uses evaluateWithGraph', () => {
  const sessionId = 'sess_scan_graph';

  beforeEach(() => {
    mockEvaluateWithGraph.mockClear();
    process.env.LANGGRAPH_CONSUMER_EVAL_ROLLOUT_PCT = '1';
  });

  afterEach(() => {
    delete process.env.LANGGRAPH_CONSUMER_EVAL_ROLLOUT_PCT;
  });

  test('POST /shelf/products/scan invokes evaluateWithGraph when rollout=1', async () => {
    const db = new Database(':memory:');
    ensureSqliteConsumerTables(db);
    seedShelf(db, sessionId);
    const app = buildShelfRouteApp(db, sessionId);

    const res = await request(app)
      .post('/api/patient/shelf/products/scan')
      .send({ barcode: '0123456789012', usage_time: 'pm' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockEvaluateWithGraph).toHaveBeenCalledTimes(1);
    expect(mockEvaluateWithGraph.mock.calls[0][1]).toMatchObject({ sessionId, patientId: null });
    expect(res.body.evaluate.lineup_hash).toBe('hash_scan_graph');
    expect(res.body.evaluate.overall).toBe('caution');
    db.close();
  });
});
