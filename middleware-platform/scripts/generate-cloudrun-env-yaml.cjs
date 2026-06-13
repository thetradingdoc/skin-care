#!/usr/bin/env node
/**
 * Builds a YAML file for `gcloud run deploy --env-vars-file`.
 * Profiles: CLOUDRUN_PROFILE=staging (default for deploy-to-gcp.sh) | production
 *
 * Staging: durable SQLite path, migrations on boot, no random secrets when USE_GCP_SECRETS=1.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const dotenv = require('dotenv');

const MAX_VAR_CHARS = 3000;
const profile = (process.env.CLOUDRUN_PROFILE || 'staging').toLowerCase();
const isStaging = profile === 'staging';
const envPath = path.join(__dirname, '..', '.env');
const stagingExample = path.join(__dirname, '..', '.env.staging.example');
const outPath = process.argv[2] || path.join('/tmp', `cloudrun-env-${Date.now()}.yaml`);
const gcpProject =
  process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'somo-callsomo';

const baseUrl =
  process.env.CLOUDRUN_BASE_URL || 'https://api.callsomo.com';
const retellLlmWsUrl =
  process.env.RETELL_LLM_WEBSOCKET_URL ||
  `${String(baseUrl).replace(/\/+$/, '').replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')}/webhook/retell/llm`;

const SECRET_BINDING_IDS = {
  SMTP_PASSWORD: process.env.SMTP_PASSWORD_SECRET_NAME || 'somo-smtp-password',
  JWT_SECRET: 'somo-staging-jwt-secret',
  ADMIN_PORTAL_SECRET: 'somo-staging-admin-portal-secret',
  API_KEY_ENCRYPTION_KEY: 'somo-staging-api-key-encryption-key',
  RETELL_WEBHOOK_SECRET: 'somo-staging-retell-webhook-secret',
  STRIPE_WEBHOOK_SECRET: 'somo-staging-stripe-webhook-secret',
  STRIPE_SECRET_KEY: 'somo-staging-stripe-secret-key',
  STRIPE_PUBLISHABLE_KEY: 'somo-staging-stripe-publishable-key',
  TWILIO_ACCOUNT_SID: 'somo-staging-twilio-account-sid',
  TWILIO_AUTH_TOKEN: 'somo-staging-twilio-auth-token',
  TWILIO_VERIFY_SERVICE_SID: 'somo-staging-twilio-verify-service-sid',
  SOMO_OWNER_PASSWORD: 'somo-staging-somo-owner-password',
  POSTGRES_URL: 'somo-staging-postgres-url',
  REDIS_URL: 'somo-staging-redis-url',
  AZURE_COMMUNICATION_CONNECTION_STRING: 'somo-staging-azure-communication-connection-string',
};

const SECRET_KEYS = Object.keys(SECRET_BINDING_IDS);

function secretIdForKey(name) {
  return process.env[`SECRET_${name}`] || SECRET_BINDING_IDS[name] || `somo-staging-${name.toLowerCase().replace(/_/g, '-')}`;
}

function loadGcpSecrets() {
  if (process.env.USE_GCP_SECRETS !== '1') return {};
  const out = {};
  for (const name of SECRET_KEYS) {
    const secretId = secretIdForKey(name);
    try {
      const val = execSync(
        `gcloud secrets versions access latest --secret="${secretId}" --project="${gcpProject}"`,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      ).trim();
      if (val) out[name] = val;
    } catch {
      // optional per secret
    }
  }
  return out;
}

let parsed = {};
if (fs.existsSync(envPath)) {
  parsed = dotenv.parse(fs.readFileSync(envPath));
} else if (fs.existsSync(stagingExample)) {
  parsed = dotenv.parse(fs.readFileSync(stagingExample));
  console.warn('No .env — loaded non-secret defaults from .env.staging.example');
} else {
  console.error('No .env at', envPath);
}

parsed = { ...parsed, ...loadGcpSecrets() };

const randomHex = (bytes) => crypto.randomBytes(bytes).toString('hex');

function secretOrRandom(key, bytes, minLen = 0) {
  const v = parsed[key];
  if (v && String(v).length >= (minLen || 1)) return v;
  if (isStaging && process.env.USE_GCP_SECRETS === '1') {
    console.warn(`Missing secret ${key} — set in GCP Secret Manager (somo-staging-*)`);
    return '';
  }
  if (isStaging) {
    console.warn(`Missing ${key} — deploy with USE_GCP_SECRETS=1 or set in local .env`);
  }
  return randomHex(bytes);
}

const merged = {
  ...parsed,
  NODE_ENV: 'production',
  REQUIRE_JWT_FOR_FHIR: parsed.REQUIRE_JWT_FOR_FHIR || '1',
  REQUIRE_TRIAGE_FOR_VOICE: parsed.REQUIRE_TRIAGE_FOR_VOICE || '1',
  JWT_SECRET: secretOrRandom('JWT_SECRET', 32, 32),
  ADMIN_PORTAL_SECRET: secretOrRandom('ADMIN_PORTAL_SECRET', 24),
  API_KEY_ENCRYPTION_KEY: secretOrRandom('API_KEY_ENCRYPTION_KEY', 32),
  RETELL_WEBHOOK_SECRET:
    parsed.RETELL_WEBHOOK_SECRET ||
    parsed.RETELL_WEBHOOK_TOKEN ||
    secretOrRandom('RETELL_WEBHOOK_SECRET', 24),
  STRIPE_WEBHOOK_SECRET:
    parsed.STRIPE_WEBHOOK_SECRET ||
    parsed.STRIPEWebhook ||
    parsed.STRIPE_WEBHOOK ||
    secretOrRandom('STRIPE_WEBHOOK_SECRET', 24),
  BASE_URL: baseUrl,
  API_BASE_URL: baseUrl,
  BASE_DOMAIN: parsed.BASE_DOMAIN || 'callsomo.com',
  RETELL_LLM_WEBSOCKET_URL: parsed.RETELL_LLM_WEBSOCKET_URL || retellLlmWsUrl,
  DB_PATH:
    process.env.CLOUDRUN_DB_PATH ||
    parsed.DB_PATH ||
    (isStaging ? '/var/data/middleware-staging.db' : '/var/data/middleware-prod.db'),
  GCS_DB_BUCKET:
    process.env.GCS_DB_BUCKET ||
    parsed.GCS_DB_BUCKET ||
    (isStaging ? 'somo-staging-db-somo-callsomo' : 'somo-prod-db-somo-callsomo'),
  SKIP_STARTUP_MIGRATIONS: isStaging ? '0' : parsed.SKIP_STARTUP_MIGRATIONS || '1',
  MIGRATIONS_STRICT: isStaging ? '1' : '0',
  CLOUDRUN_BOOT_DEBUG: parsed.CLOUDRUN_BOOT_DEBUG || (isStaging ? '0' : '1'),
  TRIAL_SIM_FLOW_ENABLED: parsed.TRIAL_SIM_FLOW_ENABLED || (isStaging ? '1' : parsed.TRIAL_SIM_FLOW_ENABLED || '0'),
  SAAS_VOICE_FAIL_CLOSED: parsed.SAAS_VOICE_FAIL_CLOSED || (isStaging ? '1' : parsed.SAAS_VOICE_FAIL_CLOSED || '1'),
  SOMO_OWNER_EMAIL: parsed.SOMO_OWNER_EMAIL || 'richard@callsomo.com',
  EMAIL_PROVIDER: parsed.EMAIL_PROVIDER || 'smtp',
  STAGING: isStaging ? '1' : '0',
  ALLOW_STRIPE_TEST_IN_PRODUCTION: isStaging ? '1' : '0',
  FEATURE_V3_INSIGHTS: parsed.FEATURE_V3_INSIGHTS || (isStaging ? '1' : '0'),
  FEATURE_V3_INSIGHTS_LLM: parsed.FEATURE_V3_INSIGHTS_LLM || (isStaging ? '1' : '0'),
  LANGGRAPH_CONSUMER_EVAL_ROLLOUT_PCT:
    parsed.LANGGRAPH_CONSUMER_EVAL_ROLLOUT_PCT || (isStaging ? '1' : '0'),
  NEXT_GEN_PIPELINE: parsed.NEXT_GEN_PIPELINE || (isStaging ? '1' : '0'),
  JOURNAL_MODE_STANDALONE: parsed.JOURNAL_MODE_STANDALONE || (isStaging ? '1' : '0'),
  TRIGGER_INSIGHTS_ENABLED: parsed.TRIGGER_INSIGHTS_ENABLED || (isStaging ? '1' : '0'),
  IMPROVEMENTS_API_ENABLED: parsed.IMPROVEMENTS_API_ENABLED || (isStaging ? '1' : '0'),
  CONSUMER_RAILS_MAX_TOOL_ITERATIONS: parsed.CONSUMER_RAILS_MAX_TOOL_ITERATIONS || '3',
  LANGGRAPH_USE_POSTGRES: parsed.LANGGRAPH_USE_POSTGRES || (parsed.POSTGRES_URL ? 'true' : '0'),
  DATA_STORE: parsed.DATA_STORE || (parsed.POSTGRES_URL ? 'postgres' : 'sqlite'),
  STRIPE_PRICE_CARE_PROGRAM: parsed.STRIPE_PRICE_CARE_PROGRAM || '',
};

if (!isStaging) {
  merged.KELLY_RAILS_V2 = parsed.KELLY_RAILS_V2 || '1';
  merged.KELLY_RAILS_ROLLOUT_PCT = parsed.KELLY_RAILS_ROLLOUT_PCT ?? '1';
  merged.KELLY_ALLOW_HYBRID_GRAPH = parsed.KELLY_ALLOW_HYBRID_GRAPH ?? '0';
  merged.KELLY_RAILS_FAST_RAG = parsed.KELLY_RAILS_FAST_RAG ?? '1';
  merged.KELLY_VOICE_FILLER_MS = parsed.KELLY_VOICE_FILLER_MS ?? '1200';
}

if (isStaging) {
  delete merged.NGROK_URL;
  delete merged.MERCHANT_SHOP_URL;
}

delete merged.PORT;

// Never emit secrets as plain env vars — Cloud Run binds these via --set-secrets.
for (const key of SECRET_KEYS) {
  delete merged[key];
}
delete merged.RETELL_WEBHOOK_TOKEN;
delete merged.STRIPEWebhook;
delete merged.STRIPE_WEBHOOK;

const lines = [];
const skipped = [];
for (const [k, v] of Object.entries(merged)) {
  if (v === undefined || v === null || v === '') continue;
  const s = String(v);
  if (s.length > MAX_VAR_CHARS) {
    skipped.push(k);
    continue;
  }
  lines.push(`${k}: ${JSON.stringify(s)}`);
}

fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');

const secretsOutPath = `${outPath.replace(/\.yaml$/, '')}-secrets.txt`;
const secretPairs = SECRET_KEYS.map((key) => `${key}=${secretIdForKey(key)}:latest`);
fs.writeFileSync(secretsOutPath, secretPairs.join(',') + '\n', 'utf8');

console.log('Wrote', outPath, `(${lines.length} vars, profile=${profile})`);
console.log('Wrote', secretsOutPath, `(${SECRET_KEYS.length} secret bindings)`);
if (skipped.length) {
  console.warn('Skipped (too long):', skipped.join(', '));
}
