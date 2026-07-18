'use strict';

/**
 * APP-06 — Fail CI when banned self-referential commentary appears in
 * patient-app confirm / reveal / track *user-facing string literals*.
 *
 * Pattern SSOT: middleware-platform/services/face-read-vision.js
 * SELF_REFERENTIAL_COMMENTARY_PATTERNS (same list sanitizeVisionProse uses).
 *
 * Also asserts the SSOT array is present and non-empty (BRAND-06 sibling gate).
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const VISION_SRC = path.join(ROOT, 'middleware-platform/services/face-read-vision.js');

const SCAN_ROOTS = [
  path.join(ROOT, 'patient-app/app/capture/confirm'),
  path.join(ROOT, 'patient-app/app/track'),
  path.join(ROOT, 'patient-app/app/(tabs)/progress'),
];

function collectFiles(entry) {
  if (!fs.existsSync(entry)) return [];
  const st = fs.statSync(entry);
  if (st.isFile()) return [entry];
  const out = [];
  for (const name of fs.readdirSync(entry)) {
    if (name.startsWith('.')) continue;
    const p = path.join(entry, name);
    const s = fs.statSync(p);
    if (s.isDirectory()) out.push(...collectFiles(p));
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}

function loadPatterns() {
  const src = fs.readFileSync(VISION_SRC, 'utf8');
  if (!src.includes('function sanitizeVisionProse')) {
    throw new Error('APP-06: sanitizeVisionProse missing from face-read-vision.js');
  }
  const m = src.match(
    /const SELF_REFERENTIAL_COMMENTARY_PATTERNS = Object\.freeze\(\[([\s\S]*?)\]\);/,
  );
  if (!m) {
    throw new Error('APP-06: could not locate SELF_REFERENTIAL_COMMENTARY_PATTERNS');
  }
  const sandbox = { patterns: null };
  vm.runInNewContext(`patterns = [${m[1]}];`, sandbox);
  if (!Array.isArray(sandbox.patterns) || sandbox.patterns.length < 10) {
    throw new Error('APP-06: SELF_REFERENTIAL_COMMENTARY_PATTERNS too small / empty');
  }
  return sandbox.patterns;
}

/** Extract string / template literals from a line (rough; good enough for static copy). */
function extractLiterals(line) {
  const out = [];
  const re = /(['"`])((?:\\.|(?!\1).)*)\1/g;
  let m;
  while ((m = re.exec(line))) {
    out.push(m[2]);
  }
  return out;
}

function isAllowedLiteral(s) {
  const t = String(s || '').trim();
  if (!t) return true;
  // Product chrome / testIDs / style keys — not model coaching prose
  if (/^(retake|Retake|AI SUGGESTS|Looks right|Saving)/i.test(t)) return true;
  if (/^confirm-|template-fields-|field-absent-|testID/i.test(t)) return true;
  // Generic error affordance without tone/lighting coaching
  if (/^Could not save/i.test(t) && !/light|angle|resolution|skin tone/i.test(t)) return true;
  if (/Try again\.?$/i.test(t) && t.length < 80 && !/photo|light|angle|clearer/i.test(t.replace(/Try again\.?/i, ''))) {
    // "Could not save your photo. Try again." — allowed short failure copy
    if (/Could not save your photo\. Try again\.?/i.test(t)) return true;
  }
  return false;
}

const patterns = loadPatterns();
const files = SCAN_ROOTS.flatMap(collectFiles);
const violations = [];

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // Skip style object keys / pure identifiers
    if (/^\s*(retake|retakeText)\s*:/.test(line)) return;
    const literals = extractLiterals(line);
    if (!literals.length) return;
    for (const lit of literals) {
      if (isAllowedLiteral(lit)) continue;
      for (const re of patterns) {
        if (re.test(lit)) {
          violations.push({
            file: rel,
            line: i + 1,
            pattern: String(re).slice(0, 70),
            snippet: lit.slice(0, 120),
          });
          break;
        }
      }
    }
  });
}

if (violations.length) {
  console.error(`check-self-referential-commentary: ${violations.length} violation(s)\n`);
  for (const v of violations.slice(0, 40)) {
    console.error(`  ${v.file}:${v.line} [${v.pattern}] ${v.snippet}`);
  }
  process.exit(1);
}

console.log(
  `check-self-referential-commentary: OK (${patterns.length} patterns, ${files.length} UI files)`,
);
