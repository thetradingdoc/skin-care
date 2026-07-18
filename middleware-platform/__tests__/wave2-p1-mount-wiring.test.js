'use strict';

const fs = require('fs');
const path = require('path');

describe('Wave 2 mount wiring (source adversarial)', () => {
  const root = path.join(__dirname, '..');

  test('SEC-07: requireAdminAuthUnlessSession before registerAdminPlatformRoutes', () => {
    const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
    const gate = src.indexOf("require('./middleware/require-admin-unless-session')");
    const reg = src.indexOf('registerAdminPlatformRoutes(app');
    expect(gate).toBeGreaterThan(-1);
    expect(reg).toBeGreaterThan(gate);
  });

  test('SEC-09/10/11 mounts requireAdminAuth', () => {
    const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
    expect(src).toMatch(/app\.use\('\/api\/rcm',\s*requireAdminAuth/);
    expect(src).toMatch(/app\.use\('\/api\/usage',\s*requireAdminAuth/);
    expect(src).toMatch(/app\.use\('\/api\/pdf-coding',\s*requireAdminAuth/);
  });

  test('SEC-08 provider case-report requires provider auth', () => {
    const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
    expect(src).toMatch(/app\.get\('\/api\/provider\/case-report',\s*requireProviderAuth/);
  });

  test('SEC-15/16 register-api-routes gate invoices and tenants', () => {
    const src = fs.readFileSync(path.join(root, 'bootstrap/register-api-routes.js'), 'utf8');
    expect(src).toMatch(/app\.use\('\/api\/invoices',\s*requireAdminAuth/);
    expect(src).toMatch(/app\.use\('\/api\/admin\/tenants',\s*requireAdminAuth/);
  });

  test('SEC-13 removes email-only patient-token fallback', () => {
    const src = fs.readFileSync(path.join(root, 'routes/auth-tokens.js'), 'utf8');
    expect(src).not.toMatch(/Fallback: resolve by email if already verified/);
    expect(src).toMatch(/AUTH_VERIFICATION_REQUIRED/);
  });

  test('SEC-13 login/google use mintUserSessionToken not base64 email', () => {
    const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
    expect(src).toMatch(/mintUserSessionToken\(user\)/);
    expect(src).not.toMatch(/token:\s*Buffer\.from\(user\.email\)\.toString\('base64'\)/);
  });

  test('SEC-19 case-report patient route gated', () => {
    const src = fs.readFileSync(path.join(root, 'routes/case-report.js'), 'utf8');
    expect(src).toMatch(/router\.get\('\/api\/patient\/:patientId\/case-report',\s*requireAdminAuth/);
  });

  test('SEC-21 send-upload-link requires admin', () => {
    const src = fs.readFileSync(path.join(root, 'routes/patient-documents.js'), 'utf8');
    expect(src).toMatch(/send-upload-link',\s*requireAdminAuth/);
  });

  test('SEC-23 retell webhook verifies secret in prod', () => {
    const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
    expect(src).toMatch(/RETELL_WEBHOOK_SECRET/);
    expect(src).toMatch(/Invalid webhook secret/);
  });
});
