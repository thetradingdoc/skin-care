'use strict';

const { pgTable, text, boolean, timestamp } = require('drizzle-orm/pg-core');

const patientConsumerProfiles = pgTable('patient_consumer_profiles', {
  ownerKey: text('owner_key').primaryKey(),
  patientId: text('patient_id'),
  sessionId: text('session_id'),
  journeyModes: text('journey_modes').array().notNull().default([]),
  primaryMode: text('primary_mode'),
  onboardingComplete: boolean('onboarding_complete').notNull().default(false),
  bioCalibrationComplete: boolean('bio_calibration_complete').notNull().default(false),
  needsFirstPhoto: boolean('needs_first_photo').notNull().default(false),
  chosenAt: timestamp('chosen_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

module.exports = { patientConsumerProfiles };
