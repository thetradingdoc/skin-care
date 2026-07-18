'use strict';

const {
  createUploadToken,
  verifyUploadToken,
  resolveUploadTokenSecret,
  INSECURE_DEFAULT,
} = require('../utils/upload-token');

describe('SEC-04 upload-token secret fail-closed', () => {
  const orig = { ...process.env };

  afterEach(() => {
    process.env = { ...orig };
  });

  test('adversarial: prod-like with missing secret throws UPLOAD_TOKEN_SECRET_REQUIRED', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.UPLOAD_TOKEN_SECRET;
    expect(() => resolveUploadTokenSecret()).toThrow(/UPLOAD_TOKEN_SECRET_REQUIRED/);
    expect(() => createUploadToken('p1', null, new Date(Date.now() + 60000))).toThrow(
      /UPLOAD_TOKEN_SECRET_REQUIRED/
    );
  });

  test('adversarial: prod-like with insecure default literal throws', () => {
    process.env.NODE_ENV = 'production';
    process.env.UPLOAD_TOKEN_SECRET = INSECURE_DEFAULT;
    expect(() => resolveUploadTokenSecret()).toThrow(/UPLOAD_TOKEN_SECRET_REQUIRED/);
  });

  test('adversarial: token forged with default secret is rejected when real secret is set', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.K_SERVICE;
    process.env.UPLOAD_TOKEN_SECRET = INSECURE_DEFAULT;
    const forged = createUploadToken('victim', null, new Date(Date.now() + 60000));
    process.env.UPLOAD_TOKEN_SECRET = 'real-production-secret-xyz';
    expect(verifyUploadToken(forged)).toBeNull();
  });

  test('round-trip with real secret', () => {
    process.env.NODE_ENV = 'production';
    process.env.UPLOAD_TOKEN_SECRET = 'real-production-secret-xyz';
    const token = createUploadToken('patient-1', 'appt-1', new Date(Date.now() + 60000));
    const payload = verifyUploadToken(token);
    expect(payload).toMatchObject({
      patient_id: 'patient-1',
      appointment_id: 'appt-1',
    });
  });

  test('adversarial: tampered hmac rejected', () => {
    process.env.UPLOAD_TOKEN_SECRET = 'real-production-secret-xyz';
    process.env.NODE_ENV = 'production';
    const token = createUploadToken('patient-1', null, new Date(Date.now() + 60000));
    const [hmac, payload] = token.split('.');
    const tampered = `${hmac.slice(0, -2)}aa.${payload}`;
    expect(verifyUploadToken(tampered)).toBeNull();
  });
});
