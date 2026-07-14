'use strict';

/**
 * TOUCH-066–068 — Alerts surface: hard-no louder than caution; only when count > 0.
 */

const { runEvaluatePipelineSync } = require('./consumer-evaluate-nodes');
const {
  ensurePatientShelfInventoryColumns,
  loadPatientShelfProductRows,
  formatShelfProductApiRow,
} = require('../lib/patient-shelf-api');

function buildPatientAlerts(db, { sessionId, patientId }) {
  ensurePatientShelfInventoryColumns();
  const alerts = [];

  let evaluate = null;
  try {
    evaluate = runEvaluatePipelineSync(db, { sessionId, patientId });
  } catch (_) {
    evaluate = null;
  }

  if (evaluate && !evaluate.graph_unavailable) {
    for (const hit of evaluate.hard_no_hits || []) {
      alerts.push({
        id: hit.id || `hard_no_${hit.allergen_class}`,
        kind: 'hard_no',
        severity: 'hard_no',
        title: 'Hard no',
        message: hit.notes || `Ruled out: ${hit.label || hit.allergen_class}`,
        product_id: null,
      });
    }
    for (const c of evaluate.conflicts || []) {
      if (c.verdict === 'hard_no') continue;
      if (c.verdict === 'avoid' || c.severity === 'critical' || c.severity === 'high') {
        alerts.push({
          id: `conflict_${c.ingredient_a}_${c.ingredient_b}`,
          kind: 'conflict',
          severity: c.verdict === 'avoid' ? 'hard_no' : 'caution',
          title: c.verdict === 'avoid' ? 'High conflict' : 'Caution',
          message: c.notes || `${c.ingredient_a} × ${c.ingredient_b}`,
          product_id: null,
        });
      } else if (c.verdict === 'caution' || c.severity === 'moderate') {
        alerts.push({
          id: `caution_${c.ingredient_a}_${c.ingredient_b}`,
          kind: 'caution',
          severity: 'caution',
          title: 'Caution',
          message: c.notes || `${c.ingredient_a} × ${c.ingredient_b}`,
          product_id: null,
        });
      }
    }
    for (const a of evaluate.contraindication_alerts || []) {
      alerts.push({
        id: `contra_${a.title || a.ingredient}`,
        kind: 'contraindication',
        severity: a.severity === 'high' ? 'hard_no' : 'caution',
        title: a.title || 'Profile alert',
        message: a.message || '',
        product_id: null,
      });
    }
  }

  const shelf = loadPatientShelfProductRows(sessionId).map(formatShelfProductApiRow);
  for (const p of shelf) {
    if (p.days_left != null && p.days_left <= 30) {
      alerts.push({
        id: `expiry_${p.id}`,
        kind: 'expiry',
        severity: p.days_left <= 7 ? 'hard_no' : 'caution',
        title: p.days_left <= 0 ? 'Expired' : 'Expiring soon',
        message: `${p.product_name} · ${p.days_left <= 0 ? 'past expiry' : `${p.days_left} days left`}`,
        product_id: p.id,
      });
    }
  }

  // Dedupe by id
  const seen = new Set();
  const unique = [];
  for (const a of alerts) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    unique.push(a);
  }

  // hard_no first
  unique.sort((a, b) => {
    const rank = (s) => (s === 'hard_no' ? 0 : 1);
    return rank(a.severity) - rank(b.severity);
  });

  return {
    count: unique.length,
    alerts: unique,
    safe_mode: evaluate?.safe_mode || { active: false },
  };
}

module.exports = { buildPatientAlerts };
