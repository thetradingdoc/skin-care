'use strict';

const db = require('../database');
const { isIsoDateOnly } = require('./patient-portal-shared');

function ensurePatientShelfTable() {
  db.db.exec(`
    CREATE TABLE IF NOT EXISTS patient_onboarding_step3_products (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      patient_id TEXT,
      selection_mode TEXT NOT NULL DEFAULT 'custom',
      catalog_product_id TEXT,
      custom_product_name TEXT,
      custom_brand TEXT,
      custom_pending_enrichment INTEGER DEFAULT 0,
      fallback_reason TEXT,
      category TEXT NOT NULL DEFAULT 'treatment',
      usage_time TEXT NOT NULL DEFAULT 'pm',
      frequency_rule TEXT,
      days_of_week_json TEXT,
      goal TEXT NOT NULL DEFAULT 'general',
      flags_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_step3_products_session ON patient_onboarding_step3_products(session_id);
  `);
}

function ensurePatientShelfInventoryColumns() {
  ensurePatientShelfTable();
  const addCol = (sql) => {
    try {
      db.db.prepare(sql).run();
    } catch (_) {}
  };
  addCol('ALTER TABLE patient_onboarding_step3_products ADD COLUMN opened_date TEXT');
  addCol('ALTER TABLE patient_onboarding_step3_products ADD COLUMN expiry_date TEXT');
  addCol('ALTER TABLE patient_onboarding_step3_products ADD COLUMN pao_months INTEGER');
  addCol("ALTER TABLE patient_onboarding_step3_products ADD COLUMN inventory_status TEXT DEFAULT 'stock'");
  addCol('ALTER TABLE patient_onboarding_step3_products ADD COLUMN price_usd REAL');
  addCol('ALTER TABLE patient_onboarding_step3_products ADD COLUMN key_ingredients TEXT');
  addCol('ALTER TABLE patient_onboarding_step3_products ADD COLUMN display_color TEXT');
  addCol('ALTER TABLE patient_onboarding_step3_products ADD COLUMN ingredient_canonical_ids_json TEXT');
  addCol('ALTER TABLE patient_onboarding_step3_products ADD COLUMN barcode TEXT');
  addCol('ALTER TABLE patient_onboarding_step3_products ADD COLUMN ingredients_text TEXT');
  addCol("ALTER TABLE patient_onboarding_step3_products ADD COLUMN verdict_status TEXT DEFAULT 'unknown'");
  addCol('ALTER TABLE patient_onboarding_step3_products ADD COLUMN kept_despite_conflict INTEGER DEFAULT 0');
}

function formatShelfProductApiRow(r) {
  const { safeParseJsonArray } = require('./patient-portal-shared');
  return {
    id: r.id,
    product_name: r.custom_product_name || r.product_name || 'Product',
    selection_mode: r.selection_mode,
    catalog_product_id: r.catalog_product_id,
    custom_brand: r.custom_brand,
    category: r.category,
    usage_time: r.usage_time,
    frequency_rule: r.frequency_rule,
    days_of_week: safeParseJsonArray(r.days_of_week_json),
    goal: r.goal,
    opened_date: r.opened_date,
    expiry_date: r.expiry_date,
    pao_months: r.pao_months,
    inventory_status: r.inventory_status,
    price_usd: r.price_usd,
    key_ingredients: r.key_ingredients,
    display_color: r.display_color,
    updated_at: r.updated_at,
  };
}

function loadPatientShelfProductRows(sessionId) {
  ensurePatientShelfInventoryColumns();
  return db.db
    .prepare(`
      SELECT id, selection_mode, catalog_product_id, custom_product_name, custom_brand, category, usage_time,
        frequency_rule, days_of_week_json, goal, opened_date, expiry_date, pao_months, inventory_status,
        price_usd, key_ingredients, display_color, updated_at
      FROM patient_onboarding_step3_products
      WHERE session_id = ?
      ORDER BY datetime(updated_at) DESC
    `)
    .all(sessionId);
}

module.exports = {
  ensurePatientShelfTable,
  ensurePatientShelfInventoryColumns,
  formatShelfProductApiRow,
  loadPatientShelfProductRows,
};
