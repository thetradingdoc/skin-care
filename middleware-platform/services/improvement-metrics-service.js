'use strict';

const { firstAndLatestPayloadForSession } = require('./skin-age-readings');

function scoreVal(scores, key) {
  const v = scores?.[key];
  return Number.isFinite(Number(v)) ? Number(v) : null;
}

function avgConcern(scores, keys) {
  const vals = keys.map((k) => scoreVal(scores, k)).filter((v) => v != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function computeImprovementMetrics(db, { sessionId, patientId, skinAgeDelta = null }) {
  const pair = firstAndLatestPayloadForSession(db, sessionId, patientId);
  if (!pair?.first || !pair?.latest || (pair.reading_count != null && pair.reading_count < 2)) {
    return {
      clarity_pct: null,
      redness_pct: null,
      skin_age_delta: skinAgeDelta,
    };
  }

  const clarityKeys = ['texture', 'hyperpigmentation'];
  const firstClarity = avgConcern(pair.first.concern_scores, clarityKeys);
  const latestClarity = avgConcern(pair.latest.concern_scores, clarityKeys);
  const clarityPct =
    firstClarity != null && latestClarity != null
      ? Math.round((firstClarity - latestClarity) * 33)
      : null;

  const firstRed = scoreVal(pair.first.concern_scores, 'redness');
  const latestRed = scoreVal(pair.latest.concern_scores, 'redness');
  const rednessPct =
    firstRed != null && latestRed != null ? Math.round((firstRed - latestRed) * 33) : null;

  return {
    clarity_pct: clarityPct,
    redness_pct: rednessPct,
    skin_age_delta: skinAgeDelta,
  };
}

module.exports = { computeImprovementMetrics };
