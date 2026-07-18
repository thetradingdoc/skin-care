'use strict';

const { blockTestEndpointsInProduction } = require('../middleware/block-test-endpoints');

function mockReqRes(path, originalUrl) {
  const req = { path, originalUrl: originalUrl || path };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return { req, res };
}

describe('SEC-02 /api/test/* production gate', () => {
  const orig = { ...process.env };

  afterEach(() => {
    process.env = { ...orig };
  });

  test('adversarial: prod-like blocks /api/test/simulate-stedi-approval with 404', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_TEST_ENDPOINTS;
    const { req, res } = mockReqRes('/api/test/simulate-stedi-approval');
    let nextCalled = false;
    blockTestEndpointsInProduction(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'NOT_FOUND' });
  });

  test('adversarial: prod-like blocks nested /api/test/foo', () => {
    process.env.NODE_ENV = 'production';
    const { req, res } = mockReqRes('/api/test/foo');
    let nextCalled = false;
    blockTestEndpointsInProduction(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(404);
  });

  test('non-test paths pass through in production', () => {
    process.env.NODE_ENV = 'production';
    const { req, res } = mockReqRes('/api/auth/google');
    let nextCalled = false;
    blockTestEndpointsInProduction(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });

  test('ALLOW_TEST_ENDPOINTS=1 opens test routes in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_TEST_ENDPOINTS = '1';
    const { req, res } = mockReqRes('/api/test/simulate-stedi-approval');
    let nextCalled = false;
    blockTestEndpointsInProduction(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  test('development allows /api/test without ALLOW_TEST_ENDPOINTS', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.K_SERVICE;
    delete process.env.ALLOW_TEST_ENDPOINTS;
    const { req, res } = mockReqRes('/api/test/x');
    let nextCalled = false;
    blockTestEndpointsInProduction(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });
});
