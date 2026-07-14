'use strict';

const db = require('../database');

function ensureJournalTables(sqliteDb) {
  const target = sqliteDb || db.db;
  require('../migrations/059_patient_journal').up(target);
  require('../migrations/060_journal_severity_levels').up(target);
}

module.exports = {
  ensureJournalTables,
};
