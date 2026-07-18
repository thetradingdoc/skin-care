// Simple in-memory metrics (can be replaced by Prometheus later)
const counters = Object.create(null);

/** Dual-write ops: total + per-bridge (M18). */
const DUAL_WRITE_FAIL_TOTAL = 'patient_record_dual_write_fail';
const DUAL_WRITE_BRIDGES = {
  'journal→skin': 'patient_record_dual_write_fail.journal_skin',
  'spots→mark': 'patient_record_dual_write_fail.spots_mark',
  'billing→bill': 'patient_record_dual_write_fail.billing_bill',
};

/** P6.04 — Paid-money fulfillment failures (same alert cadence pattern as dual-write). */
const PAID_MONEY_FAIL_TOTAL = 'paid_money_fulfillment_fail';
const PAID_MONEY_BRIDGES = {
  'stripe→ai_credits': 'paid_money_fulfillment_fail.stripe_ai_credits',
  'stripe→plus': 'paid_money_fulfillment_fail.stripe_plus',
};

function increment(name, value = 1) {
  counters[name] = (counters[name] || 0) + value;
}

function get(name) {
  return counters[name] || 0;
}

function getAll() {
  return { ...counters };
}

function resetForTests() {
  for (const k of Object.keys(counters)) delete counters[k];
}

function dualWriteAlertThreshold() {
  return Math.max(1, Number(process.env.PATIENT_RECORD_DUAL_WRITE_FAIL_ALERT || 5));
}

function dualWriteAlertCadence() {
  // Re-alert every N additional failures after the initial trip (default = same as threshold).
  return Math.max(1, Number(process.env.PATIENT_RECORD_DUAL_WRITE_FAIL_ALERT_CADENCE || dualWriteAlertThreshold()));
}

/**
 * M18 — Alert when dual-write failures spike, with durable re-fire cadence.
 *
 * Behavior (not one-shot):
 *   - First alert when total reaches PATIENT_RECORD_DUAL_WRITE_FAIL_ALERT (default 5)
 *   - Re-alert every PATIENT_RECORD_DUAL_WRITE_FAIL_ALERT_CADENCE additional failures
 *     (default = threshold), e.g. 5, 10, 15, …
 *   - Failures between cadence points stay silent (warn-level per-failure still logs)
 *
 * In-memory per process (Cloud Run instance); replace with Prometheus later.
 */
function shouldFireDualWriteAlert(total, { threshold = null, cadence = null } = {}) {
  const limit = threshold != null ? Number(threshold) : dualWriteAlertThreshold();
  const step = cadence != null ? Number(cadence) : dualWriteAlertCadence();
  if (!Number.isFinite(limit) || limit < 1) return false;
  if (!Number.isFinite(step) || step < 1) return false;
  if (total < limit) return false;
  if (total === limit) return true;
  return (total - limit) % step === 0;
}

function checkDualWriteFailAlert({ threshold = null, cadence = null, logger = console } = {}) {
  const limit = threshold != null ? Number(threshold) : dualWriteAlertThreshold();
  const step = cadence != null ? Number(cadence) : dualWriteAlertCadence();
  const total = get(DUAL_WRITE_FAIL_TOTAL);
  const detail = {
    total,
    threshold: limit,
    cadence: step,
    journal_skin: get(DUAL_WRITE_BRIDGES['journal→skin']),
    spots_mark: get(DUAL_WRITE_BRIDGES['spots→mark']),
    billing_bill: get(DUAL_WRITE_BRIDGES['billing→bill']),
  };

  if (!shouldFireDualWriteAlert(total, { threshold: limit, cadence: step })) {
    return { alerted: false, ...detail };
  }

  const msg =
    `[ALERT] patient_record_dual_write_fail=${total} (threshold=${limit}, cadence=${step}) ` +
    `journal_skin=${detail.journal_skin} spots_mark=${detail.spots_mark} billing_bill=${detail.billing_bill}`;
  if (typeof logger.error === 'function') logger.error(msg, detail);
  else logger.error(msg);
  return { alerted: true, ...detail };
}

