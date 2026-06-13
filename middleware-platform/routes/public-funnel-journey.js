'use strict';

const crypto = require('crypto');
const express = require('express');
const {
  assertAllowedEventType,
  sanitizeFunnelPayload,
  isPhiKey,
} = require('../lib/funnel-analytics');

function journeyId() {
  return `fj_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

function eventId() {
  return `fje_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function ensureTables(db) {
  const migration029 = require('../migrations/029_skin_age_journey');
  if (migration029?.up) migration029.up(db);
  const migration058 = require('../migrations/058_funnel_visitor_id');
  if (migration058?.up) migration058.up(db);
}

function registerPublicFunnelJourneyRoutes(app, { apiLimiter, db }) {
  app.post('/api/public/funnel/journey', apiLimiter, express.json({ limit: '32kb' }), (req, res) => {
    try {
      ensureTables(db.db);
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const visitorId = String(body.visitor_id || body.anonymous_visitor_id || '').trim().slice(0, 64) || null;
      const id = journeyId();
      const expires = new Date(Date.now() + 7 * 86400000).toISOString();
      db.db
        .prepare(`
        INSERT INTO funnel_journeys (id, status, expires_at, anonymous_visitor_id, created_at, updated_at)
        VALUES (?, 'active', ?, ?, datetime('now'), datetime('now'))
      `)
        .run(id, expires, visitorId);
      return res.json({ success: true, journey_id: id, expires_at: expires });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post(
    '/api/public/funnel/journey/:id/event',
    apiLimiter,
    express.json({ limit: '64kb' }),
    (req, res) => {
      try {
        ensureTables(db.db);
        const journeyIdParam = String(req.params.id || '').trim();
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        let eventType;
        try {
          eventType = assertAllowedEventType(body.event_type || body.type);
        } catch (_) {
          return res.status(400).json({ success: false, error: 'invalid_event_type' });
        }
        if (!journeyIdParam) {
          return res.status(400).json({ success: false, error: 'journey_id_required' });
        }
        const row = db.db.prepare(`SELECT id FROM funnel_journeys WHERE id = ? LIMIT 1`).get(journeyIdParam);
        if (!row) return res.status(404).json({ success: false, error: 'journey_not_found' });
        const rawPayload =
          body.payload && typeof body.payload === 'object'
            ? body.payload
            : { ...body, event_type: undefined, type: undefined, payload: undefined };
        const payload = sanitizeFunnelPayload(rawPayload);
        if (Object.keys(rawPayload).some((k) => isPhiKey(k) && rawPayload[k] != null)) {
          return res.status(400).json({ success: false, error: 'phi_field_rejected' });
        }
        db.db
          .prepare(`
          INSERT INTO funnel_journey_events (id, journey_id, event_type, payload_json, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `)
          .run(eventId(), journeyIdParam, eventType, JSON.stringify(payload));
        return res.json({ success: true });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );
}

module.exports = { registerPublicFunnelJourneyRoutes };
