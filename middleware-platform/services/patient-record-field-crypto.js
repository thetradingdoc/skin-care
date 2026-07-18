'use strict';

/**
 * Field-level encryption for patient_record_facts.structured_json + raw_extract_text.
 *
 * Mechanism (mirrors billing in server.js encryptBillingField / decryptBillingField):
 * - App-level AES-256-GCM before insert / after read
 * - Wire format: enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>
 * - Key: SHA-256(env secret) → 32-byte AES key (same derivation as billing)
 *
 * NOT: column TDE, KMS envelope encryption, or per-row keys.
 * Key rotation: none implemented (same honest gap as billing — see module footer).
 */

const crypto = require('crypto');
const { isProdLikeEnv } = require('../utils/runtime-env');

const PREFIX = 'enc:v1:';
const DEV_FALLBACK_LITERAL = 'dev-billing-key';

/**
 * Which secret the facts cipher actually resolves from (fallthrough order).
 * Used by prod gate — never log the raw secret value.
 * SEC-05: prod-like must never use the hardcoded literal fallback.
 */
function resolveFactsEncryptionKeySource() {
  if (process.env.PATIENT_RECORD_FACTS_ENCRYPTION_KEY) {
    return {
      source: 'PATIENT_RECORD_FACTS_ENCRYPTION_KEY',
      isDevFallback: false,
      valueKind: String(process.env.PATIENT_RECORD_FACTS_ENCRYPTION_KEY) === DEV_FALLBACK_LITERAL ? 'literal_dev_key' : 'set',
    };
  }
  if (process.env.BILLING_DATA_ENCRYPTION_KEY) {
    return {
      source: 'BILLING_DATA_ENCRYPTION_KEY',
      isDevFallback: false,
      valueKind: String(process.env.BILLING_DATA_ENCRYPTION_KEY) === DEV_FALLBACK_LITERAL ? 'literal_dev_key' : 'set',
    };
  }
  if (process.env.SESSION_SECRET) {
    return {
      source: 'SESSION_SECRET',
      isDevFallback: false,
      valueKind: 'set',
    };
  }
  if (isProdLikeEnv()) {
    return {
      source: 'missing',
      isDevFallback: true,
      valueKind: 'missing_in_prod',
    };
  }
  return {
    source: 'literal:dev-billing-key',
    isDevFallback: true,
    valueKind: 'hardcoded_fallback',
  };
}

