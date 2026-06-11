'use strict';

const Database = require('better-sqlite3');
const { insertSkinAgeReading } = require('../services/skin-age-readings');
const { computeImprovementMetrics } = require('../services/improvement-metrics-service');

describe('improvement-metrics-service', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    const migration = require('../migrations/029_skin_age_journey');
    migration.up(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch (_) {}
  });

  test('returns null metrics when fewer than two readings with payloads', () => {
    insertSkinAgeReading(db, {
      session_id: 'sess-1',
      apparent_age_estimate: 32,
      payload_json: { concern_scores: { texture: 2, redness: 1 } },
    });
    const result = computeImprovementMetrics(db, { sessionId: 'sess-1', skinAgeDelta: -1 });
    expect(result.clarity_pct).toBeNull();
    expect(result.redness_pct).toBeNull();
    expect(result.skin_age_delta).toBe(-1);
  });

  test('computes clarity and redness deltas from first vs latest concern_scores', () => {
    insertSkinAgeReading(db, {
      session_id: 'sess-1',
      apparent_age_estimate: 34,
      payload_json: {
        concern_scores: { texture: 3, hyperpigmentation: 3, redness: 3 },
      },
    });
    insertSkinAgeReading(db, {
      session_id: 'sess-1',
      apparent_age_estimate: 31,
      payload_json: {
        concern_scores: { texture: 2, hyperpigmentation: 2, redness: 1 },
      },
    });
    const result = computeImprovementMetrics(db, { sessionId: 'sess-1', skinAgeDelta: -3 });
    expect(result.clarity_pct).toBe(33);
    expect(result.redness_pct).toBe(66);
    expect(result.skin_age_delta).toBe(-3);
  });
});
