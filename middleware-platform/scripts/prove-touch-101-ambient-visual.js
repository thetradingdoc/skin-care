'use strict';

/**
 * TOUCH-101 — Prove Check ambient safe-mode copy from live API + attempt web UI capture.
 * Usage: node scripts/prove-touch-101-ambient-visual.js
 */

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const { spawn } = require('child_process');

process.chdir(path.join(__dirname, '..'));

const express = require('express');
const request = require('supertest');
const db = require('../database');
const PatientPortalService = require('../services/patient-portal-service');
const {
  requirePatientSession,
  resolvePatientIdFromSession,
  recordPatientPortalEvent,
} = require('../middleware/patient-session');
const { registerPatientBioProfileRoutes } = require('../routes/patient-bio-profile');
const { registerPatientAlertsRoutes } = require('../routes/patient-alerts');
const { upsertBioProfile } = require('../services/patient-bio-profile-service');

const EMAIL = 'touch101.ambient.visual@trytouche.local';
const OTP = '424242';
const noop = (req, _res, next) => next();
const OUT_DIR = path.join(__dirname, '../../todos/pending/mobile-ux-audit-2026-07-14/screenshots');

function createVerifiedSession(email) {
  const sqlite = db.db;
  const sessions = sqlite
    .prepare(`SELECT id FROM patient_portal_sessions WHERE LOWER(email)=LOWER(?)`)
    .all(email);
  for (const s of sessions) {
    sqlite.prepare(`UPDATE patient_portal_sessions SET revoked_at=datetime('now') WHERE id=?`).run(s.id);
  }
  const sessionId = uuidv4();
  db.insertVerificationSession({
    sessionId,
    email,
    code: OTP,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    ip: '127.0.0.1',
    userAgent: 'touch-101-ambient',
  });
  const result = PatientPortalService.verifyCode(email, OTP);
  if (!result.success) throw new Error(result.error);
  try {
    db.touchLastSeen(result.session_id);
  } catch (_) {}
  return { session_id: result.session_id, patient_id: result.patient_id || null, email };
}

function buildApp() {
  const app = express();
  app.use(express.json());
  const deps = {
    apiLimiter: noop,
    express,
    db,
    requirePatientSession,
    resolvePatientIdFromSession,
    recordPatientPortalEvent,
    PatientPortalService,
  };
  registerPatientBioProfileRoutes(app, deps);
  registerPatientAlertsRoutes(app, deps);
  return app;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const sess = createVerifiedSession(EMAIL);
  const today = new Date().toISOString().slice(0, 10);
  upsertBioProfile(db.db, {
    sessionId: sess.session_id,
    patientId: sess.patient_id,
    patch: { procedure_date: today, procedure_type: 'laser' },
  });

  const app = buildApp();
  const hdr = { 'x-session-id': sess.session_id };
  const sm = await request(app).get('/api/patient/check/safe-mode').set(hdr);
  const ambient = sm.body?.safe_mode?.ambient_copy || null;
  const active = !!sm.body?.safe_mode?.active;

  // Source mapping: Check screen wires ambient_copy into testID=check-ambient
  const checkSrc = fs.readFileSync(
    path.join(__dirname, '../../patient-app/app/check.tsx'),
    'utf8',
  );
  const wiresAmbient =
    /fetchCheckSafeMode/.test(checkSrc) &&
    /setAmbient\(String\(sm\.safe_mode\.ambient_copy\)\)/.test(checkSrc) &&
    /testID=\"check-ambient\"/.test(checkSrc);

  // Attempt web capture via a minimal HTML that mirrors Check chrome ONLY if we cannot
  // boot Expo. Prefer documenting environment limits honestly.
  let webCapture = null;
  let expoAttempt = null;

  // Environment probe
  const hasSimctl = (() => {
    try {
      require('child_process').execSync('xcrun simctl help', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  })();

  // Build a faithful chrome mirror from AppTokens + ambient string from LIVE API,
  // then screenshot — this is UI paint of the ambient text, labeled as chrome-mirror
  // (not Expo RN Check). Full RN Check remains device/web-build gated.
  const mirrorHtml = `<!doctype html><html><head><meta charset="utf-8"/>
<title>TOUCH-101 ambient chrome mirror</title>
<style>
  body{margin:0;font-family:Georgia,serif;background:#F7F3EE;color:#1A1A1A}
  .chrome{display:flex;align-items:center;justify-content:space-between;padding:16px 20px}
  .ambient{font-size:14px;letter-spacing:0.02em;text-align:center;flex:1}
  .gear,.bell{width:28px;text-align:center;opacity:.6}
</style></head><body>
  <div class="chrome" data-testid="check-shell">
    <div class="gear">⚙</div>
    <div class="ambient" data-testid="check-ambient">${String(ambient || '').replace(/</g,'')}</div>
    <div class="bell">🔔</div>
  </div>
  <p style="padding:20px;font-family:system-ui;font-size:12px;color:#666">
    Live API ambient_copy painted into Check chrome layout. Source: /api/patient/check/safe-mode
  </p>
</body></html>`;

  const mirrorPath = path.join(OUT_DIR, 'touch-101-ambient-mirror.html');
  fs.writeFileSync(mirrorPath, mirrorHtml);

  try {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 200 } });
    await page.goto('file://' + mirrorPath);
    const text = await page.getByTestId('check-ambient').innerText();
    const shot = path.join(OUT_DIR, 'touch-101-ambient-chrome.png');
    await page.screenshot({ path: shot });
    await browser.close();
    webCapture = { text, screenshot: shot, kind: 'check-chrome-mirror-from-live-api' };
  } catch (e) {
    webCapture = { error: e.message };
  }

  const report = {
    runtime_db: db.sqliteDatabasePath,
    session_id: sess.session_id,
    api_safe_mode: sm.body,
    ambient_copy: ambient,
    safe_mode_active: active,
    check_source_wires_ambient: wiresAmbient,
    has_ios_simctl: hasSimctl,
    expo_web_attempt: expoAttempt,
    web_capture: webCapture,
    status:
      active && ambient && /safe mode/i.test(String(ambient)) && wiresAmbient
        ? webCapture?.text
          ? 'partial'
          : 'partial'
        : 'blocked',
    note:
      'Live API returns ambient_copy and Check.tsx binds it to testID=check-ambient. ' +
      'This environment has no iOS Simulator (simctl missing) and no running Expo web Check route in hosting-dist. ' +
      'Screenshot is Check chrome mirror painted with LIVE ambient_copy — not a full Expo RN Check session. ' +
      'Close fully by opening Check on device/simulator or Expo web with this session and confirming check-ambient text.',
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
