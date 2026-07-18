'use strict';

/**
 * P5.08 / P5.09 — Progress honest aggregates over patient_record_facts.
 * Counts only — never percentages, rates, or inferred trend lines.
 */

const factsRepo = require('../../repositories/patient-record-facts-repo');

const FORBIDDEN_AGGREGATE_KEYS = [
  'clarity_pct',
  'redness_pct',
  'improvement_pct',
  'percent',
  'percentage',
  'pct_',
  '_pct',
  'rate_',
  '_rate',
  'trend_line',
  'inferred_trend',
];

function assertNoPercentageFields(payload, path = '') {
  if (payload == null || typeof payload !== 'object') return;
  for (const [k, v] of Object.entries(payload)) {
    const keyPath = path ? `${path}.${k}` : k;
    const lower = k.toLowerCase();
    // Exact / suffix style — avoid matching honesty flags like no_percentages
    if (
      FORBIDDEN_AGGREGATE_KEYS.some((f) => lower === f || lower.endsWith(f) || lower.startsWith(f)) ||
      /(_pct|pct_|_rate|rate_)$/.test(lower) ||
      lower === 'pct' ||
      lower === 'rate'
    ) {
      const err = new Error(`FORBIDDEN_AGGREGATE_FIELD:${keyPath}`);
      err.code = 'FORBIDDEN_AGGREGATE_FIELD';
      err.field = keyPath;
      throw err;
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      assertNoPercentageFields(v, keyPath);
    }
  }
}

function requireOwner({ patientId, sessionId }) {
  if (!patientId && !sessionId) {
    const err = new Error('OWNER_REQUIRED');
    err.code = 'OWNER_REQUIRED';
    throw err;
  }
}

/**
 * Build progress modules. Empty modules are omitted entirely (P5.09).
 */
function buildProgressAggregates(db, { patientId = null, sessionId = null, todayIso = null } = {}) {
  requireOwner({ patientId, sessionId });
  factsRepo.ensurePatientRecordFactsTable(db);

  const facts = factsRepo.listFacts(db, {
    patientId: patientId || null,
    sessionId: patientId ? null : sessionId,
    limit: 500,
  }).filter((f) => f.confirmed_at);

  const skinFacts = facts.filter((f) => f.tag === 'skin');
  const billFacts = facts.filter((f) => f.tag === 'bill');
  const rxFacts = facts.filter((f) => f.tag === 'prescription');
  const markFacts = facts.filter((f) => f.tag === 'mark');

  const out = {
    success: true,
    as_of: todayIso || new Date().toISOString().slice(0, 10),
    source: 'patient_record_facts',
    honesty: {
      counts_only: true,
      no_inferred_trends: true,
      fabricated_stats_retired: true,
    },
  };

  // Skin module — only if skin facts exist
  if (skinFacts.length) {
    let calmerDays = 0;
    let worseDays = 0;
    let sameDays = 0;
    let baselineDays = 0;
    let selfReported = 0;
    let confirmedAi = 0;
    for (const f of skinFacts) {
      if (f.ai_or_manual === 'manual') selfReported += 1;
      if (f.ai_or_manual === 'ai') confirmedAi += 1;
      const delta = f.structured_json?.ai_suggestion?.delta;
      if (delta === 'calmer') calmerDays += 1;
      else if (delta === 'worse') worseDays += 1;
      else if (delta === 'same') sameDays += 1;
      else if (delta === 'baseline') baselineDays += 1;
    }
    out.skin = {
      fact_count: skinFacts.length,
      calmer_day_count: calmerDays,
      worse_day_count: worseDays,
      same_day_count: sameDays,
      baseline_day_count: baselineDays,
      self_reported_count: selfReported,
      confirmed_ai_count: confirmedAi,
    };
  }

  if (billFacts.length) {
    let totalCents = 0;
    let currency = 'USD';
    for (const f of billFacts) {
      const cents = Number(f.structured_json?.amount_cents);
      if (Number.isFinite(cents)) totalCents += Math.round(cents);
      else if (f.structured_json?.amount != null) {
        // Legacy major-unit rows (pre-migration)
        const major = Number(f.structured_json.amount);
        if (Number.isFinite(major)) totalCents += Math.round(major * 100);
      }
      if (f.structured_json?.currency) currency = String(f.structured_json.currency);
    }
    out.bill = {
      fact_count: billFacts.length,
      total_amount_cents: totalCents,
      total_amount: Math.round(totalCents) / 100,
      currency,
    };
  }

  if (rxFacts.length) {
    const withReminder = rxFacts.filter((f) => f.structured_json?.reminder_opt_in === true);
    out.rx = {
      fact_count: rxFacts.length,
      reminder_opt_in_count: withReminder.length,
      reminders: withReminder.map((f) => ({
        fact_id: f.id,
        drug: f.structured_json?.drug || null,
        expiry: f.expiry_date || f.structured_json?.expiry || null,
        provider: f.provider || f.structured_json?.prescriber || null,
        subtype: f.fact_subtype || f.structured_json?.rx_kind || null,
      })),
    };
  }

  if (markFacts.length) {
    out.mark = {
      fact_count: markFacts.length,
      compare_group_count: new Set(markFacts.map((f) => f.compare_group_id).filter(Boolean)).size,
    };
  }

  assertNoPercentageFields(out);
  return out;
}

module.exports = {
  buildProgressAggregates,
  assertNoPercentageFields,
  FORBIDDEN_AGGREGATE_KEYS,
};
