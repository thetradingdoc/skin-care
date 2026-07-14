'use strict';

/**
 * TOUCH-073–076 / 105–106 — Shopify commerce bridge tables.
 */

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS shopify_order_dead_letters (
      id TEXT PRIMARY KEY,
      shopify_order_id TEXT NOT NULL,
      email TEXT,
      payload_json TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_shopify_dl_email ON shopify_order_dead_letters(email);
    CREATE INDEX IF NOT EXISTS idx_shopify_dl_order ON shopify_order_dead_letters(shopify_order_id);
    CREATE INDEX IF NOT EXISTS idx_shopify_dl_unresolved
      ON shopify_order_dead_letters(reason) WHERE resolved_at IS NULL;

    CREATE TABLE IF NOT EXISTS shopify_variant_product_map (
      shopify_variant_id TEXT PRIMARY KEY,
      sku TEXT,
      catalog_product_id TEXT,
      product_name TEXT NOT NULL,
      product_handle TEXT,
      brand TEXT,
      ingredients_text TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shopify_orders (
      id TEXT PRIMARY KEY,
      shopify_order_id TEXT NOT NULL UNIQUE,
      email TEXT,
      patient_id TEXT,
      session_id TEXT,
      app_member INTEGER NOT NULL DEFAULT 0,
      financial_status TEXT,
      payload_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_shopify_orders_email ON shopify_orders(email);
    CREATE INDEX IF NOT EXISTS idx_shopify_orders_patient ON shopify_orders(patient_id);

    CREATE TABLE IF NOT EXISTS shopify_order_line_items (
      id TEXT PRIMARY KEY,
      shopify_order_id TEXT NOT NULL,
      shopify_variant_id TEXT,
      sku TEXT,
      title TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      shelf_product_id TEXT,
      mapped INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_shopify_lines_order ON shopify_order_line_items(shopify_order_id);
  `);
}

module.exports = { id: '063_shopify_commerce', up };
