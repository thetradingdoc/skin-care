'use strict';

/**
 * Discover CREATE TABLE names + whether they look patient-keyed.
 * Scans migrations/, database.js, database/, and selected service ensure-DDL.
 */

const fs = require('fs');
const path = require('path');
const {
  PATIENT_LINK_COLUMN_RE,
  EMAIL_KEYED_ACCOUNT_TABLES,
  FORCE_INCLUDE_TABLES,
} = require('../services/account-purge-table-registry');

const ROOT = path.join(__dirname, '..');

function walkJsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      walkJsFiles(p, out);
    } else if (/\.(js|cjs)$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Extract CREATE TABLE blocks; return Map<tableName, { hasPatientLink, source }>
 */
function discoverCreateTables(filePaths) {
  const found = new Map();
  const createRe =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"[]?)([a-zA-Z0-9_]+)\1\s*\(/gi;

  for (const file of filePaths) {
    let src;
    try {
      src = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    let m;
    createRe.lastIndex = 0;
    while ((m = createRe.exec(src))) {
      const name = String(m[2] || '').toLowerCase();
      if (!name || name === 'db') continue;
      // Capture body until matching close paren at depth 0 (approx: next 4k)
      const start = m.index + m[0].length;
      const slice = src.slice(start, start + 8000);
      let depth = 1;
      let end = 0;
      for (let i = 0; i < slice.length; i++) {
        const ch = slice[i];
        if (ch === '(') depth += 1;
        else if (ch === ')') {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      const body = end ? slice.slice(0, end) : slice.slice(0, 2000);
      const hasPatientLink =
        PATIENT_LINK_COLUMN_RE.test(body) ||
        EMAIL_KEYED_ACCOUNT_TABLES.has(name) ||
        FORCE_INCLUDE_TABLES.includes(name) ||
        /^patient_/.test(name);

      const rel = path.relative(ROOT, file);
      const prev = found.get(name);
      if (!prev) {
        found.set(name, { hasPatientLink, sources: [rel] });
      } else {
        prev.hasPatientLink = prev.hasPatientLink || hasPatientLink;
        if (!prev.sources.includes(rel)) prev.sources.push(rel);
      }
    }
  }
  return found;
}

function defaultScanPaths() {
  const files = [];
  walkJsFiles(path.join(ROOT, 'migrations'), files);
  walkJsFiles(path.join(ROOT, 'database'), files);
  const singles = [
    path.join(ROOT, 'database.js'),
    path.join(ROOT, 'services/patient-push-service.js'),
    path.join(ROOT, 'services/medical-tracker-domain/physician-share-links.js'),
    path.join(ROOT, 'services/vision-capture-store.js'),
    path.join(ROOT, 'db/client.js'),
  ];
  for (const f of singles) {
    if (fs.existsSync(f)) files.push(f);
  }
  return files;
}

function listPatientKeyedTables(filePaths = defaultScanPaths()) {
  const all = discoverCreateTables(filePaths);
  // Ensure force-includes appear even if CREATE was missed (still require a hit)
  for (const name of FORCE_INCLUDE_TABLES) {
    if (!all.has(name)) {
      all.set(name, { hasPatientLink: true, sources: ['FORCE_INCLUDE_TABLES'] });
    } else {
      all.get(name).hasPatientLink = true;
    }
  }
  const patientKeyed = [];
  for (const [name, meta] of [...all.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (meta.hasPatientLink) {
      patientKeyed.push({ name, sources: meta.sources });
    }
  }
  return patientKeyed;
}

module.exports = {
  discoverCreateTables,
  listPatientKeyedTables,
  defaultScanPaths,
  walkJsFiles,
};
