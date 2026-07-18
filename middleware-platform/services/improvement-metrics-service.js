'use strict';

const { firstAndLatestPayloadForSession } = require('./skin-age-readings');

/**
 * Progress improvement payload.
 *
 * Historically clarity_pct / redness_pct were invented as
 *   Math.round((firstScore - latestScore) * 33)
 * which turned 0–3 concern scores into fake "percent" bars.
 * That fabrication is removed — clarity/redness stay null.
 * skin_age_delta is passed through when the caller supplies a real delta.
 */
function computeImprovementMetrics(db, { sessionId, patientId, skinAgeDelta = null }) {
  const pair = firstAndLatestPayloadForSession(db, sessionId, patientId);
  const enoughReadings = Boolean(
    pair?.first && pair?.latest && !(pair.reading_count != null && pair.reading_count < 2),
  );

  return {
    clarity_pct: null,
    redness_pct: null,
    skin_age_delta: skinAgeDelta,
    fabricated_pct_retired: true,
    enough_readings_for_skin_age: enoughReadings,
  };
}

module.exports = { computeImprovementMetrics };
