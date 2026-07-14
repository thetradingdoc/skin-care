#!/usr/bin/env node
'use strict';

/**
 * TASK 0 — Sync the repo-local middleware-dev.db fixture to Phase 3 schema.
 *
 * Approach (b): regenerate/apply schema onto the workspace fixture.
 *
 * Why not (a) change database.js to always open the repo file?
 * - resolveDbPath() prefers $HOME/middleware-dev.db when HOME is writable; that is
 *   intentional for this machine. Docs (ENV_AND_DB_SSOT.md) already tell operators
 *   to set DB_PATH=./middleware-dev.db when they want the workspace file.
 * - The repo file is gitignored (middleware-platform/*.db) — a local fixture, not a
 *   checked-in artifact. Drift happens because nothing opened that path after
 *   Phase 3 migrations shipped (lazy ensure-on-route-hit only mutates whatever
 *   database.js opens, usually HOME).
 *
 * This script NEVER writes the external runtime DB. Default target is the
 * workspace fixture next to this package.
 *
 * Usage:
 *   node scripts/sync-repo-dev-db-schema.js
 *   DB_PATH=./middleware-dev.db node scripts/sync-repo-dev-db-schema.js
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..');
const DEFAULT_FIXTURE = path.join(ROOT, 'middleware-dev.db');
const target = process.env.DB_PATH
  ? path.resolve(process.cwd(), process.env.DB_PATH)
  : DEFAULT_FIXTURE;

const RUNTIME_HINT = path.join(process.env.HOME || '', 'middleware-dev.db');
if (path.resolve(target) === path.resolve(RUNTIME_HINT)) {
  console.error('❌ Refusing to mutate presumed runtime HOME DB. Point DB_PATH at the repo fixture.');
  process.exit(1);
}

if (!fs.existsSync(target)) {
  console.error(`❌ Fixture missing: ${target}`);
  process.exit(1);
}

function hasCol(db, table, col) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
}

function hasTable(db, name) {
  return !!db.prepare(`SELECT 1 AS x FROM sqlite_master WHERE type='table' AND name=?`).get(name);
}

const db = new Database(target);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Sync repo middleware-dev.db Phase 3 schema');
console.log('Target:', target);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

console.log('\nBEFORE');
console.log('  patient_allergen_exclusions:', hasTable(db, 'patient_allergen_exclusions'));
console.log(
  '  cost_per_use:',
  hasTable(db, 'patient_onboarding_step3_products') &&
    hasCol(db, 'patient_onboarding_step3_products', 'cost_per_use'),
);
console.log(
  '  expiry_date:',
  hasTable(db, 'patient_onboarding_step3_products') &&
    hasCol(db, 'patient_onboarding_step3_products', 'expiry_date'),
);
console.log(
  '  procedure_date:',
  hasTable(db, 'patient_bio_profiles') && hasCol(db, 'patient_bio_profiles', 'procedure_date'),
);

require('../migrations/061_patient_allergen_exclusions').up(db);
require('../migrations/062_bio_procedure_safe_mode').up(db);
require('../migrations/064_bio_budget_climate').up(db);

// Shelf inventory columns (same SQL as lib/patient-shelf-api ensure — without loading database.js)
db.exec(`
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
`);
const addCol = (sql) => {
  try {
    db.prepare(sql).run();
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
addCol('ALTER TABLE patient_onboarding_step3_products ADD COLUMN cost_per_use REAL');

console.log('\nAFTER');
console.log('  patient_allergen_exclusions:', hasTable(db, 'patient_allergen_exclusions'));
console.log('  cost_per_use:', hasCol(db, 'patient_onboarding_step3_products', 'cost_per_use'));
console.log('  expiry_date:', hasCol(db, 'patient_onboarding_step3_products', 'expiry_date'));
console.log('  procedure_date:', hasCol(db, 'patient_bio_profiles', 'procedure_date'));
console.log('  procedure_type:', hasCol(db, 'patient_bio_profiles', 'procedure_type'));
console.log(
  '  procedure_recovery_days:',
  hasCol(db, 'patient_bio_profiles', 'procedure_recovery_days'),
);

db.close();
console.log('\n✅ Repo fixture schema synced (runtime HOME DB untouched).');