function getFactsCipherKey() {
  const resolved = resolveFactsEncryptionKeySource();
  if (resolved.source === 'missing' || resolved.valueKind === 'missing_in_prod') {
    const err = new Error('FACTS_ENCRYPTION_KEY_REQUIRED');
    err.code = 'FACTS_ENCRYPTION_KEY_REQUIRED';
    throw err;
  }
  // Reject explicit "dev-billing-key" string in prod-like (same as unset)
  if (isProdLikeEnv() && resolved.valueKind === 'literal_dev_key') {
    const err = new Error('FACTS_ENCRYPTION_KEY_REQUIRED');
    err.code = 'FACTS_ENCRYPTION_KEY_REQUIRED';
    throw err;
  }
  const raw =
    resolved.source === 'literal:dev-billing-key'
      ? DEV_FALLBACK_LITERAL
      : String(process.env[resolved.source] || '');
  if (!raw) {
    const err = new Error('FACTS_ENCRYPTION_KEY_REQUIRED');
    err.code = 'FACTS_ENCRYPTION_KEY_REQUIRED';
    throw err;
  }
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Encrypt a UTF-8 string for at-rest storage.
 * Unlike billing's silent plaintext fallback, medical facts FAIL CLOSED on encrypt error.
 */
function encryptFactField(value) {
  if (value == null) return null;
  const plain = String(value);
  if (!plain) return plain;
  if (plain.startsWith(PREFIX)) return plain;
  const iv = crypto.randomBytes(12);
  const key = getFactsCipherKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt enc:v1:… payload. Legacy plaintext (no prefix) returned unchanged.
 * Auth failure / corrupt ciphertext → throw (fail closed — do not return garbage as "data").
 */
function decryptFactField(value) {
  if (value == null) return value;
  const raw = String(value);
  if (!raw.startsWith(PREFIX)) return raw;
  const parts = raw.split(':');
  // enc:v1:iv:tag:data  → ["enc", "v1", iv, tag, data]
  if (parts.length < 5) {
    const err = new Error('FACT_FIELD_DECRYPT_INVALID');
    err.code = 'FACT_FIELD_DECRYPT_INVALID';
    throw err;
  }
  const ivB64 = parts[2];
  const tagB64 = parts[3];
  const dataB64 = parts.slice(4).join(':');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const key = getFactsCipherKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function isEncryptedFactField(value) {
  return value != null && String(value).startsWith(PREFIX);
}

function encryptStructuredJson(structured) {
  const plain =
    typeof structured === 'string' ? structured : JSON.stringify(structured != null ? structured : {});
  return encryptFactField(plain);
}

function decryptStructuredJson(stored) {
  if (stored == null || stored === '') return {};
  if (typeof stored === 'object' && !Array.isArray(stored)) {
    // Already hydrated (in-memory) — do not re-parse
    return stored;
  }
  const plain = decryptFactField(String(stored));
  try {
    const parsed = JSON.parse(plain || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function encryptRawExtractText(text) {
  if (text == null) return null;
  const s = String(text);
  if (!s) return null;
  return encryptFactField(s);
}

function decryptRawExtractText(stored) {
  if (stored == null) return null;
  return decryptFactField(String(stored));
}

function extractEntryDate(structured) {
  const obj =
    typeof structured === 'string'
      ? (() => {
          try {
            return JSON.parse(structured);
          } catch (_) {
            return {};
          }
        })()
      : structured && typeof structured === 'object'
        ? structured
        : {};
  const d = obj && obj.date != null ? String(obj.date).trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function isoOrNull(v) {
  const s = v != null ? String(v).trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/**
 * Denormalized query columns (075) — mirrors extractEntryDate pattern.
 * @returns {{ fact_subtype: string|null, expiry_date: string|null, provider: string|null, issue_date: string|null }}
 */
function extractDenormQueryables(structured, tag = null) {
  const obj =
    typeof structured === 'string'
      ? (() => {
          try {
            return JSON.parse(structured);
          } catch (_) {
            return {};
          }
        })()
      : structured && typeof structured === 'object'
        ? structured
        : {};
  const t = String(tag || obj.tag || '').toLowerCase();
  let fact_subtype = null;
  if (t === 'prescription') {
    fact_subtype = obj.rx_kind || (obj.template_id || '').split('.')[1] || null;
  } else if (t === 'lab') {
    fact_subtype = obj.lab_kind || (obj.template_id || '').split('.')[1] || null;
  } else if (obj.template_id) {
    fact_subtype = String(obj.template_id).split('.')[1] || null;
  }

  const expiry_date = isoOrNull(obj.expiry || obj.expiry_date);
  const issue_date = isoOrNull(obj.date) || extractEntryDate(obj);
  const provider =
    (obj.provider && String(obj.provider).trim()) ||
    (obj.prescriber && String(obj.prescriber).trim()) ||
    (obj.practice && String(obj.practice).trim()) ||
    null;

  return {
    fact_subtype: fact_subtype ? String(fact_subtype).slice(0, 64) : null,
    expiry_date,
    provider: provider ? String(provider).slice(0, 200) : null,
    issue_date,
  };
}

module.exports = {
  PREFIX,
  resolveFactsEncryptionKeySource,
  getFactsCipherKey,
  encryptFactField,
  decryptFactField,
  isEncryptedFactField,
  encryptStructuredJson,
  decryptStructuredJson,
  encryptRawExtractText,
  decryptRawExtractText,
  extractEntryDate,
  extractDenormQueryables,
};
