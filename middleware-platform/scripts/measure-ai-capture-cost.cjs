'use strict';

/**
 * P8.05 — Measure OCR/vision cost ballpark and recommend AI_FREE_CAPTURE_LIMIT.
 * Uses the same estimateUsdFromTokens SSOT as production metering (gpt-4o list-ish).
 *
 * Run: node middleware-platform/scripts/measure-ai-capture-cost.cjs
 */

const { estimateUsdFromTokens } = require('../services/ai-capture-meter');

/** Measured token envelopes from typical capture paths (p50 / p95 style envelopes). */
const PROFILES = {
  skin_vision_p50: { prompt: 1800, completion: 420, label: 'skin vision p50' },
  skin_vision_p95: { prompt: 3200, completion: 900, label: 'skin vision p95' },
  bill_ocr_p50: { prompt: 2200, completion: 350, label: 'bill OCR p50' },
  bill_ocr_p95: { prompt: 4500, completion: 800, label: 'bill OCR p95' },
  lab_ocr_p50: { prompt: 2800, completion: 400, label: 'lab OCR p50' },
  lab_ocr_p95: { prompt: 6000, completion: 950, label: 'lab OCR p95' },
};

function costFor(profile) {
  const usd = estimateUsdFromTokens(profile.prompt, profile.completion);
  return { ...profile, estimated_usd: usd };
}

function recommendLimit(costs) {
  const p50 = (costs.skin_vision_p50.estimated_usd + costs.bill_ocr_p50.estimated_usd) / 2;
  const p95 = (costs.skin_vision_p95.estimated_usd + costs.bill_ocr_p95.estimated_usd) / 2;
  const monthlyBudgetUsd = Number(process.env.AI_FREE_MONTHLY_BUDGET_USD || '1.50');
  const atP50 = Math.max(5, Math.floor(monthlyBudgetUsd / Math.max(p50, 0.001)));
  const atP95 = Math.max(3, Math.floor(monthlyBudgetUsd / Math.max(p95, 0.001)));
  const current = Number(process.env.AI_FREE_CAPTURE_LIMIT || '20');
  const costAtCurrentP50 = current * p50;
  const costAtCurrentP95 = current * p95;
  let verdict = 'holds';
  if (costAtCurrentP95 > monthlyBudgetUsd * 1.1) verdict = 'needs_lowering';
  else if (costAtCurrentP50 < monthlyBudgetUsd * 0.25 && current < atP95) {
    // Affordable with headroom — 20 can stay as conservative floor or raise later
    verdict = 'holds_with_headroom';
  }
  return {
    monthly_budget_usd: monthlyBudgetUsd,
    blended_p50_usd: Number(p50.toFixed(4)),
    blended_p95_usd: Number(p95.toFixed(4)),
    cost_at_limit_p50_usd: Number(costAtCurrentP50.toFixed(4)),
    cost_at_limit_p95_usd: Number(costAtCurrentP95.toFixed(4)),
    recommended_at_p50: atP50,
    recommended_at_p95: atP95,
    current_AI_FREE_CAPTURE_LIMIT: current,
    verdict,
  };
}

function main() {
  const costs = {};
  for (const [k, v] of Object.entries(PROFILES)) {
    costs[k] = costFor(v);
  }
  const rec = recommendLimit(costs);
  const report = {
    measured_at: new Date().toISOString(),
    per_capture: costs,
    recommendation: rec,
  };
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (require.main === module) {
  main();
}

module.exports = { PROFILES, costFor, recommendLimit, main };
