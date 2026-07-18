'use strict';

/**
 * P5.02 — Agent-delta extension over patient_record_facts (not journal severity table).
 * N-day-worse streak + shelf product co-occurrence exit-ramp.
 */

const factsRepo = require('../../repositories/patient-record-facts-repo');

const DEFAULT_N_DAYS = Math.max(2, Number(process.env.AGENT_DELTA_N_DAY_WORSE || 3));

function isoDaysBefore(todayIso, n) {
  const d = new Date(`${todayIso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function factDate(fact) {
  const d = fact?.structured_json?.date;
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function deltaOf(fact) {
  const d = fact?.structured_json?.ai_suggestion?.delta;
  return typeof d === 'string' ? d.toLowerCase() : null;
}

/**
 * Load confirmed skin facts in [start, end] for this patient only (fail-loud if no owner).
 */
function listOwnedSkinFacts(db, { patientId, sessionId, startIso, endIso }) {
  if (!patientId && !sessionId) {
    const err = new Error('OWNER_REQUIRED');
    err.code = 'OWNER_REQUIRED';
    throw err;
  }
  return factsRepo.listFacts(db, {
    patientId: patientId || null,
    sessionId: patientId ? null : sessionId,
    tag: 'skin',
    startIso,
    endIso,
    limit: 90,
  }).filter((f) => f.confirmed_at);
}

function loadShelfProductNames(db, { sessionId }) {
  if (!sessionId) return [];
  try {
    const {
      ensurePatientShelfInventoryColumns,
      loadPatientShelfProductRows,
      formatShelfProductApiRow,
    } = require('../../lib/patient-shelf-api');
    ensurePatientShelfInventoryColumns();
    return loadPatientShelfProductRows(sessionId)
      .map(formatShelfProductApiRow)
      .map((p) => ({
        id: p.id,
        name: p.product_name || p.name || '',
        role: String(p.role || p.slot || '').toLowerCase(),
      }))
      .filter((p) => p.name);
  } catch (_) {
    return [];
  }
}

/**
 * @returns {{ show: boolean, n_day_worse: object|null, product_cooccurrence: object|null, message: string|null, source: 'patient_record_facts' }}
 */
function computeFactsAgentDelta(db, {
  patientId = null,
  sessionId = null,
  todayIso,
  nDays = DEFAULT_N_DAYS,
} = {}) {
  if (!todayIso || !/^\d{4}-\d{2}-\d{2}$/.test(todayIso)) {
    const err = new Error('TODAY_ISO_REQUIRED');
    err.code = 'TODAY_ISO_REQUIRED';
    throw err;
  }

  const startIso = isoDaysBefore(todayIso, nDays - 1);
  const facts = listOwnedSkinFacts(db, { patientId, sessionId, startIso, endIso: todayIso });

  // One fact per day (latest confirmed)
  const byDay = new Map();
  for (const f of facts) {
    const d = factDate(f);
    if (!d) continue;
    if (!byDay.has(d) || String(f.confirmed_at) > String(byDay.get(d).confirmed_at)) {
      byDay.set(d, f);
    }
  }

  const dayDeltas = [];
  for (let i = 0; i < nDays; i++) {
    const day = isoDaysBefore(todayIso, nDays - 1 - i);
    const fact = byDay.get(day);
    dayDeltas.push({ date: day, delta: fact ? deltaOf(fact) : null, fact_id: fact?.id || null });
  }

  const worseStreak = dayDeltas.every((d) => d.delta === 'worse');
  let n_day_worse = null;
  let product_cooccurrence = null;
  let message = null;

  if (worseStreak) {
    n_day_worse = {
      n_days: nDays,
      days: dayDeltas,
      source: 'patient_record_facts',
    };
    const products = loadShelfProductNames(db, { sessionId });
    const actives = products.filter((p) =>
      /\b(retin|tretin|aha|bha|acid|peroxide|active)\b/i.test(p.name) ||
      /active|retinoid|exfol/.test(p.role),
    );
    if (actives.length) {
      product_cooccurrence = {
        products: actives.slice(0, 5).map((p) => ({ id: p.id, name: p.name })),
        exit_ramp: 'skip_active_tonight',
        source: 'patient_record_facts+shelf',
      };
      message = `Skin notes marked worse for ${nDays} days in a row while actives are on your shelf. Skip actives tonight?`;
    } else {
      message = `Skin notes marked worse for ${nDays} days in a row. Ease your routine tonight?`;
    }
  }

  return {
    show: Boolean(n_day_worse),
    n_day_worse,
    product_cooccurrence,
    message,
    source: 'patient_record_facts',
    queried_table: 'patient_record_facts',
  };
}

module.exports = {
  DEFAULT_N_DAYS,
  computeFactsAgentDelta,
  listOwnedSkinFacts,
  isoDaysBefore,
};
