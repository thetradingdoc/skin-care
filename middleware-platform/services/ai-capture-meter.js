'use strict';

/**
 * P1.03–P1.13 — Unified AI capture meter (monthly free + welcome bonus + burst + Plus bypass).
 *
 * Interface:
 *   ensureTables(db)
 *   resolveOwnerKey({ patientId, sessionId }) → `patient:…` | `session:…` (prefixed)
 *   getUsage / tryConsume / recordUsageTokens / refundFailedIfNeeded / mergeOwnerUsage
 *
 * NOTE — dual metering (intentional until P6 consolidates):
 *   AI_FREE_CAPTURE_LIMIT meters GPT/OCR calls (this module).
 *   BILLING_FREE_SCAN_LIMIT separately caps billing document upload count/month.
 *   Do not treat them as the same budget.
 *
 * P6.06: tryConsume auto-issues welcome bonus when patientId is present (idempotent).
 *
 * NOTE — resolveOwnerKey here is NOT the same as db/client.resolveOwnerKey (raw ids).
 */

const { v4: uuidv4 } = require('uuid');

function envInt(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function getMeterConfig() {
  return {
    freeCaptureLimit: envInt('AI_FREE_CAPTURE_LIMIT', 20),
    welcomeBonusLimit: envInt('AI_WELCOME_BONUS_LIMIT', 12),
    welcomeBonusDays: envInt('AI_WELCOME_BONUS_DAYS', 7),
    burstLimit24h: envInt('AI_BURST_LIMIT_24H', 10),
  };
}

function resolveOwnerKey({ patientId, sessionId }) {
  const p = patientId != null ? String(patientId).trim() : '';
  const s = sessionId != null ? String(sessionId).trim() : '';
  if (p) return `patient:${p}`;
  if (s) return `session:${s}`;
  return null;
}

function ensureTables(db) {
  require('../migrations/065_ai_capture_usage').up(db);
  require('../migrations/066_ai_welcome_bonus').up(db);
}

function monthStartIso(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

function countConsumedSince(db, ownerKey, sinceIso) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM ai_capture_usage
       WHERE owner_key = ? AND status = 'consumed'
         AND datetime(created_at) >= datetime(?)`,
    )
    .get(ownerKey, sinceIso);
  return Number(row?.c) || 0;
}

function getWelcomeRow(db, ownerKey) {
  return db
    .prepare(
      `SELECT * FROM ai_welcome_bonus
       WHERE owner_key = ?
         AND remaining > 0
         AND datetime(expires_at) > datetime('now')
       LIMIT 1`,
    )
    .get(ownerKey);
}

function creditsSnap(db, { patientId, sessionId }) {
  try {
    const { getCreditsSnapshot } = require('./ai-credits-ledger');
    return getCreditsSnapshot(db, { patientId, sessionId });
  } catch (_) {
    return { balance: 0, packs_purchased: 0 };
  }
}

function getUsage(db, { patientId, sessionId, isPlus = false }) {
  ensureTables(db);
  const cfg = getMeterConfig();
  const ownerKey = resolveOwnerKey({ patientId, sessionId });
  const credits = creditsSnap(db, { patientId, sessionId });
  if (!ownerKey) {
    return {
      owner_key: null,
      unlimited: false,
      monthly_limit: cfg.freeCaptureLimit,
      monthly_used: 0,
      monthly_remaining: cfg.freeCaptureLimit,
      bonus_remaining: 0,
      bonus_expires_at: null,
      credits_balance: 0,
      packs_purchased: 0,
      burst_used_24h: 0,
      burst_limit_24h: cfg.burstLimit24h,
      is_plus: Boolean(isPlus),
    };
  }

  if (isPlus) {
    return {
      owner_key: ownerKey,
      unlimited: true,
      monthly_limit: null,
      monthly_used: null,
      monthly_remaining: null,
      bonus_remaining: null,
      bonus_expires_at: null,
      credits_balance: credits.balance || 0,
      packs_purchased: credits.packs_purchased || 0,
      burst_used_24h: countConsumedSince(db, ownerKey, new Date(Date.now() - 86400000).toISOString()),
      burst_limit_24h: cfg.burstLimit24h,
      is_plus: true,
    };
  }

  const monthlyUsed = countConsumedSince(db, ownerKey, monthStartIso());
  const bonus = getWelcomeRow(db, ownerKey);
  const burstUsed = countConsumedSince(db, ownerKey, new Date(Date.now() - 86400000).toISOString());

  return {
    owner_key: ownerKey,
    unlimited: false,
    monthly_limit: cfg.freeCaptureLimit,
    monthly_used: monthlyUsed,
    monthly_remaining: Math.max(0, cfg.freeCaptureLimit - monthlyUsed),
    bonus_remaining: bonus ? Number(bonus.remaining) : 0,
    bonus_expires_at: bonus?.expires_at || null,
    credits_balance: credits.balance || 0,
    packs_purchased: credits.packs_purchased || 0,
    burst_used_24h: burstUsed,
    burst_limit_24h: cfg.burstLimit24h,
    is_plus: false,
  };
}

function limitExceededBody(usage) {
  return {
    success: false,
    error: 'AI_CAPTURE_LIMIT',
    error_code: 'AI_CAPTURE_LIMIT',
    manual_allowed: true,
    message: 'AI capture limit reached. You can still enter details manually.',
    usage,
  };
}

function burstExceededBody(usage) {
  return {
    success: false,
    error: 'AI_BURST_LIMIT',
    error_code: 'AI_BURST_LIMIT',
    manual_allowed: true,
    message: 'Too many AI captures in 24 hours. Try again later or enter details manually.',
    usage,
  };
}

/**
 * Pre-flight consume. Inserts a consumed row when allowed.
 * Call recordUsageTokens after the GPT call when token counts are known.
 */
function tryConsume(db, { patientId, sessionId, captureKind, isPlus = false, model = null }) {
  ensureTables(db);
  const cfg = getMeterConfig();
  const ownerKey = resolveOwnerKey({ patientId, sessionId });
  if (!ownerKey) {
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        error: 'AI_METER_OWNER_REQUIRED',
        error_code: 'AI_METER_OWNER_REQUIRED',
        message: 'session_id or patient_id required to meter AI capture',
      },
    };
  }

  // P6.06 / H4 — first authenticated AI capture issues welcome bonus (idempotent)
  if (patientId) {
    try {
      issueWelcomeBonusIfNeeded(db, { patientId, sessionId });
    } catch (e) {
      console.warn('[ai-capture-meter] welcome bonus issue failed:', e.message);
    }
  }

  const usageSnapshot = getUsage(db, { patientId, sessionId, isPlus });

  // Burst applies even to Plus (abuse guard)
  if (usageSnapshot.burst_used_24h >= cfg.burstLimit24h) {
    return { ok: false, status: 429, body: burstExceededBody(usageSnapshot) };
  }

  if (isPlus) {
    const usageId = insertUsageRow(db, {
      patientId,
      sessionId,
      ownerKey,
      captureKind,
      model,
      status: 'consumed',
      meterSource: 'plus',
    });
    return {
      ok: true,
      usageId,
      source: 'plus',
      remaining: null,
      usage: getUsage(db, { patientId, sessionId, isPlus: true }),
    };
  }

  const bonus = getWelcomeRow(db, ownerKey);
  if (bonus && Number(bonus.remaining) > 0) {
    // SEC-31: atomic decrement — only insert usage if remaining actually decreased
    const dec = db
      .prepare(`UPDATE ai_welcome_bonus SET remaining = remaining - 1 WHERE id = ? AND remaining > 0`)
      .run(bonus.id);
    if (dec.changes === 1) {
      const usageId = insertUsageRow(db, {
        patientId,
        sessionId,
        ownerKey,
        captureKind,
        model,
        status: 'consumed',
        meterSource: 'welcome_bonus',
      });
      return {
        ok: true,
        usageId,
        source: 'welcome_bonus',
        remaining: Math.max(0, Number(bonus.remaining) - 1),
        usage: getUsage(db, { patientId, sessionId, isPlus: false }),
      };
    }
    // Lost race — fall through to other pools
  }

  // Paid credits (P6) — after welcome bonus, before monthly free pool
  if (patientId) {
    const credits = creditsSnap(db, { patientId, sessionId });
    if ((credits.balance || 0) > 0) {
      try {
        const { consumeCredit } = require('./ai-credits-ledger');
        consumeCredit(db, {
          patientId,
          sessionId,
          reason: 'ai_capture_consume',
          metadata: { capture_kind: captureKind },
        });
        const usageId = insertUsageRow(db, {
          patientId,
          sessionId,
          ownerKey,
          captureKind,
          model,
          status: 'consumed',
          meterSource: 'paid_credits',
        });
        return {
          ok: true,
          usageId,
          source: 'paid_credits',
          remaining: Math.max(0, (credits.balance || 0) - 1),
          usage: getUsage(db, { patientId, sessionId, isPlus: false }),
        };
      } catch (e) {
        if (e.code !== 'INSUFFICIENT_CREDITS') throw e;
      }
    }
  }

  // SEC-31: monthly free pool — serialize count+insert so concurrent captures cannot both pass the limit
  const monthlyTx = db.transaction(() => {
    const monthlyUsed = countConsumedSince(db, ownerKey, monthStartIso());
    if (monthlyUsed >= cfg.freeCaptureLimit) {
      return {
        ok: false,
        status: 402,
        body: limitExceededBody(getUsage(db, { patientId, sessionId, isPlus: false })),
      };
    }
    const usageId = insertUsageRow(db, {
      patientId,
      sessionId,
      ownerKey,
      captureKind,
      model,
      status: 'consumed',
      meterSource: 'monthly',
    });
    return {
      ok: true,
      usageId,
      source: 'monthly',
      remaining: Math.max(0, cfg.freeCaptureLimit - monthlyUsed - 1),
      usage: getUsage(db, { patientId, sessionId, isPlus: false }),
    };
  });
  return monthlyTx();
}

function insertUsageRow(db, { patientId, sessionId, ownerKey, captureKind, model, status, meterSource }) {
  const id = `aiu_${uuidv4()}`;
  ensureTables(db);
  require('../migrations/071_ai_credits_ledger').up(db);
  db.prepare(
    `INSERT INTO ai_capture_usage
      (id, patient_id, session_id, owner_key, capture_kind, model, status, meter_source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  ).run(
    id,
    patientId || null,
    sessionId || null,
    ownerKey,
    String(captureKind || 'unknown'),
    model || null,
    status || 'consumed',
    meterSource || null,
  );
  return id;
}

function recordUsageTokens(db, usageId, { promptTokens, completionTokens, estimatedUsd, model } = {}) {
  if (!usageId) return;
  ensureTables(db);
  db.prepare(
    `UPDATE ai_capture_usage
     SET prompt_tokens = ?,
         completion_tokens = ?,
         estimated_usd = ?,
         model = COALESCE(?, model)
     WHERE id = ?`,
  ).run(
    promptTokens != null ? Number(promptTokens) : null,
    completionTokens != null ? Number(completionTokens) : null,
    estimatedUsd != null ? Number(estimatedUsd) : null,
    model || null,
    usageId,
  );
}

/**
 * P1.03 / P3.06 / P6 / APP-08 — Mark a consume as refunded when AI work failed before useful output.
 * Restores monthly/burst quota (status='consumed' only).
 * Paid credits (meter_source=paid_credits) are returned to the ledger.
 * Welcome-bonus remaining is restored atomically (APP-08; mirrors SEC-31 consume with changes===1).
 */
function refundFailedIfNeeded(db, usageId, { reason = null } = {}) {
  if (!usageId) return { refunded: false, reason: 'no_usage_id' };
  ensureTables(db);
  require('../migrations/071_ai_credits_ledger').up(db);
  require('../migrations/066_ai_welcome_bonus').up(db);
  const row = db
    .prepare(`SELECT id, status, meter_source, patient_id, session_id FROM ai_capture_usage WHERE id = ? LIMIT 1`)
    .get(usageId);
  if (!row) return { refunded: false, reason: 'not_found' };
  if (row.status === 'refunded') return { refunded: true, reason: 'already_refunded' };
  if (row.status !== 'consumed') return { refunded: false, reason: `status_${row.status}` };
  const flipped = db
    .prepare(`UPDATE ai_capture_usage SET status = 'refunded' WHERE id = ? AND status = 'consumed'`)
    .run(usageId);
  if (flipped.changes !== 1) {
    return { refunded: false, reason: 'status_race' };
  }

  let credit_restored = false;
  let welcome_restored = false;

  if (row.meter_source === 'paid_credits' && row.patient_id) {
    try {
      const { refundCredit } = require('./ai-credits-ledger');
      refundCredit(db, {
        patientId: row.patient_id,
        sessionId: row.session_id,
        reason: 'ai_capture_refund',
        metadata: { usage_id: usageId, fail_reason: reason },
      });
      credit_restored = true;
    } catch (e) {
      const Metrics = require('./metrics');
      Metrics.recordPaidMoneyFailure('stripe→ai_credits', {
        errorMessage: `refund_credit_failed:${e.message}`,
      });
      throw e;
    }
  }

  if (row.meter_source === 'welcome_bonus') {
    const ownerKey = resolveOwnerKey({
      patientId: row.patient_id,
      sessionId: row.session_id,
    });
    if (ownerKey) {
      // Cap at quota; only restore if row still active (not expired)
      const dec = db
        .prepare(
          `UPDATE ai_welcome_bonus
           SET remaining = MIN(quota, remaining + 1)
           WHERE owner_key = ?
             AND remaining < quota
             AND datetime(expires_at) > datetime('now')`,
        )
        .run(ownerKey);
      welcome_restored = dec.changes === 1;
      if (!welcome_restored) {
        console.warn(
          `[ai-capture-meter] welcome_bonus restore missed for ${usageId} owner=${ownerKey}`,
        );
      }
    }
  }

  if (reason) {
    console.warn(`[ai-capture-meter] refunded ${usageId}: ${reason}`);
  }
  return {
    refunded: true,
    reason: reason || 'ok',
    credit_restored,
    welcome_restored,
  };
}

/**
 * Issue welcome bonus for an owner (idempotent per owner_key).
 * Used by P6.06 after first authenticated AI capture; exported for tests.
 */
function issueWelcomeBonusIfNeeded(db, { patientId, sessionId }) {
  ensureTables(db);
  const cfg = getMeterConfig();
  const ownerKey = resolveOwnerKey({ patientId, sessionId });
  if (!ownerKey) return null;
  const existing = db.prepare(`SELECT id FROM ai_welcome_bonus WHERE owner_key = ? LIMIT 1`).get(ownerKey);
  if (existing) return existing;
  const id = `aiwb_${uuidv4()}`;
  const expires = new Date(Date.now() + cfg.welcomeBonusDays * 86400000).toISOString();
  db.prepare(
    `INSERT INTO ai_welcome_bonus
      (id, patient_id, session_id, owner_key, quota, remaining, issued_at, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'))`,
  ).run(id, patientId || null, sessionId || null, ownerKey, cfg.welcomeBonusLimit, cfg.welcomeBonusLimit, expires);
  return { id, expires_at: expires, quota: cfg.welcomeBonusLimit };
}

/** Rough USD estimate when OpenAI usage is known (gpt-4o ballpark). */
function estimateUsdFromTokens(promptTokens, completionTokens) {
  const p = Number(promptTokens) || 0;
  const c = Number(completionTokens) || 0;
  // gpt-4o list-ish: ~$2.50 / 1M in, ~$10 / 1M out (order-of-magnitude for logging)
  return Math.round((p * 2.5 + c * 10) / 1000) / 1000;
}

/**
 * P2.24 — Rebind anonymous session meter rows onto patient owner after OTP claim.
 * Moves ai_capture_usage + ai_welcome_bonus from fromOwnerKey → toOwnerKey.
 */
function mergeOwnerUsage(db, { fromOwnerKey, toOwnerKey, patientId = null, sessionId = null }) {
  ensureTables(db);
  if (!fromOwnerKey || !toOwnerKey || fromOwnerKey === toOwnerKey) {
    return { ok: true, usage_moved: 0, bonus_moved: false, skipped: true };
  }

  const usage = db
    .prepare(`UPDATE ai_capture_usage SET owner_key = ?, patient_id = COALESCE(?, patient_id), session_id = COALESCE(?, session_id) WHERE owner_key = ?`)
    .run(toOwnerKey, patientId || null, sessionId || null, fromOwnerKey);

  // Welcome bonus: if patient already has one, keep patient's and drop anon; else rekey anon → patient
  const patientBonus = db.prepare(`SELECT id FROM ai_welcome_bonus WHERE owner_key = ? LIMIT 1`).get(toOwnerKey);
  const anonBonus = db.prepare(`SELECT id FROM ai_welcome_bonus WHERE owner_key = ? LIMIT 1`).get(fromOwnerKey);
  let bonusMoved = false;
  if (anonBonus) {
    if (patientBonus) {
      db.prepare(`DELETE FROM ai_welcome_bonus WHERE id = ?`).run(anonBonus.id);
    } else {
      db.prepare(
        `UPDATE ai_welcome_bonus
         SET owner_key = ?, patient_id = COALESCE(?, patient_id), session_id = COALESCE(?, session_id)
         WHERE id = ?`,
      ).run(toOwnerKey, patientId || null, sessionId || null, anonBonus.id);
      bonusMoved = true;
    }
  }

  return {
    ok: true,
    usage_moved: usage.changes || 0,
    bonus_moved: bonusMoved,
    from_owner_key: fromOwnerKey,
    to_owner_key: toOwnerKey,
  };
}

module.exports = {
  ensureTables,
  getMeterConfig,
  resolveOwnerKey,
  getUsage,
  tryConsume,
  recordUsageTokens,
  issueWelcomeBonusIfNeeded,
  estimateUsdFromTokens,
  mergeOwnerUsage,
  refundFailedIfNeeded,
};
