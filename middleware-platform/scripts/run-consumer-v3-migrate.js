#!/usr/bin/env node
'use strict';

/**
 * Apply consumer v3 Postgres DDL. Safe to run multiple times (IF NOT EXISTS).
 * Usage: POSTGRES_URL=... node scripts/run-consumer-v3-migrate.js
 */
const { ensurePostgresConsumerTables, isPostgresEnabled } = require('../db/client');

async function main() {
  if (!isPostgresEnabled()) {
    console.log('POSTGRES_URL not set — skipping Postgres consumer v3 migration (SQLite fallback used locally).');
    process.exit(0);
  }
  await ensurePostgresConsumerTables();
  console.log('✅ Consumer v3 Postgres tables ensured');
}

main().catch((e) => {
  console.error('❌ Consumer v3 migration failed:', e.message);
  process.exit(1);
});
