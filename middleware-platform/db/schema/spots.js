'use strict';

const { pgTable, text, timestamp, jsonb } = require('drizzle-orm/pg-core');

const patientSpots = pgTable('patient_spots', {
  id: text('id').primaryKey(),
  ownerKey: text('owner_key').notNull(),
  label: text('label').notNull(),
  bodyRegion: text('body_region').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
});

const patientSpotSnapshots = pgTable('patient_spot_snapshots', {
  id: text('id').primaryKey(),
  spotId: text('spot_id').notNull(),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
  storageRef: text('storage_ref'),
  thumbStorageRef: text('thumb_storage_ref'),
  journalEntryId: text('journal_entry_id'),
  analysisJson: jsonb('analysis_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

module.exports = { patientSpots, patientSpotSnapshots };
