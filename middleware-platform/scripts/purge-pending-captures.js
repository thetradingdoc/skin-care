'use strict';

/**
 * P2.26 — Purge expired unclaimed pending captures (+ anonymous facts).
 * Usage: node scripts/purge-pending-captures.js
 */

const path = require('path');

function main() {
  // Prefer shared db when server modules available; else open SQLITE_PATH / default
  let dbHandle;
  try {
    const database = require('../database');
    dbHandle = database.db || database;
  } catch (_) {
    const Database = require('better-sqlite3');
    const dbPath =
      process.env.SQLITE_PATH ||
      path.join(__dirname, '..', 'data', 'skinandcare.db');
    dbHandle = new Database(dbPath);
  }

  const sqlite = dbHandle.prepare ? dbHandle : dbHandle.db;
  if (!sqlite || typeof sqlite.prepare !== 'function') {
    console.error('Could not resolve sqlite handle');
    process.exit(1);
  }

  const { purgeExpiredPendingCaptures } = require('../services/pending-capture-claim');
  const result = purgeExpiredPendingCaptures(sqlite);
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main();
