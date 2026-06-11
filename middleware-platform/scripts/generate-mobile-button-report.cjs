#!/usr/bin/env node
'use strict';

/**
 * Generate docs/audits/MOBILE_BUTTON_INVENTORY.md from Playwright JSON output.
 * Usage: node middleware-platform/scripts/generate-mobile-button-report.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const JSON_PATH = path.join(__dirname, '..', 'playwright.mobile-button-inventory.json');
const OUT_PATH = path.join(ROOT, 'docs', 'audits', 'MOBILE_BUTTON_INVENTORY.md');

function loadJson() {
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`Missing ${JSON_PATH}. Run the inventory spec first.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
}

function escCell(s) {
  return String(s || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function main() {
  const data = loadJson();
  const lines = [
    '# Mobile App Button Inventory (Playwright Audit)',
    '',
    `Generated: ${data.generated_at}`,
    '',
    'Test surface: Expo **web export** at `/app/*` (not native iOS/Android).',
    '',
    '## Summary',
    '',
    '| Metric | Count |',
    '|--------|------:|',
    `| Total audited | ${data.total} |`,
    `| Pass | ${data.pass} |`,
    `| Fail | ${data.fail} |`,
    `| Skip | ${data.skip} |`,
    '',
    '## Existing spec coverage (prior suites)',
    '',
    '| Screen | Button | Action | Result | Source |',
    '|--------|--------|--------|--------|--------|',
  ];

  for (const row of data.existing_spec_coverage || []) {
    lines.push(
      `| ${escCell(row.screen)} | ${escCell(row.button)} | ${escCell(row.action)} | ${row.result} | ${escCell(row.source)} |`
    );
  }

  lines.push('', '## Full button audit', '', '| Screen | Button | Expected action | Route | Result | Notes |', '|--------|--------|-------------------|-------|--------|-------|');

  for (const row of data.results || []) {
    const notes = row.error || row.reason || '';
    lines.push(
      `| ${escCell(row.screen)} | ${escCell(row.button)} | ${escCell(row.action)} | \`${escCell(row.route)}\` | **${row.result}** | ${escCell(notes)} |`
    );
  }

  lines.push('', '## How to re-run', '', '```bash', 'cd middleware-platform', 'npx playwright install chromium', 'npx playwright test --config playwright.mobile-button-inventory.config.cjs', 'node scripts/generate-mobile-button-report.cjs', '```', '');

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, lines.join('\n'));
  console.log(`Wrote ${OUT_PATH}`);
}

main();
