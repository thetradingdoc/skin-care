'use strict';

const db = require('../database');

function ensureJournalTables(sqliteDb) {
  const migration = require('../migrations/059_patient_journal');
  const target = sqliteDb || db.db;
  if (migration?.up) migration.up(target);
}

module.exports = {
  ensureJournalTables,
};
