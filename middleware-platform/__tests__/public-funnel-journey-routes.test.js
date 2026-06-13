'use strict';

const express = require('express');
const request = require('supertest');
const Database = require('better-sqlite3');
const { registerPublicFunnelJourneyRoutes } = require('../routes/public-funnel-journey');

function buildApp(db) {
  const app = express();
  const apiLimiter = (_req, _res, next) => next();
  registerPublicFunnelJourneyRoutes(app, { apiLimiter, db: { db } });
  return app;
}

describe('public funnel journey routes', () => {
  let db;
  let app;
  let journeyId;

  beforeEach(() => {
    db = new Database(':memory:');
    require('../migrations/029_skin_age_journey').up(db);
    require('../migrations/058_funnel_visitor_id').up(db);
    app = buildApp(db);
  });

  afterEach(() => {
    db.close();
  });

  test('creates journey with visitor_id', async () => {
    const res = await request(app)
      .post('/api/public/funnel/journey')
      .send({ visitor_id: 'vis_test_1' });
    expect(res.status).toBe(200);
    expect(res.body.journey_id).toMatch(/^fj_/);
    journeyId = res.body.journey_id;
    const row = db.prepare('SELECT anonymous_visitor_id FROM funnel_journeys WHERE id = ?').get(journeyId);
    expect(row.anonymous_visitor_id).toBe('vis_test_1');
  });

  test('records page_view event', async () => {
    const create = await request(app).post('/api/public/funnel/journey').send({});
    journeyId = create.body.journey_id;
    const res = await request(app)
      .post(`/api/public/funnel/journey/${journeyId}/event`)
      .send({ event_type: 'page_view', payload: { pathname: '/scan' } });
    expect(res.status).toBe(200);
    const ev = db.prepare('SELECT event_type FROM funnel_journey_events WHERE journey_id = ?').get(journeyId);
    expect(ev.event_type).toBe('page_view');
  });

  test('rejects phi in payload', async () => {
    const create = await request(app).post('/api/public/funnel/journey').send({});
    journeyId = create.body.journey_id;
    const res = await request(app)
      .post(`/api/public/funnel/journey/${journeyId}/event`)
      .send({ event_type: 'page_view', payload: { email: 'a@b.com' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('phi_field_rejected');
  });
});
