#!/usr/bin/env node
'use strict';

/**
 * Verify consumer production env vars (local .env or explicit KEY=VAL pairs).
 *
 * Usage:
 *   node middleware-platform/scripts/verify-prod-consumer-env.cjs
 *   node middleware-platform/scripts/verify-prod-consumer-env.cjs --file middleware-platform/.env
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const args = process.argv.slice(2);
const fileIdx = args.indexOf('--file');
const envPath =
  fileIdx >= 0 && args[fileIdx + 1]
    ? path.resolve(args[fileIdx + 1])
    : path.join(__dirname, '..', '.env');

let env = {};
if (fs.existsSync(envPath)) {
  env = dotenv.parse(fs.readFileSync(envPath));
} else {
  env = process.env;
}

const required = [
  { key: 'FEATURE_V3_INSIGHTS', expect: '1' },
  { key: 'LANGGRAPH_CONSUMER_EVAL_ROLLOUT_PCT', expect: '1' },
  { key: 'NEXT_GEN_PIPELINE', expect: '1' },
  { key: 'JOURNAL_MODE_STANDALONE', expect: '1' },
  { key: 'TRIGGER_INSIGHTS_ENABLED', expect: '1' },
  { key: 'IMPROVEMENTS_API_ENABLED', expect: '1' },
  { key: 'STRIPE_PRICE_CARE_PROGRAM', minLen: 6 },
];

const recommended = [
  { key: 'REDIS_URL', minLen: 8 },
  { key: 'POSTGRES_URL', minLen: 8 },
  { key: 'LANGGRAPH_USE_POSTGRES', expectOneOf: ['true', '1'] },
];

const warnings = [];
const failures = [];

for (const rule of required) {
  const val = String(env[rule.key] || '').trim();
  if (rule.expect && val !== rule.expect) {
    failures.push(`${rule.key} must be "${rule.expect}" (got "${val || '(empty)'}")`);
  } else if (rule.minLen && val.length < rule.minLen) {
    failures.push(`${rule.key} must be set (min ${rule.minLen} chars)`);
  }
}

for (const rule of recommended) {
  const val = String(env[rule.key] || '').trim();
  if (rule.expectOneOf && !rule.expectOneOf.includes(val)) {
    warnings.push(`${rule.key} recommended: one of ${rule.expectOneOf.join(', ')}`);
  } else if (rule.minLen && val.length < rule.minLen) {
    warnings.push(`${rule.key} recommended for prod agentic scale`);
  }
}

if (warnings.length) {
  console.warn('Warnings:');
  warnings.forEach((w) => console.warn(`  - ${w}`));
}

if (failures.length) {
  console.error('Consumer prod env check FAILED:');
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}

console.log('Consumer prod env check OK');
