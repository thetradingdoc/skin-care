'use strict';

const Database = require('better-sqlite3');
const {
  createOrGetPending,
  attachFactId,
  bindCaptureTokenToOtpSession,
  claimPendingCaptures,
  purgeExpiredPendingCaptures,
  getPendingByToken,
} = require('../services/pending-capture-claim');
const factsRepo = require('../repositories/patient-record-facts-repo');
const {
  tryConsume,
  getUsage,
  mergeOwnerUsage,
  resolveOwnerKey,
  ensureTables: ensureMeterTables,
} = require('../services/ai-capture-meter');

describe('P2.20–P2.26 pending capture binding', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    ensureMeterTables(db);
    factsRepo.ensurePatientRecordFactsTable(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch (_) {}
  });

  test('P2.20/21 anonymous fact + pending bundle', () => {
    const pending = createOrGetPending(db, { ttlHours: 72 });
    expect(pending.capture_token).toMatch(/^cap_/);
    expect(pending.anon_session_id).toMatch(/^anon_/);
    expect(pending.patient_id).toBeNull();
    expect(pending.status).toBe('pending');

    const fact = factsRepo.insertFact(db, {
      patient_id: null,
      session_id: pending.anon_session_id,
      tag: 'skin',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-07-16', note: 'pre-auth' },
      confirmed_at: new Date().toISOString(),
      request_id: 'anon-req-1',
    });
    attachFactId(db, pending.capture_token, fact.id);

    expect(fact.patient_id).toBeNull();
    expect(fact.owner_key).toBe(`session:${pending.anon_session_id}`);

    const refreshed = getPendingByToken(db, pending.capture_token);
    expect(JSON.parse(refreshed.fact_ids_json)).toContain(fact.id);
  });

  test('P2.22/24 claim rebinds facts and merges meter', () => {
    const pending = createOrGetPending(db);
    const fact = factsRepo.insertFact(db, {
      patient_id: null,
      session_id: pending.anon_session_id,
      tag: 'bill',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-07-01', amount: 12 },
    });
    attachFactId(db, pending.capture_token, fact.id);

    // Anonymous AI usage under session owner
    const consumed = tryConsume(db, {
      sessionId: pending.anon_session_id,
      captureKind: 'skin_vision',
    });
    expect(consumed.ok).toBe(true);

    const patientId = 'Patient/test-claim-1';
    const portalSessionId = 'portal_sess_1';
    const bind = bindCaptureTokenToOtpSession(db, {
      captureToken: pending.capture_token,
      otpSessionId: portalSessionId,
    });
    expect(bind.ok).toBe(true);

    const claim = claimPendingCaptures(db, {
      captureToken: pending.capture_token,
      patientId,
      portalSessionId,
    });

    expect(claim.claimed).toBe(true);
    expect(claim.facts_claimed).toBeGreaterThanOrEqual(1);
    expect(claim.meter_merge?.usage_moved).toBeGreaterThanOrEqual(1);

    const owned = factsRepo.getFactById(db, fact.id);
    expect(owned.patient_id).toBe(patientId);
    expect(owned.owner_key).toBe(`patient:${patientId}`);

    const usage = getUsage(db, { patientId });
    expect(usage.monthly_used).toBeGreaterThanOrEqual(1);

    // Idempotent re-claim
    const again = claimPendingCaptures(db, {
      captureToken: pending.capture_token,
      patientId,
      portalSessionId,
    });
    expect(again.claimed).toBe(true);
    expect(again.reason).toBe('already_claimed');
  });

  test('claim without OTP bind is rejected; mismatched session rejected', () => {
    const pending = createOrGetPending(db);
    const fact = factsRepo.insertFact(db, {
      patient_id: null,
      session_id: pending.anon_session_id,
      tag: 'skin',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-07-16', note: 'x' },
    });
    attachFactId(db, pending.capture_token, fact.id);

    const unbound = claimPendingCaptures(db, {
      captureToken: pending.capture_token,
      patientId: 'Patient/attacker',
      portalSessionId: 'attacker_sess',
    });
    expect(unbound.claimed).toBe(false);
    expect(unbound.reason).toBe('otp_session_unbound');

    bindCaptureTokenToOtpSession(db, {
      captureToken: pending.capture_token,
      otpSessionId: 'victim_sess',
    });
    const mismatch = claimPendingCaptures(db, {
      captureToken: pending.capture_token,
      patientId: 'Patient/attacker',
      portalSessionId: 'attacker_sess',
    });
    expect(mismatch.claimed).toBe(false);
    expect(mismatch.reason).toBe('otp_session_mismatch');

    const rebind = bindCaptureTokenToOtpSession(db, {
      captureToken: pending.capture_token,
      otpSessionId: 'attacker_sess',
    });
    expect(rebind.ok).toBe(false);
    expect(rebind.reason).toBe('already_bound_other_session');
  });

  test('P2.25 pending TTL sets expires_at in the future', () => {
    const pending = createOrGetPending(db, { ttlHours: 72 });
    expect(pending.expires_at).toBeTruthy();
    expect(new Date(pending.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  test('P2.26 purge deletes expired unclaimed facts', () => {
    const pending = createOrGetPending(db, { ttlHours: 1 });
    const fact = factsRepo.insertFact(db, {
      patient_id: null,
      session_id: pending.anon_session_id,
      tag: 'other',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-07-01', label: 'note' },
    });
    attachFactId(db, pending.capture_token, fact.id);

    // Force expiry
    db.prepare(`UPDATE pending_captures SET expires_at = ? WHERE id = ?`).run(
      '2020-01-01T00:00:00.000Z',
      pending.id,
    );

    const result = purgeExpiredPendingCaptures(db);
    expect(result.purged_bundles).toBe(1);
    expect(factsRepo.getFactById(db, fact.id)).toBeNull();
    expect(getPendingByToken(db, pending.capture_token).status).toBe('purged');
  });

  test('mergeOwnerUsage is a no-op when keys match', () => {
    const key = resolveOwnerKey({ patientId: 'Patient/x' });
    const r = mergeOwnerUsage(db, { fromOwnerKey: key, toOwnerKey: key });
    expect(r.skipped).toBe(true);
  });
});
