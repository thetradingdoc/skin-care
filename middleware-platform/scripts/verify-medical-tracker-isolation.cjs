#!/usr/bin/env node
'use strict';

/**
 * Build-time / CI guard: medical-tracker-rails must never import Kelly,
 * clinic perception, coding, RCM, or shelf consumer analysis graphs.
 *
 * ARCH-02: also scan Touche patient medical routes for the same forbidden requires.
 *
 * Pattern-based (not a hand-maintained filename list alone) so a new
 * `require('../kelly-whatever')` fails without updating FORBIDDEN_*.
 *
 * Usage:
 *   node scripts/verify-medical-tracker-isolation.cjs
 * Exit 1 on violation.
 */

const fs = require('fs');
const path = require('path');

const PLATFORM_ROOT = path.join(__dirname, '..');
const RAILS_ROOT = path.join(PLATFORM_ROOT, 'services', 'medical-tracker-rails');

/** Extra route files (ARCH-02) — same kelly/rcm forbidden require patterns. */
const EXTRA_SCAN_FILES = [
  path.join(PLATFORM_ROOT, 'routes', 'patient-records.js'),
  path.join(PLATFORM_ROOT, 'routes', 'patient-medical-progress.js'),
  path.join(PLATFORM_ROOT, 'routes', 'patient-ai-monetization.js'),
];

/** Substring / regex patterns that must never appear in require()/import paths. */
const FORBIDDEN_REQUIRE_PATTERNS = [
  /kelly/i,
  /perception-layer/i,
  /perception-graph/i,
  /coding-graph/i,
  /rcm-/i,
  /consumer-analysis-graph/i,
  /consumer-insight-graph/i,
  /consumer-rails/i,
  /kelly-tool-executor/i,
];

/** Allowlisted local files that may mention forbidden names in comments/strings only — still scanned for require(). */
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(js|cjs|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

function extractRequires(src) {
  const hits = [];
  const re = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  let m;
  while ((m = re.exec(src))) hits.push({ kind: 'require', spec: m[1], index: m.index });
  const reImp = /from\s+['"`]([^'"`]+)['"`]/g;
  while ((m = reImp.exec(src))) hits.push({ kind: 'import', spec: m[1], index: m.index });
  return hits;
}

function collectScanFiles() {
  const files = walk(RAILS_ROOT);
  for (const f of EXTRA_SCAN_FILES) {
    if (fs.existsSync(f)) files.push(f);
  }
  return files;
}

function main() {
  const files = collectScanFiles();
  const violations = [];
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    for (const hit of extractRequires(src)) {
      for (const pat of FORBIDDEN_REQUIRE_PATTERNS) {
        if (pat.test(hit.spec)) {
          violations.push({
            file: path.relative(PLATFORM_ROOT, file),
            kind: hit.kind,
            spec: hit.spec,
            pattern: String(pat),
          });
        }
      }
    }
  }

  if (violations.length) {
    console.error('medical-tracker isolation FAILED:');
    for (const v of violations) {
      console.error(`  ${v.file}: ${v.kind}('${v.spec}') matched ${v.pattern}`);
    }
    process.exit(1);
  }
  console.log(
    `medical-tracker isolation OK (${files.length} files, ${FORBIDDEN_REQUIRE_PATTERNS.length} forbidden patterns)`,
  );
}

if (require.main === module) main();

module.exports = {
  FORBIDDEN_REQUIRE_PATTERNS,
  EXTRA_SCAN_FILES,
  extractRequires,
  collectScanFiles,
  main,
};
