'use strict';

const express = require('express');
const cors = require('cors');
const request = require('supertest');
const allowedHeaders = require('../lib/cors-allowed-headers');

function buildCorsApp() {
  const app = express();
  const corsOptions = {
    origin: 'https://www.myskinandcare.com',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders,
    exposedHeaders: ['Set-Cookie'],
  };
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  app.patch('/api/patient/consumer-profile', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('CORS preflight for patient API', () => {
  test('allows x-client-date on consumer-profile PATCH preflight', async () => {
    const app = buildCorsApp();
    const res = await request(app)
      .options('/api/patient/consumer-profile')
      .set('Origin', 'https://www.myskinandcare.com')
      .set('Access-Control-Request-Method', 'PATCH')
      .set('Access-Control-Request-Headers', 'content-type,x-session-id,x-client-date');

    expect(res.status).toBe(204);
    const allowHeaders = String(res.headers['access-control-allow-headers'] || '').toLowerCase();
    expect(allowHeaders).toContain('x-client-date');
    expect(allowHeaders).toContain('x-session-id');
  });
});
