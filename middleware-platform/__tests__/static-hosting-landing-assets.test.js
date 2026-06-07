'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const request = require('supertest');
const {
  createStaticPathHelpers,
  isSkinCareLandingBuildReady,
} = require('../lib/static-hosting-paths');
const { registerEarlyConsumerLandingStatic } = require('../bootstrap/static-hosting');

const rootDir = path.join(__dirname, '..');

describe('registerEarlyConsumerLandingStatic', () => {
  const { getSkinCareLandingBuildPath } = createStaticPathHelpers(rootDir);

  beforeAll(() => {
    if (!isSkinCareLandingBuildReady(getSkinCareLandingBuildPath)) {
      throw new Error(
        'Missing skin-care-landing build. Run: cd middleware-platform && npm run build:skin-care-landing'
      );
    }
  });

  it('serves hashed landing CSS from build on localhost', async () => {
    const cssName = fs
      .readdirSync(getSkinCareLandingBuildPath('assets'))
      .find((f) => f.endsWith('.css') && f.startsWith('index-'));
    expect(cssName).toBeTruthy();

    const app = express();
    registerEarlyConsumerLandingStatic(app, { express, rootDir });

    const res = await request(app)
      .get(`/assets/${cssName}`)
      .set('Host', 'localhost:4000');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/css/i);
  });
});
