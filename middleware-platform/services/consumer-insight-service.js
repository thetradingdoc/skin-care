'use strict';

const { redisGet, redisSet } = require('../lib/redis-client');

function isV3InsightsEnabled() {
  const v = process.env.FEATURE_V3_INSIGHTS;
  return v === '1' || v === 'true' || v === 'TRUE';
}

function isV3InsightsLlmEnabled() {
  const v = process.env.FEATURE_V3_INSIGHTS_LLM;
  return v === '1' || v === 'true';
}

function computeProductInsight({
  product,
  bioProfile,
  barrierFrictionIndex,
  phaseLabel,
  lineupHash,
}) {
  const ingredients = String(product?.ingredients_text || product?.custom_product_name || '').toLowerCase();
  const bfi = Number(barrierFrictionIndex);
  const conditions = (bioProfile?.conditions || []).map((c) => (typeof c === 'string' ? c : c?.id || '')).filter(Boolean);

  let severity = 'info';
  const notes = [];

  if (Number.isFinite(bfi) && bfi < 60) {
    severity = 'caution';
    notes.push('Your barrier score is low — introduce actives slowly.');
  } else if (Number.isFinite(bfi) && bfi < 80) {
    severity = 'watch';
    notes.push('Barrier is under mild stress — spacing actives may help.');
  }

  if (/retinol|tretinoin|adapalene|benzoyl|glycolic|salicylic|ascorbic|acid/.test(ingredients)) {
    if (conditions.includes('barrier_compromised') || conditions.includes('rosacea')) {
      severity = severity === 'info' ? 'watch' : severity;
      notes.push('This product contains actives that can irritate sensitive or compromised skin.');
    }
  }

  if (phaseLabel) {
    notes.push(`Current program phase: ${phaseLabel}.`);
  }

  const title = product?.product_name || product?.custom_product_name || 'Your product';
  const message =
    notes.length > 0
      ? notes.join(' ')
      : 'This product fits your current routine profile. Keep logging photos to track results.';

  return {
    title,
    message,
    barrier_note: Number.isFinite(bfi) ? `Barrier friction index: ${Math.round(bfi)}` : null,
    routine_note: phaseLabel || null,
    skin_note: conditions.length ? `Profile conditions: ${conditions.join(', ')}` : null,
    severity,
    lineup_hash: lineupHash || null,
  };
}

async function getCachedInsight(cacheKey) {
  const raw = await redisGet(cacheKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function setCachedInsight(cacheKey, insight) {
  await redisSet(cacheKey, JSON.stringify(insight), 3600);
}

module.exports = {
  isV3InsightsEnabled,
  isV3InsightsLlmEnabled,
  computeProductInsight,
  getCachedInsight,
  setCachedInsight,
};
