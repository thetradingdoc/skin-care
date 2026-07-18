'use strict';

const fs = require('fs');
const path = require('path');
const InsuranceService = require('../services/insurance-service');
const { isProdLikeEnv } = require('../utils/runtime-env');

describe('SEC-01 Stedi API key fail-closed', () => {
  const origEnv = { ...process.env };
  const origKey = InsuranceService.STEDI_API_KEY;

  afterEach(() => {
    process.env = { ...origEnv };
    InsuranceService.STEDI_API_KEY = origKey;
  });

  test('adversarial: source must not embed a hardcoded STEDI key fallback', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../services/insurance-service.js'),
      'utf8'
    );
    expect(src).not.toMatch(/STEDI_API_KEY\s*=\s*process\.env\.STEDI_API_KEY\s*\|\|\s*'/);
    expect(src).toMatch(/String\(process\.env\.STEDI_API_KEY \|\| ''\)/);
  });

  test('adversarial: prod-like with empty key throws STEDI_API_KEY_REQUIRED on getStediClient', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.STEDI_API_KEY;
    InsuranceService.STEDI_API_KEY = '';
    expect(isProdLikeEnv()).toBe(true);
    expect(() => InsuranceService.getStediClient()).toThrow(/STEDI_API_KEY_REQUIRED/);
  });

  test('non-prod empty key: getStediClient still refuses empty auth (no silent default)', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.K_SERVICE;
    delete process.env.STAGING;
    delete process.env.STEDI_API_KEY;
    InsuranceService.STEDI_API_KEY = '';
    expect(() => InsuranceService.getStediClient()).toThrow(/STEDI_API_KEY_REQUIRED/);
  });

  test('configured key: getStediClient returns client', () => {
    process.env.NODE_ENV = 'production';
    InsuranceService.STEDI_API_KEY = 'sk_live_test_only';
    const client = InsuranceService.getStediClient();
    expect(client).toBeTruthy();
    expect(client.defaults.headers.Authorization).toBe('sk_live_test_only');
  });
});
