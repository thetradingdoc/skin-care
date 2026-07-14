'use strict';

/**
 * TOUCH-016 evidence — unauthenticated public evaluate, rate-limited.
 * Run: node __tests__/public-try-evaluate.evidence.js
 */

const assert = require('assert');
const express = require('express');
const request = require('supertest');
const { registerPublicRoutineEvaluateRoutes } = require('../routes/public-routine-evaluate');

function buildApp() {
  const app = express();
  const noopLimiter = (req, res, next) => next();
  const botGuard = (req, res, next) => next();
  const graph = {
    evaluateRoutine() {
      return {
        overall: 'safe',
        conflicts: [],
        suggested_split: null,
      };
    },
  };
  const db = { createIngredientConflictGraph: () => graph };
  registerPublicRoutineEvaluateRoutes(app, { apiLimiter: noopLimiter, botGuard, db });
  return app;
}

async function main() {
  const app = buildApp();

  const body = {
    products: [{ product_name: 'Gentle Moisturizer', barcode: '0001112223334' }],
  };

  console.log('REQUEST POST /api/public/routine/evaluate');
  console.log(JSON.stringify(body, null, 2));

  const res = await request(app).post('/api/public/routine/evaluate').send(body);
  console.log('RESPONSE status', res.status);
  console.log(JSON.stringify(res.body, null, 2));

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.overall, 'verdict overall present');
  assert.ok(typeof res.body.message === 'string');

  // Rate limit: 21st call within hour from same IP should 429
  let lastStatus = 200;
  for (let i = 0; i < 21; i += 1) {
    const r = await request(app)
      .post('/api/public/routine/evaluate')
      .set('X-Forwarded-For', '9.9.9.9')
      .send(body);
    lastStatus = r.status;
  }
  console.log('RATE_LIMIT_21st_STATUS', lastStatus);
  assert.strictEqual(lastStatus, 429, 'rate limit must kick in without session');

  console.log('TOUCH-016 EVIDENCE: PASS (no session cookie required)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
