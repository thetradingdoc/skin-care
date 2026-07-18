#!/usr/bin/env node
'use strict';

/**
 * AZ-01 — Read-only inventory of Azure media refs in SQLite + codebase write sites.
 *
 * Usage:
 *   DB_PATH=/path/to.db node scripts/inventory-azure-media-refs.cjs
 *   node scripts/inventory-azure-media-refs.cjs /path/to.db
 *
 * Exit 0 even when counts > 0 (inventory proof, not a fail gate).
 * Exit 2 only when DB path is missing / unreadable.
 */

const fs = require('fs');
const path = require('path');

const AZURE_LIKE = /azure:\/\/|blob\.core\.windows\.net/i;

/** Tables / columns likely to hold storage_ref or media URLs. */
const TABLE_COLUMN_CANDIDATES = [
  {
    table: 'patient_record_facts',
    columns: ['storage_ref', 'storage_key', 'structured_json', 'fields_json', 'raw_json'],
  },
  {
    table: 'patient_journal_entries',
    columns: ['photo_storage_ref', 'storage_ref', 'photo_url'],
  },
  {
    table: 'patient_spot_snapshots',
    columns: ['storage_ref', 'thumb_storage_ref'],
  },
  {
    table: 'patient_spots',
    columns: ['storage_ref', 'photo_url'],
  },
  {
    table: 'pending_captures',
    columns: ['fact_ids_json', 'payload_json', 'media_json', 'storage_ref'],
  },
  {
    table: 'patient_record_media_tokens',
    columns: ['storage_ref'],
  },
];

const ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(__dirname, '..', '..');

function resolveDbPath() {
  const fromEnv = process.env.DB_PATH && String(process.env.DB_PATH).trim();
  const fromArg = process.argv[2] && !String(process.argv[2]).startsWith('-')
    ? String(process.argv[2]).trim()
    : '';
  return fromEnv || fromArg || '';
}

function tableExists(db, table) {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(table);
  return !!row;
}

function tableColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

function countAzureInColumn(db, table, column) {
  // LIKE is case-insensitive for ASCII under default SQLite collation for this inventory.
  const sql = `
    SELECT COUNT(*) AS n FROM ${table}
    WHERE CAST(${column} AS TEXT) LIKE '%azure://%'
       OR CAST(${column} AS TEXT) LIKE '%blob.core.windows.net%'
  `;
  try {
    return db.prepare(sql).get().n;
  } catch (_) {
    return null;
  }
}

function inventoryDb(dbPath) {
  const Database = require('better-sqlite3');
  const db = new Database(dbPath, { readonly: true });
  const tables = {};
  let total_azure_like_rows = 0;

  try {
    for (const spec of TABLE_COLUMN_CANDIDATES) {
      if (!tableExists(db, spec.table)) {
        tables[spec.table] = { present: false, columns: {}, row_hits: 0 };
        continue;
      }
      const cols = tableColumns(db, spec.table);
      const columns = {};
      let rowHits = 0;
      for (const col of spec.columns) {
        if (!cols.includes(col)) {
          columns[col] = { present: false, count: 0 };
          continue;
        }
        const count = countAzureInColumn(db, spec.table, col) || 0;
        columns[col] = { present: true, count };
        rowHits += count;
      }
      tables[spec.table] = { present: true, columns, row_hits: rowHits };
      total_azure_like_rows += rowHits;
    }
  } finally {
    db.close();
  }

  return { db_path: path.resolve(dbPath), tables, total_azure_like_rows };
}

function walkJsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'coverage' || name === 'dist') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkJsFiles(p, out);
    else if (/\.(js|cjs|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

/**
 * Heuristic "write sites": lines that construct/assign azure:// refs
 * (template literals / string assigns), not mere readers/parsers.
 */
function inventoryCodeWriteSites() {
  const scanRoots = [
    path.join(ROOT, 'services'),
    path.join(ROOT, 'routes'),
    path.join(ROOT, 'repositories'),
    path.join(ROOT, 'lib'),
  ];
  const writeRe =
    /(?:storage_ref\s*[:=]|return\s+`azure:\/\/|`azure:\/\/|['"]azure:\/\/)/;
  const refs = [];
  for (const root of scanRoots) {
    for (const file of walkJsFiles(root)) {
      const src = fs.readFileSync(file, 'utf8');
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        if (!AZURE_LIKE.test(line)) return;
        if (!writeRe.test(line) && !/`azure:\/\//.test(line)) return;
        // Skip pure parse/read helpers
        if (/startsWith\s*\(\s*['"]azure:\/\//.test(line)) return;
        if (/slice\s*\(\s*['"]azure:\/\//.test(line)) return;
        if (/\/\//.test(line.trimStart()) && line.trimStart().startsWith('//')) return;
        refs.push({
          file: path.relative(REPO_ROOT, file).replace(/\\/g, '/'),
          line: i + 1,
          snippet: line.trim().slice(0, 140),
        });
      });
    }
  }
  return refs;
}

function main() {
  const dbPath = resolveDbPath();
  if (!dbPath || !fs.existsSync(dbPath)) {
    console.error(
      'Usage: DB_PATH=/path/to.db node scripts/inventory-azure-media-refs.cjs\n' +
        '   or: node scripts/inventory-azure-media-refs.cjs /path/to.db',
    );
    process.exit(2);
  }

  const dbInventory = inventoryDb(dbPath);
  const code_refs = inventoryCodeWriteSites();

  const summary = {
    ok: true,
    inventory: 'az-01-azure-media',
    note: 'Read-only inventory; exit 0 even when counts > 0. Prod inventory still needs an ops run against production DB before AZ-06.',
    db: dbInventory,
    code_refs: {
      count: code_refs.length,
      refs: code_refs,
    },
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

if (require.main === module) main();

module.exports = {
  inventoryDb,
  inventoryCodeWriteSites,
  TABLE_COLUMN_CANDIDATES,
  main,
};
