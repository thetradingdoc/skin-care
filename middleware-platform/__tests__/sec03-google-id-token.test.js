'use strict';

const { verifyGoogleIdToken } = require('../utils/google-id-token');

describe('SEC-03 Google ID token verification', () => {
  const orig = { ...process.env };

  afterEach(() => {
    process.env = { ...orig };
  });

  test('adversarial: missing credential fails closed (cannot mint session from email alone)', async () => {
    await expect(verifyGoogleIdToken('')).rejects.toMatchObject({
      code: 'GOOGLE_CREDENTIAL_REQUIRED',
    });
    await expect(verifyGoogleIdToken(null)).rejects.toMatchObject({
      code: 'GOOGLE_CREDENTIAL_REQUIRED',
    });
  });

  test('adversarial: forged tokeninfo failure rejects (email body alone is irrelevant)', async () => {
    const fetchImpl = jest.fn(async () => {
      const err = new Error('404');
      err.response = { status: 404 };
      throw err;
    });
    await expect(
      verifyGoogleIdToken('forged.jwt.token', { fetchImpl, clientId: 'cid' })
    ).rejects.toMatchObject({ code: 'GOOGLE_TOKEN_INVALID' });
  });

  test('adversarial: aud mismatch rejects even when email present', async () => {
    process.env.NODE_ENV = 'production';
    const fetchImpl = jest.fn(async () => ({
      data: {
        email: 'attacker@evil.example',
        email_verified: 'true',
        aud: 'wrong-client',
        sub: 'sub1',
      },
    }));
    await expect(
      verifyGoogleIdToken('real.looking.jwt', {
        fetchImpl,
        clientId: 'expected-client',
      })
    ).rejects.toMatchObject({ code: 'GOOGLE_AUD_MISMATCH' });
  });

  test('adversarial: prod without GOOGLE_CLIENT_ID fails closed', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.GOOGLE_CLIENT_ID;
    const fetchImpl = jest.fn(async () => ({
      data: {
        email: 'user@example.com',
        email_verified: 'true',
        aud: 'any',
        sub: 'sub1',
      },
    }));
    await expect(
      verifyGoogleIdToken('jwt', { fetchImpl, clientId: '' })
    ).rejects.toMatchObject({ code: 'GOOGLE_CLIENT_ID_REQUIRED' });
  });

  test('happy: verified token returns email from Google, not caller-supplied', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.K_SERVICE;
    const fetchImpl = jest.fn(async () => ({
      data: {
        email: 'Verified.User@Example.com',
        email_verified: 'true',
        name: 'Verified',
        picture: 'https://example.com/p.png',
        aud: 'dev-client',
        sub: 'google-sub-99',
      },
    }));
    const out = await verifyGoogleIdToken('good.jwt', {
      fetchImpl,
      clientId: 'dev-client',
    });
    expect(out.email).toBe('verified.user@example.com');
    expect(out.sub).toBe('google-sub-99');
  });
});
