#!/usr/bin/env node
'use strict';

/**
 * Fail CI when banned legacy brand strings appear in runtime copy (Kelly prompts, alerts).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const SCAN_FILES = [
  path.join(ROOT, 'middleware-platform/services/kelly-prompt-builder.js'),
  path.join(ROOT, 'middleware-platform/services/kelly-agent-service.js'),
  path.join(ROOT, 'middleware-platform/services/voice-billing-alerts.js'),
  path.join(ROOT, 'middleware-platform/services/trial-alerts.js'),
  path.join(ROOT, 'middleware-platform/services/agent-brain-service.js'),
  path.join(ROOT, 'middleware-platform/services/retell-service.js'),
  path.join(ROOT, 'middleware-platform/services/telemedicine-reminders.js'),
  path.join(ROOT, 'middleware-platform/services/invoice-service.js'),
];

const BANNED = [{ re: /\bSomo\b/, label: 'Somo' }];

const ALLOW_LINE = [
  /^\s*\/\//,
  /^\s*\*/,
  /Channel-agnostic/,
  /somo-platform/i,
];

const violations = [];

for (const file of SCAN_FILES) {
  if (!fs.existsSync(file)) continue;
  const rel = path.relative(ROOT, file);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (ALLOW_LINE.some((re) => re.test(line))) return;
    for (const { re, label } of BANNED) {
      if (re.test(line)) {
        violations.push({ file: rel, line: i + 1, label, snippet: line.trim().slice(0, 120) });
      }
    }
  });
}

if (violations.length) {
  console.error(`check-brand-runtime-copy: ${violations.length} violation(s)\n`);
  for (const v of violations.slice(0, 30)) {
    console.error(`  ${v.file}:${v.line} [${v.label}] ${v.snippet}`);
  }
  process.exit(1);
}

console.log('check-brand-runtime-copy: OK');
