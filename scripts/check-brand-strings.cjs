#!/usr/bin/env node
'use strict';

/**
 * Fail CI when banned legacy brand strings appear in user-facing UI paths.
 * Bans "Somo" in unified-dashboard, middleware-platform/public, patient-app.
 * Allows infra identifiers (api.callsomo.com, env vars, comments).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const SCAN_DIRS = [
  path.join(ROOT, 'unified-dashboard'),
  path.join(ROOT, 'middleware-platform', 'public'),
  path.join(ROOT, 'patient-app'),
];

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'hosting-dist',
  '.git',
  'playwright-report',
  'test-results',
  '_archive',
]);

const EXT = new Set(['.html', '.css', '.js', '.jsx', '.json', '.webmanifest', '.tsx', '.ts']);

const BANNED = [
  { re: /\bdodgecall\b/i, label: 'dodgecall' },
  { re: /\bdoclittle\b/i, label: 'doclittle' },
  { re: /\bdoctor\s+little\b/i, label: 'doctor little' },
  { re: /\bSomo\b/, label: 'Somo' },
  { re: /Skin\s*&\s*Care\s+Diary/i, label: 'Skin & Care Diary' },
  { re: /Sensitive\s+Skin\s+Diary/i, label: 'Sensitive Skin Diary' },
];

const ALLOW_PATH = [
  /\.env\.example$/i,
  /brand-allowlist/i,
  /check-brand-strings/i,
];

const ALLOW_LINE = [
  /brand-allowlist/i,
  /check-brand-strings/i,
  /docs\/archive/i,
  /process\.env\./i,
  /somo-platform/i,
  /api\.callsomo/i,
  /callsomo\.com/i,
  /utm_source.*somo/i,
  /SomoCheckoutChat/i,
  /videoSomoTranslate/i,
  /Somo-shell/i,
  /^\s*\/\//,
  /^\s*\*/,
];

function shouldSkipDir(name) {
  return SKIP_DIRS.has(name) || /^hosting-dist/.test(name);
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory() && shouldSkipDir(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (EXT.has(path.extname(ent.name))) files.push(p);
  }
  return files;
}

function isAllowedFile(file) {
  return ALLOW_PATH.some((re) => re.test(file));
}

function isAllowedLine(line) {
  return ALLOW_LINE.some((re) => re.test(line));
}

const files = [];
for (const dir of SCAN_DIRS) {
  for (const f of walk(dir)) files.push(f);
}

const violations = [];

for (const file of files) {
  const rel = path.relative(ROOT, file);
  if (isAllowedFile(rel)) continue;
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') continue;
    throw err;
  }
  const lines = raw.split('\n');
  lines.forEach((line, i) => {
    if (isAllowedLine(line)) return;
    for (const { re, label } of BANNED) {
      if (re.test(line)) {
        violations.push({ file: rel, line: i + 1, label, snippet: line.trim().slice(0, 120) });
      }
    }
  });
}

if (violations.length) {
  console.error(`check-brand-strings: ${violations.length} violation(s)\n`);
  for (const v of violations.slice(0, 50)) {
    console.error(`  ${v.file}:${v.line} [${v.label}] ${v.snippet}`);
  }
  if (violations.length > 50) console.error(`  ... and ${violations.length - 50} more`);
  process.exit(1);
}

console.log('check-brand-strings: OK');
