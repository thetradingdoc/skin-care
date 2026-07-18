'use strict';

const {
  resolveFactsEncryptionKeySource,
  getFactsCipherKey,
  encryptFactField,
  decryptFactField,
} = require('../services/patient-record-field-crypto');

describe('SEC-05 facts crypto no dev-key fallback in prod', () => {
  const orig = { ...process.env };

  afterEach(() => {
    process.env = { ...orig };
  });

  function clearKeyEnv() {
    delete process.env.PATIENT_RECORD_FACTS_ENCRYPTION_KEY;
    delete process.env.BILLING_DATA_ENCRYPTION_KEY;
    delete process.env.SESSION_SECRET;
  }

  test('adversarial: prod-like with no key reports missing_in_prod and throws on encrypt', () => {
    process.env.NODE_ENV = 'production';
    clearKeyEnv();
    const src = resolveFactsEncryptionKeySource();
    expect(src.valueKind).toBe('missing_in_prod');
    expect(src.source).toBe('missing');
    expect(() => getFactsCipherKey()).toThrow(/FACTS_ENCRYPTION_KEY_REQUIRED/);
    expect(() => encryptFactField('phi')).toThrow(/FACTS_ENCRYPTION_KEY_REQUIRED/);
  });

  test('adversarial: prod-like rejects explicit literal_dev_key value', () => {
    process.env.NODE_ENV = 'production';
    clearKeyEnv();
    process.env.PATIENT_RECORD_FACTS_ENCRYPTION_KEY = 'dev-billing-key';
    expect(resolveFactsEncryptionKeySource().valueKind).toBe('literal_dev_key');
    expect(() => getFactsCipherKey()).toThrow(/FACTS_ENCRYPTION_KEY_REQUIRED/);
  });

  test('non-prod may use hardcoded fallback for local only', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.K_SERVICE;
    clearKeyEnv();
    expect(resolveFactsEncryptionKeySource().isDevFallback).toBe(true);
    const enc = encryptFactField('local-only');
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(decryptFactField(enc)).toBe('local-only');
  });

  test('prod with real key encrypts and decrypts', () => {
    process.env.NODE_ENV = 'production';
    clearKeyEnv();
    process.env.PATIENT_RECORD_FACTS_ENCRYPTION_KEY = 'prod-facts-key-not-dev';
    const enc = encryptFactField('clinical');
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(decryptFactField(enc)).toBe('clinical');
  });
});
