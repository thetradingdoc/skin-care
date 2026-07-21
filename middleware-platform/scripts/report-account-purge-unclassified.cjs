'use strict';

/**
 * Print unclassified patient-keyed tables (decision backlog).
 * Usage: node scripts/report-account-purge-unclassified.cjs
 */

const {
  classifyTable,
  PURGED,
  RETAINED_WITH_REASON,
  GRANDFATHERED_UNCLASSIFIED,
  GRANDFATHERED_UNCLASSIFIED_DEADLINE_ISO,
  listNewUnclassifiedGaps,
} = require('../services/account-purge-table-registry');
const { listPatientKeyedTables } = require('./discover-patient-keyed-tables.cjs');

const discovered = listPatientKeyedTables();
const unclassified = [];
for (const { name, sources } of discovered) {
  if (classifyTable(name).status === 'UNCLASSIFIED') {
    unclassified.push({ name, sources });
  }
}
const newGaps = listNewUnclassifiedGaps(discovered);

console.log(
  JSON.stringify(
    {
      purged_registry_count: PURGED.length,
      retained_registry_count: Object.keys(RETAINED_WITH_REASON).length,
      grandfathered_count: GRANDFATHERED_UNCLASSIFIED.length,
      grandfathered_deadline: GRANDFATHERED_UNCLASSIFIED_DEADLINE_ISO,
      discovered_patient_keyed: discovered.length,
      unclassified_count: unclassified.length,
      new_unclassified_gaps: newGaps.length,
      unclassified: unclassified.map((u) => ({
        table: u.name,
        sources: u.sources,
      })),
      new_gaps: newGaps.map((u) => ({ table: u.name, sources: u.sources })),
    },
    null,
    2,
  ),
);

// Exit 1 only for NEW gaps (grandfathered backlog is tracked separately / deadline tripwire).
process.exit(newGaps.length ? 1 : 0);
