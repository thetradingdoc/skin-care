'use strict';

const Database = require('better-sqlite3');
const {
  buildRoutineStepStates,
  overallToScore,
  perProductStatus,
} = require('../services/patient-routine-evaluate-service');

describe('patient-routine-evaluate-service', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
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
        goal TEXT,
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
        category TEXT,
        usage_time TEXT,
        ingredient_canonical_ids_json TEXT,
        inventory_status TEXT DEFAULT 'stock'
      );
      CREATE TABLE patient_routine_daily_entries (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        entry_date TEXT NOT NULL
      );
      CREATE TABLE patient_routine_daily_item_logs (
        id TEXT PRIMARY KEY,
        daily_entry_id TEXT NOT NULL,
        template_item_id TEXT NOT NULL,
        completed INTEGER DEFAULT 0
      );
    `);
  });

  afterEach(() => {
    try {
      db.close();
    } catch (_) {}
  });

  test('overallToScore maps avoid/caution/safe with BFI', () => {
    expect(overallToScore('safe', 90)).toBeGreaterThan(80);
    expect(overallToScore('avoid', 40)).toBeLessThan(40);
    expect(overallToScore('caution', 70)).toBeGreaterThan(40);
  });

  test('buildRoutineStepStates warns on low barrier + active step', () => {
    db.prepare(`INSERT INTO patient_routine_templates (id, session_id, is_active) VALUES ('tpl', 'sess', 1)`).run();
    db.prepare(`
      INSERT INTO patient_routine_template_items (id, template_id, product_name, usage_time, step_order, is_active)
      VALUES ('item-1', 'tpl', 'Retinol serum', 'pm', 1, 1)
    `).run();

    const states = buildRoutineStepStates(db, {
      sessionId: 'sess',
      patientId: null,
      slots: [{ time: 'pm', steps: [{ product_name: 'Retinol serum', ingredient_ids: ['retinol'] }] }],
      conflicts: [],
      bfi: 55,
    });

    expect(states.length).toBe(1);
    expect(states[0].state).toBe('warn');
    expect(states[0].sub).toContain('barrier score too low');
  });

  test('buildRoutineStepStates marks completed steps as done', () => {
    const todayIso = new Date().toISOString().slice(0, 10);
    db.prepare(`INSERT INTO patient_routine_templates (id, session_id, is_active) VALUES ('tpl', 'sess', 1)`).run();
    db.prepare(`
      INSERT INTO patient_routine_template_items (id, template_id, product_name, usage_time, step_order, is_active)
      VALUES ('item-1', 'tpl', 'Gentle cleanser', 'am', 1, 1)
    `).run();
    db.prepare(`INSERT INTO patient_routine_daily_entries (id, template_id, entry_date) VALUES ('entry-1', 'tpl', ?)`).run(
      todayIso
    );
    db.prepare(`
      INSERT INTO patient_routine_daily_item_logs (id, daily_entry_id, template_item_id, completed)
      VALUES ('log-1', 'entry-1', 'item-1', 1)
    `).run();

    const states = buildRoutineStepStates(db, {
      sessionId: 'sess',
      patientId: null,
      slots: [{ time: 'am', steps: [{ product_name: 'Gentle cleanser', ingredient_ids: [] }] }],
      conflicts: [],
      bfi: 80,
    });

    expect(states[0].state).toBe('done');
  });

  test('perProductStatus returns watch for cleanser without conflicts', () => {
    const status = perProductStatus(
      { conflicts: [] },
      {
        category: 'cleanser',
        custom_product_name: 'Gentle wash',
        ingredient_canonical_ids_json: '["salicylic acid"]',
      }
    );
    expect(status).toBe('watch');
  });
});
