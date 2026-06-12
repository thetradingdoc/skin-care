'use strict';

const Database = require('better-sqlite3');
const { findBarrierDip } = require('../services/barrier-insight-service');

describe('barrier-insight-service', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    const migration = require('../migrations/055_conflict_engine');
    migration.up(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch (_) {}
  });

  function insertRow(sessionId, date, bfi, conflicts) {
    db
      .prepare(
        `INSERT INTO patient_routine_lineup_snapshots
         (id, session_id, entry_date, barrier_friction_index, verdict_json, lineup_hash, slots_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        `snap-${date}`,
        sessionId,
        date,
        bfi,
        JSON.stringify({ conflicts: conflicts || [] }),
        'hash1',
        '[]',
      );
  }

  test('returns null when drop is under 10 points', () => {
    insertRow('sess-1', '2026-06-10', 80, []);
    insertRow('sess-1', '2026-06-09', 75, []);
    expect(findBarrierDip(db, { sessionId: 'sess-1' })).toBeNull();
  });

  test('returns dip with drop_points and pattern_count', () => {
    const conflict = [
      { ingredient_a: 'retinol', ingredient_b: 'BHA', notes: 'Separate nights' },
    ];
    insertRow('sess-1', '2026-06-11', 62, conflict);
    insertRow('sess-1', '2026-06-10', 85, conflict);
    insertRow('sess-1', '2026-06-09', 88, conflict);
    insertRow('sess-1', '2026-06-08', 70, conflict);
    insertRow('sess-1', '2026-06-07', 90, conflict);

    const dip = findBarrierDip(db, { sessionId: 'sess-1' });
    expect(dip).not.toBeNull();
    expect(dip.drop_points).toBe(23);
    expect(dip.pattern_count).toBeGreaterThanOrEqual(1);
    expect(dip.title).toMatch(/retinol/i);
    expect(dip.message).toMatch(/dropped 23 points/i);
  });
});
