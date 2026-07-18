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
  // SEC-04 / SEC-05 — Touche fail-closed secrets (no source defaults in prod)
  { key: 'UPLOAD_TOKEN_SECRET', minLen: 16, rejectExact: 'change-me-in-production' },
  {
    key: 'PATIENT_RECORD_FACTS_ENCRYPTION_KEY',
    minLen: 16,
    rejectExact: 'dev-billing-key',
    orKeys: ['BILLING_DATA_ENCRYPTION_KEY', 'SESSION_SECRET'],
  },
];

const recommended = [
  { key: 'REDIS_URL', minLen: 8 },
  { key: 'POSTGRES_URL', minLen: 8 },
  { key: 'LANGGRAPH_USE_POSTGRES', expectOneOf: ['true', '1'] },
  // SEC-01 — required when Stedi is used; InsuranceService fails closed without it in prod
  { key: 'STEDI_API_KEY', minLen: 8 },
  { key: 'GOOGLE_CLIENT_ID', minLen: 8 },
  // P1.15 — AI capture meter (defaults apply if unset; warn when missing in prod)
  { key: 'AI_FREE_CAPTURE_LIMIT', minLen: 1 },
  { key: 'AI_WELCOME_BONUS_LIMIT', minLen: 1 },
  { key: 'AI_WELCOME_BONUS_DAYS', minLen: 1 },
  { key: 'AI_BURST_LIMIT_24H', minLen: 1 },
];

const warnings = [];
const failures = [];

for (const rule of required) {
  const primary = String(env[rule.key] || '').trim();
  let val = primary;
  if ((!val || (rule.minLen && val.length < rule.minLen)) && Array.isArray(rule.orKeys)) {
    for (const alt of rule.orKeys) {
      const altVal = String(env[alt] || '').trim();
      if (altVal && (!rule.minLen || altVal.length >= rule.minLen)) {
        if (rule.rejectExact && altVal === rule.rejectExact) continue;
        val = altVal;
        break;
      }
    }
  }
  if (rule.expect && val !== rule.expect) {
    failures.push(`${rule.key} must be "${rule.expect}" (got "${val || '(empty)'}")`);
  } else if (rule.rejectExact && val === rule.rejectExact) {
    failures.push(`${rule.key} must not be the insecure default "${rule.rejectExact}"`);
  } else if (rule.minLen && val.length < rule.minLen) {
    const alts = Array.isArray(rule.orKeys) && rule.orKeys.length
      ? ` (or one of: ${rule.orKeys.join(', ')})`
      : '';
    failures.push(`${rule.key} must be set (min ${rule.minLen} chars)${alts}`);
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
