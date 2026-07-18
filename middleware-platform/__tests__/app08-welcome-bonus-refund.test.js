'use strict';

const Database = require('better-sqlite3');
const {
  tryConsume,
  refundFailedIfNeeded,
  ensureTables,
  resolveOwnerKey,
} = require('../services/ai-capture-meter');

describe('APP-08 meter refund matrix + welcome_bonus restore', () => {
  let db;
  const orig = { ...process.env };

  beforeEach(() => {
    db = new Database(':memory:');
    ensureTables(db);
    require('../migrations/066_ai_welcome_bonus').up(db);
    require('../migrations/071_ai_credits_ledger').up(db);
    process.env.AI_FREE_CAPTURE_LIMIT = '0';
    process.env.AI_WELCOME_BONUS_LIMIT = '2';
  });

  afterEach(() => {
    db.close();
    process.env = { ...orig };
  });

  test('adversarial: welcome_bonus refund restores remaining (reconciled with SEC-31 consume)', () => {
    db.prepare(
      `INSERT INTO ai_welcome_bonus (id, owner_key, patient_id, quota, remaining, issued_at, expires_at, created_at)
       VALUES ('wb1', 'patient:pat_wb', 'pat_wb', 2, 2, datetime('now'), datetime('now', '+7 days'), datetime('now'))`
    ).run();

    const consumed = tryConsume(db, {
      patientId: 'pat_wb',
      sessionId: 's1',
      captureKind: 'single',
    });
    expect(consumed.ok).toBe(true);
    expect(consumed.source).toBe('welcome_bonus');
    expect(
      db.prepare(`SELECT remaining FROM ai_welcome_bonus WHERE id = 'wb1'`).get().remaining
    ).toBe(1);

    const refund = refundFailedIfNeeded(db, consumed.usageId, { reason: 'ocr_empty' });
    expect(refund.refunded).toBe(true);
    expect(refund.welcome_restored).toBe(true);
    expect(
      db.prepare(`SELECT remaining FROM ai_welcome_bonus WHERE id = 'wb1'`).get().remaining
    ).toBe(2);

    // Double refund is idempotent on status; remaining must not exceed quota
    const again = refundFailedIfNeeded(db, consumed.usageId, { reason: 'ocr_empty' });
    expect(again.reason).toBe('already_refunded');
    expect(
      db.prepare(`SELECT remaining FROM ai_welcome_bonus WHERE id = 'wb1'`).get().remaining
    ).toBe(2);
  });

  test('SEC-31 consume + APP-08 refund are one path (consume uses changes===1)', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../services/ai-capture-meter.js'),
      'utf8'
    );
    expect(src).toMatch(/dec\.changes === 1/);
    expect(src).toMatch(/welcome_restored/);
    expect(src).toMatch(/MIN\(quota, remaining \+ 1\)/);
    expect(resolveOwnerKey({ patientId: 'p' })).toBe('patient:p');
  });

  test('refund matrix: monthly status flip restores quota (count consumed)', () => {
    process.env.AI_FREE_CAPTURE_LIMIT = '2';
    process.env.AI_WELCOME_BONUS_LIMIT = '0';
    const a = tryConsume(db, { patientId: 'pat_m', sessionId: 's', captureKind: 'single' });
    expect(a.ok).toBe(true);
    expect(a.source).toBe('monthly');
    const before = db
      .prepare(
        `SELECT COUNT(*) AS n FROM ai_capture_usage WHERE owner_key = ? AND status = 'consumed'`
      )
      .get('patient:pat_m').n;
    expect(before).toBe(1);
    const refund = refundFailedIfNeeded(db, a.usageId, { reason: 'ocr_empty' });
    expect(refund.refunded).toBe(true);
    expect(refund.welcome_restored).toBe(false);
    const after = db
      .prepare(
        `SELECT COUNT(*) AS n FROM ai_capture_usage WHERE owner_key = ? AND status = 'consumed'`
      )
      .get('patient:pat_m').n;
    expect(after).toBe(0);
  });

  test('refund matrix: plus source flips status without welcome restore', () => {
    const a = tryConsume(db, {
      patientId: 'pat_plus',
      sessionId: 's',
      captureKind: 'single',
      isPlus: true,
    });
    expect(a.source).toBe('plus');
    const refund = refundFailedIfNeeded(db, a.usageId, { reason: 'vision_empty' });
    expect(refund.refunded).toBe(true);
    expect(refund.welcome_restored).toBe(false);
    expect(refund.credit_restored).toBe(false);
  });
});
