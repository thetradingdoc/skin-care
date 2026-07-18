'use strict';

/**
 * P6.01 / P6.04 — Patient AI credits ledger.
 * Append-only audit trail; stored balance must match SUM(delta).
 * Fail-loud on ownership / insufficient balance — never silent drift.
 */

const { v4: uuidv4 } = require('uuid');
const { resolveOwnerKey } = require('./ai-capture-meter');

function ensureCreditsTables(db) {
  require('../migrations/071_ai_credits_ledger').up(db);
}

function getBalanceRow(db, ownerKey) {
  ensureCreditsTables(db);
  return (
    db.prepare(`SELECT * FROM ai_credits_balance WHERE owner_key = ? LIMIT 1`).get(ownerKey) || {
      owner_key: ownerKey,
      balance: 0,
      packs_purchased: 0,
    }
  );
}

function reconstructBalanceFromLedger(db, ownerKey) {
  ensureCreditsTables(db);
  const row = db
    .prepare(`SELECT COALESCE(SUM(delta), 0) AS s FROM ai_credits_ledger WHERE owner_key = ?`)
    .get(ownerKey);
  return Number(row?.s) || 0;
}

function assertBalanceMatchesLedger(db, ownerKey) {
  const stored = Number(getBalanceRow(db, ownerKey).balance) || 0;
  const reconstructed = reconstructBalanceFromLedger(db, ownerKey);
  if (stored !== reconstructed) {
    const err = new Error(`CREDITS_BALANCE_DRIFT stored=${stored} ledger=${reconstructed}`);
    err.code = 'CREDITS_BALANCE_DRIFT';
    err.stored = stored;
    err.reconstructed = reconstructed;
    throw err;
  }
  return { ok: true, balance: stored };
}

/**
 * Append ledger entry and update balance atomically.
 * stripe_event_id UNIQUE → duplicate fulfillment is fail-loud idempotent skip.
 */
function applyLedgerMutation(db, {
  patientId,
  sessionId = null,
  delta,
  reason,
  stripeEventId = null,
  stripeCheckoutSessionId = null,
  packSize = null,
  metadata = null,
} = {}) {
  ensureCreditsTables(db);
  if (!patientId) {
    const err = new Error('PATIENT_ID_REQUIRED');
    err.code = 'PATIENT_ID_REQUIRED';
    throw err;
  }
  const d = Number(delta);
  if (!Number.isFinite(d) || d === 0) {
    const err = new Error('DELTA_REQUIRED');
    err.code = 'DELTA_REQUIRED';
    throw err;
  }
  if (!reason) {
    const err = new Error('REASON_REQUIRED');
    err.code = 'REASON_REQUIRED';
    throw err;
  }

  const ownerKey = resolveOwnerKey({ patientId, sessionId });
  if (!ownerKey) {
    const err = new Error('OWNER_REQUIRED');
    err.code = 'OWNER_REQUIRED';
    throw err;
  }

  if (stripeEventId) {
    const existing = db
      .prepare(`SELECT id FROM ai_credits_ledger WHERE stripe_event_id = ? LIMIT 1`)
      .get(stripeEventId);
    if (existing) {
      return {
        ok: true,
        duplicate: true,
        ledger_id: existing.id,
        balance: getBalanceRow(db, ownerKey).balance,
      };
    }
  }

  const current = getBalanceRow(db, ownerKey);
  const nextBalance = Number(current.balance || 0) + d;
  if (nextBalance < 0) {
    const err = new Error('INSUFFICIENT_CREDITS');
    err.code = 'INSUFFICIENT_CREDITS';
    err.balance = current.balance;
    err.delta = d;
    throw err;
  }

  const id = `acl_${uuidv4()}`;
  const packsDelta = d > 0 && packSize ? 1 : 0;

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO ai_credits_ledger
        (id, patient_id, session_id, owner_key, delta, reason,
         stripe_event_id, stripe_checkout_session_id, pack_size, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      patientId,
      sessionId || null,
      ownerKey,
      d,
      String(reason),
      stripeEventId || null,
      stripeCheckoutSessionId || null,
      packSize != null ? Number(packSize) : null,
      metadata != null ? JSON.stringify(metadata) : null,
    );

    db.prepare(
      `INSERT INTO ai_credits_balance (owner_key, patient_id, session_id, balance, packs_purchased, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(owner_key) DO UPDATE SET
         balance = excluded.balance,
         packs_purchased = ai_credits_balance.packs_purchased + excluded.packs_purchased,
         patient_id = COALESCE(excluded.patient_id, ai_credits_balance.patient_id),
         session_id = COALESCE(excluded.session_id, ai_credits_balance.session_id),
         updated_at = datetime('now')`,
    ).run(
      ownerKey,
      patientId,
      sessionId || null,
      nextBalance,
      packsDelta,
    );
  });
  tx();

  assertBalanceMatchesLedger(db, ownerKey);
  return {
    ok: true,
    duplicate: false,
    ledger_id: id,
    delta: d,
    balance: nextBalance,
    reason,
  };
}

function creditPackPurchase(db, opts) {
  const packSize = Number(opts.packSize || opts.credits || 20);
  if (!Number.isFinite(packSize) || packSize <= 0) {
    const err = new Error('PACK_SIZE_REQUIRED');
    err.code = 'PACK_SIZE_REQUIRED';
    throw err;
  }
  return applyLedgerMutation(db, {
    ...opts,
    delta: packSize,
    reason: opts.reason || 'credit_pack_purchase',
    packSize,
  });
}

function consumeCredit(db, opts) {
  return applyLedgerMutation(db, {
    ...opts,
    delta: -1,
    reason: opts.reason || 'ai_capture_consume',
  });
}

function refundCredit(db, opts) {
  return applyLedgerMutation(db, {
    ...opts,
    delta: 1,
    reason: opts.reason || 'ai_capture_refund',
  });
}

function getCreditsSnapshot(db, { patientId, sessionId }) {
  ensureCreditsTables(db);
  const ownerKey = resolveOwnerKey({ patientId, sessionId });
  if (!ownerKey) {
    return { owner_key: null, balance: 0, packs_purchased: 0 };
  }
  const row = getBalanceRow(db, ownerKey);
  return {
    owner_key: ownerKey,
    balance: Number(row.balance) || 0,
    packs_purchased: Number(row.packs_purchased) || 0,
  };
}

function listLedger(db, { patientId, limit = 50 }) {
  ensureCreditsTables(db);
  if (!patientId) return [];
  return db
    .prepare(
      `SELECT * FROM ai_credits_ledger WHERE patient_id = ?
       ORDER BY datetime(created_at) DESC LIMIT ?`,
    )
    .all(patientId, Math.min(200, Number(limit) || 50));
}

module.exports = {
  ensureCreditsTables,
  getBalanceRow,
  reconstructBalanceFromLedger,
  assertBalanceMatchesLedger,
  applyLedgerMutation,
  creditPackPurchase,
  consumeCredit,
  refundCredit,
  getCreditsSnapshot,
  listLedger,
};