/**
 * Record a dual-write failure for one of the three bridges.
 * Always increments total + bridge-specific counter, then checks alert cadence.
 */
function recordDualWriteFailure(bridgeLabel, { errorMessage = null, logger = console } = {}) {
  const bridgeKey = DUAL_WRITE_BRIDGES[bridgeLabel] || `${DUAL_WRITE_FAIL_TOTAL}.unknown`;
  increment(DUAL_WRITE_FAIL_TOTAL, 1);
  increment(bridgeKey, 1);
  if (errorMessage && typeof logger.warn === 'function') {
    logger.warn(`[dual-write:${bridgeLabel}] failed (primary write already committed): ${errorMessage}`);
  }
  return checkDualWriteFailAlert({ logger });
}

function paidMoneyAlertThreshold() {
  return Math.max(
    1,
    Number(process.env.PAID_MONEY_FAIL_ALERT || process.env.PATIENT_RECORD_DUAL_WRITE_FAIL_ALERT || 5),
  );
}

function paidMoneyAlertCadence() {
  return Math.max(
    1,
    Number(
      process.env.PAID_MONEY_FAIL_ALERT_CADENCE ||
        process.env.PATIENT_RECORD_DUAL_WRITE_FAIL_ALERT_CADENCE ||
        paidMoneyAlertThreshold(),
    ),
  );
}

function checkPaidMoneyFailAlert({ threshold = null, cadence = null, logger = console } = {}) {
  const limit = threshold != null ? Number(threshold) : paidMoneyAlertThreshold();
  const step = cadence != null ? Number(cadence) : paidMoneyAlertCadence();
  const total = get(PAID_MONEY_FAIL_TOTAL);
  const detail = {
    total,
    threshold: limit,
    cadence: step,
    stripe_ai_credits: get(PAID_MONEY_BRIDGES['stripe→ai_credits']),
    stripe_plus: get(PAID_MONEY_BRIDGES['stripe→plus']),
  };
  if (!shouldFireDualWriteAlert(total, { threshold: limit, cadence: step })) {
    return { alerted: false, ...detail };
  }
  const msg =
    `[ALERT] paid_money_fulfillment_fail=${total} (threshold=${limit}, cadence=${step}) ` +
    `stripe_ai_credits=${detail.stripe_ai_credits} stripe_plus=${detail.stripe_plus}`;
  if (typeof logger.error === 'function') logger.error(msg, detail);
  else logger.error(msg);
  return { alerted: true, ...detail };
}

/**
 * P6.04 — Record a paid-money path failure (webhook ledger / Plus entitlement).
 * Reuses dual-write alert cadence pattern — not a third alerting mechanism.
 */
function recordPaidMoneyFailure(bridgeLabel, { errorMessage = null, logger = console } = {}) {
  const bridgeKey = PAID_MONEY_BRIDGES[bridgeLabel] || `${PAID_MONEY_FAIL_TOTAL}.unknown`;
  increment(PAID_MONEY_FAIL_TOTAL, 1);
  increment(bridgeKey, 1);
  if (errorMessage && typeof logger.error === 'function') {
    logger.error(`[paid-money:${bridgeLabel}] FAILED — user may have paid without entitlement: ${errorMessage}`);
  } else if (errorMessage && typeof logger.warn === 'function') {
    logger.warn(`[paid-money:${bridgeLabel}] FAILED: ${errorMessage}`);
  }
  return checkPaidMoneyFailAlert({ logger });
}

module.exports = {
  increment,
  get,
  getAll,
  resetForTests,
  checkDualWriteFailAlert,
  recordDualWriteFailure,
  shouldFireDualWriteAlert,
  dualWriteAlertThreshold,
  dualWriteAlertCadence,
  DUAL_WRITE_FAIL_TOTAL,
  DUAL_WRITE_BRIDGES,
  checkPaidMoneyFailAlert,
  recordPaidMoneyFailure,
  paidMoneyAlertThreshold,
  paidMoneyAlertCadence,
  PAID_MONEY_FAIL_TOTAL,
  PAID_MONEY_BRIDGES,
};
