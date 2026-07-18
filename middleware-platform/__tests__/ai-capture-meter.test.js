'use strict';

const Database = require('better-sqlite3');
const {
  ensureTables,
  getMeterConfig,
  tryConsume,
  getUsage,
  issueWelcomeBonusIfNeeded,
  recordUsageTokens,
} = require('../services/ai-capture-meter');

describe('ai-capture-meter', () => {
  let db;
  const prev = {};

  beforeEach(() => {
    for (const k of [
      'AI_FREE_CAPTURE_LIMIT',
      'AI_WELCOME_BONUS_LIMIT',
      'AI_WELCOME_BONUS_DAYS',
      'AI_BURST_LIMIT_24H',
    ]) {
      prev[k] = process.env[k];
    }
    process.env.AI_FREE_CAPTURE_LIMIT = '3';
    process.env.AI_WELCOME_BONUS_LIMIT = '2';
    process.env.AI_WELCOME_BONUS_DAYS = '7';
    process.env.AI_BURST_LIMIT_24H = '5';
    db = new Database(':memory:');
    ensureTables(db);
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    try {
      db.close();
    } catch (_) {}
  });

  test('getMeterConfig reads env defaults', () => {
    const cfg = getMeterConfig();
    expect(cfg.freeCaptureLimit).toBe(3);
    expect(cfg.welcomeBonusLimit).toBe(2);
    expect(cfg.welcomeBonusDays).toBe(7);
    expect(cfg.burstLimit24h).toBe(5);
  });

  test('monthly limit returns 402 AI_CAPTURE_LIMIT with manual_allowed', () => {
    const opts = { patientId: 'p1', sessionId: 's1', captureKind: 'face_read_vision' };
    // Welcome rows still count toward monthlyUsed; with limit=3 → 3 allowed then 402
    expect(tryConsume(db, opts).ok).toBe(true);
    expect(tryConsume(db, opts).ok).toBe(true);
    expect(tryConsume(db, opts).ok).toBe(true);
    const denied = tryConsume(db, opts);
    expect(denied.ok).toBe(false);
    expect(denied.status).toBe(402);
    expect(denied.body.error_code).toBe('AI_CAPTURE_LIMIT');
    expect(denied.body.manual_allowed).toBe(true);
  });

  test('H4 tryConsume issues welcome bonus on first authenticated AI capture', () => {
    const before = db.prepare(`SELECT COUNT(*) AS c FROM ai_welcome_bonus`).get().c;
    expect(before).toBe(0);
    const first = tryConsume(db, {
      patientId: 'p_h4',
      sessionId: 's_h4',
      captureKind: 'billing_ocr',
    });
    expect(first.ok).toBe(true);
    expect(first.source).toBe('welcome_bonus');
    const row = db
      .prepare(`SELECT quota, remaining FROM ai_welcome_bonus WHERE owner_key = ?`)
      .get('patient:p_h4');
    expect(row.quota).toBe(2);
    expect(row.remaining).toBe(1);
  });

  test('welcome bonus consumed before monthly', () => {
    issueWelcomeBonusIfNeeded(db, { patientId: 'p2', sessionId: 's2' });
    const opts = { patientId: 'p2', sessionId: 's2', captureKind: 'billing_ocr' };
    const a = tryConsume(db, opts);
    const b = tryConsume(db, opts);
    expect(a.source).toBe('welcome_bonus');
    expect(b.source).toBe('welcome_bonus');
    const c = tryConsume(db, opts);
    expect(c.ok).toBe(true);
    expect(c.source).toBe('monthly');
  });

  test('burst limit returns 429 AI_BURST_LIMIT', () => {
    process.env.AI_FREE_CAPTURE_LIMIT = '100';
    process.env.AI_BURST_LIMIT_24H = '2';
    const opts = { patientId: 'p3', sessionId: 's3', captureKind: 'weekly_photo_rescore' };
    expect(tryConsume(db, opts).ok).toBe(true);
    expect(tryConsume(db, opts).ok).toBe(true);
    const denied = tryConsume(db, opts);
    expect(denied.ok).toBe(false);
    expect(denied.status).toBe(429);
    expect(denied.body.error_code).toBe('AI_BURST_LIMIT');
    expect(denied.body.manual_allowed).toBe(true);
  });

  test('Plus bypasses monthly but still subject to burst', () => {
    process.env.AI_FREE_CAPTURE_LIMIT = '1';
    process.env.AI_BURST_LIMIT_24H = '100';
    const opts = {
      patientId: 'p4',
      sessionId: 's4',
      captureKind: 'face_read_vision',
      isPlus: true,
    };
    const a = tryConsume(db, opts);
    const b = tryConsume(db, opts);
    expect(a.ok).toBe(true);
    expect(a.source).toBe('plus');
    expect(b.ok).toBe(true);
    expect(b.source).toBe('plus');
    const usage = getUsage(db, { patientId: 'p4', sessionId: 's4', isPlus: true });
    expect(usage.unlimited).toBe(true);
  });

  test('recordUsageTokens writes cost fields onto usage row', () => {
    const gate = tryConsume(db, {
      patientId: 'p5',
      sessionId: 's5',
      captureKind: 'face_read_vision',
    });
    recordUsageTokens(db, gate.usageId, {
      promptTokens: 1000,
      completionTokens: 200,
      estimatedUsd: 0.005,
      model: 'gpt-4o',
    });
    const row = db.prepare(`SELECT * FROM ai_capture_usage WHERE id = ?`).get(gate.usageId);
    expect(row.prompt_tokens).toBe(1000);
    expect(row.completion_tokens).toBe(200);
    expect(row.estimated_usd).toBeCloseTo(0.005);
    expect(row.model).toBe('gpt-4o');
  });

  test('refundFailedIfNeeded restores monthly quota', () => {
    const { refundFailedIfNeeded } = require('../services/ai-capture-meter');
    process.env.AI_FREE_CAPTURE_LIMIT = '1';
    // Session-only owner avoids auto welcome bonus (H4 issues only when patientId set)
    const opts = { sessionId: 's6_refund', captureKind: 'billing_ocr' };
    const gate = tryConsume(db, opts);
    expect(gate.ok).toBe(true);
    expect(tryConsume(db, opts).ok).toBe(false);
    const refund = refundFailedIfNeeded(db, gate.usageId, { reason: 'test' });
    expect(refund.refunded).toBe(true);
    expect(tryConsume(db, opts).ok).toBe(true);
  });
});
