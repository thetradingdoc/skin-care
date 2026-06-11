'use strict';

const Database = require('better-sqlite3');

jest.mock('../database', () => ({
  createIngredientConflictGraph: () => ({
    evaluateRoutine: () => ({
      overall: 'caution',
      conflicts: [
        {
          ingredient_a: 'retinol',
          ingredient_b: 'salicylic acid',
          verdict: 'avoid',
          severity: 'critical',
          notes: 'Do not combine same routine',
        },
      ],
      suggested_split: { am: ['Vitamin C'], pm: ['Retinol'] },
      reason_codes: ['pair_conflict'],
    }),
  }),
}));

const { evaluatePatientLineup } = require('../services/patient-routine-evaluate-service');

describe('evaluate-pair highlight product', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    const migration = require('../migrations/055_conflict_engine');
    migration.up(db);
    db.exec(`
      CREATE TABLE patient_routine_templates (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        patient_id TEXT,
        is_active INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE patient_routine_template_items (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        product_name TEXT,
        usage_time TEXT,
        step_order INTEGER DEFAULT 0,
        source_type TEXT,
        source_ref_id TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE patient_onboarding_step3_products (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        custom_product_name TEXT,
        catalog_product_id TEXT,
        category TEXT DEFAULT 'treatment',
        usage_time TEXT DEFAULT 'pm',
        key_ingredients TEXT,
        ingredients_text TEXT,
        ingredient_canonical_ids_json TEXT,
        barcode TEXT,
        inventory_status TEXT DEFAULT 'stock',
        selection_mode TEXT DEFAULT 'custom',
        goal TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
    db.prepare(`
      INSERT INTO patient_onboarding_step3_products (id, session_id, custom_product_name, ingredient_canonical_ids_json)
      VALUES ('prod-a', 'sess-1', 'Retinol 0.3%', '["retinol"]')
    `).run();
    db.prepare(`
      INSERT INTO patient_onboarding_step3_products (id, session_id, custom_product_name, ingredient_canonical_ids_json)
      VALUES ('prod-b', 'sess-1', 'BHA Toner', '["salicylic acid"]')
    `).run();
  });

  afterEach(() => {
    try {
      db.close();
    } catch (_) {}
  });

  test('highlight_product_id returns product-specific hero copy', () => {
    const result = evaluatePatientLineup(db, {
      sessionId: 'sess-1',
      highlightProductId: 'prod-a',
    });
    expect(result.success).toBe(true);
    expect(result.highlight_product_id).toBe('prod-a');
    expect(result.hero_title).toBeTruthy();
    expect(String(result.hero_subtitle || '')).toContain('Retinol');
    expect(result.product_statuses?.length).toBe(2);
  });
});
