'use strict';

/**
 * Public client fatal ingest — receives sync XHR from the patient app
 * ErrorUtils handler immediately before RCTFatal aborts the process.
 * In-memory ring buffer + stdout so we can read the Error.message after a TestFlight crash.
 */

const MAX_ENTRIES = 50;
const MAX_BODY = 12 * 1024;
const recent = [];

function readToken() {
  return String(process.env.CLIENT_FATAL_READ_TOKEN || '').trim();
}

function registerPublicClientFatalRoutes(app, { apiLimiter, express }) {
  app.post(
    '/api/patient/public/client-fatal',
    (req, res, next) => apiLimiter(req, res, next),
    express.json({ limit: '16kb' }),
    (req, res) => {
      try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const entry = {
          at: new Date().toISOString(),
          ip: req.ip || null,
          ua: String(req.get('User-Agent') || '').slice(0, 200),
          platform: String(body.platform || '').slice(0, 40),
          osVersion: String(body.osVersion || '').slice(0, 40),
          appVersion: String(body.appVersion || '').slice(0, 40),
          build: String(body.build || '').slice(0, 40),
          isFatal: Boolean(body.isFatal),
          errorMessage: String(body.errorMessage || '').slice(0, 800),
          stack: String(body.stack || '').slice(0, 2500),
        };
        recent.push(entry);
        while (recent.length > MAX_ENTRIES) recent.shift();
        console.error('[client-fatal]', JSON.stringify(entry).slice(0, MAX_BODY));
        return res.status(204).end();
      } catch (err) {
        console.error('[client-fatal] handler error', err?.message || err);
        return res.status(204).end();
      }
    },
  );

  app.get(
    '/api/patient/public/client-fatal/recent',
    (req, res, next) => apiLimiter(req, res, next),
    (req, res) => {
      const expected = readToken();
      if (!expected || String(req.query.token || '') !== expected) {
        return res.status(404).json({ success: false, error: 'not_found' });
      }
      return res.json({ success: true, count: recent.length, entries: recent.slice().reverse() });
    },
  );
}

module.exports = { registerPublicClientFatalRoutes };
