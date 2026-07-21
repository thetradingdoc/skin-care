'use strict';

/**
 * Standing gate: every patient-keyed table must be PURGED or RETAINED_WITH_REASON.
 * Existing backlog may sit in GRANDFATHERED_UNCLASSIFIED until product/legal classifies
 * (or until GRANDFATHERED_UNCLASSIFIED_DEADLINE_ISO). NEW unclassified names fail CI.
 *
 * Run: npm run test:account-purge-coverage
 */

const {
  PURGED,
  RETAINED_WITH_REASON,
  GRANDFATHERED_UNCLASSIFIED,
  GRANDFATHERED_UNCLASSIFIED_DEADLINE_ISO,
  classifyTable,
  purgedSet,
  retainedSet,
  grandfatheredSet,
  listNewUnclassifiedGaps,
} = require('../services/account-purge-table-registry');
const { listPatientKeyedTables } = require('../scripts/discover-patient-keyed-tables.cjs');
const fs = require('fs');
const path = require('path');

describe('account purge coverage registry', () => {
  test('RETAINED_WITH_REASON entries must include a non-empty reason', () => {
    for (const [table, reason] of Object.entries(RETAINED_WITH_REASON)) {
      expect(String(reason || '').trim().length).toBeGreaterThan(8);
      expect(purgedSet().has(table)).toBe(false);
    }
  });

  test('PURGED list has no duplicates', () => {
    expect(new Set(PURGED).size).toBe(PURGED.length);
  });

  test('GRANDFATHERED_UNCLASSIFIED has no duplicates and does not overlap PURGED/RETAINED', () => {
    expect(new Set(GRANDFATHERED_UNCLASSIFIED).size).toBe(GRANDFATHERED_UNCLASSIFIED.length);
    const purged = purgedSet();
    const retained = retainedSet();
    for (const t of GRANDFATHERED_UNCLASSIFIED) {
      expect(purged.has(t)).toBe(false);
      expect(retained.has(t)).toBe(false);
    }
  });

  test('every PURGED table is referenced by purgePatientAccount source', () => {
    const purgeSrc = fs.readFileSync(
      path.join(__dirname, '../services/patient-account-purge-service.js'),
      'utf8',
    );
    const factsPurgeSrc = fs.readFileSync(
      path.join(__dirname, '../services/patient-record-facts-purge.js'),
      'utf8',
    );
    const kellySrc = fs.readFileSync(
      path.join(__dirname, '../services/progress-kelly-nudge-state.js'),
      'utf8',
    );
    const blob = `${purgeSrc}\n${factsPurgeSrc}\n${kellySrc}`;
    const missingFromSource = PURGED.filter((t) => {
      // tombstone table is created/inserted; funnel/fhir may appear as UPDATE only
      return !blob.includes(t);
    });
    expect(missingFromSource).toEqual([]);
  });

  test('no NEW unclassified patient-keyed tables beyond GRANDFATHERED_UNCLASSIFIED', () => {
    const discovered = listPatientKeyedTables();
    const newGaps = listNewUnclassifiedGaps(discovered);

    const grandfatheredHit = [];
    const purged = [];
    const retained = [];
    for (const { name } of discovered) {
      const c = classifyTable(name);
      if (c.status === 'PURGED') purged.push(name);
      else if (c.status === 'RETAINED_WITH_REASON') retained.push(name);
      else if (grandfatheredSet().has(name)) grandfatheredHit.push(name);
    }

    const message = [
      '',
      '=== ACCOUNT PURGE COVERAGE — NEW UNCLASSIFIED PATIENT-KEYED TABLE(S) ===',
      'A patient-keyed table appeared that is not PURGED, RETAINED_WITH_REASON,',
      'or on GRANDFATHERED_UNCLASSIFIED. Do not extend the grandfather list to',
      'silence this — wire purge (PURGED) or document retention (RETAINED_WITH_REASON).',
      '',
      ...newGaps.map((u) => `- ${u.name}  (${(u.sources || []).slice(0, 3).join(', ')})`),
      '',
      `counts: discovered=${discovered.length} purged=${purged.length} retained=${retained.length} grandfathered_hit=${grandfatheredHit.length} new_gaps=${newGaps.length}`,
      '',
    ].join('\n');

    if (newGaps.length) {
      // eslint-disable-next-line no-console
      console.error(message);
    }

    expect(newGaps).toEqual([]);
  });

  test('synthetic: listNewUnclassifiedGaps catches a fake new table (gate regression proof)', () => {
    const discovered = listPatientKeyedTables();
    const fakeName = '__synthetic_unclassified_purge_gap__';
    const withFake = [...discovered, { name: fakeName, sources: ['synthetic-test'] }];
    const gaps = listNewUnclassifiedGaps(withFake);
    expect(gaps.map((g) => g.name)).toContain(fakeName);
    // Control: real discovery alone must not include the fake
    expect(listNewUnclassifiedGaps(discovered).map((g) => g.name)).not.toContain(fakeName);
  });

  test('GRANDFATHERED_UNCLASSIFIED staleness tripwire (90-day debt clock)', () => {
    /**
     * After GRANDFATHERED_UNCLASSIFIED_DEADLINE_ISO, a non-empty grandfather list
     * fails CI again. When this fires:
     * 1) Classify each table as PURGED (wire purge) or RETAINED_WITH_REASON, OR
     * 2) Extend GRANDFATHERED_UNCLASSIFIED_DEADLINE_ISO with a comment explaining why.
     */
    const deadlineMs = Date.parse(GRANDFATHERED_UNCLASSIFIED_DEADLINE_ISO);
    expect(Number.isFinite(deadlineMs)).toBe(true);

    if (Date.now() < deadlineMs) {
      expect(GRANDFATHERED_UNCLASSIFIED.length).toBeGreaterThan(0); // debt still tracked
      return;
    }

    expect(GRANDFATHERED_UNCLASSIFIED).toEqual([]);
  });
});
