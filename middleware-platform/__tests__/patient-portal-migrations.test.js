'use strict';

const Database = require('better-sqlite3');
const { createPatientPortalMigrations } = require('../database/migrations/patient-portal');

describe('patient-portal migrations', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE patient_portal_sessions (
        id TEXT PRIMARY KEY,
        phone TEXT,
        verified INTEGER DEFAULT 0
      );
      CREATE TABLE patient_documents (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  test('migratePatientPortalSessionsEmail adds email column and index', () => {
    const { migratePatientPortalSessionsEmail } = createPatientPortalMigrations(db);
    migratePatientPortalSessionsEmail();
    const cols = db.prepare('PRAGMA table_info(patient_portal_sessions)').all();
    expect(cols.some((c) => c.name === 'email')).toBe(true);
  });

  test('migratePatientPortalSessionsSecurityMeta adds security columns', () => {
    const { migratePatientPortalSessionsSecurityMeta } = createPatientPortalMigrations(db);
    migratePatientPortalSessionsSecurityMeta();
    const names = db.prepare('PRAGMA table_info(patient_portal_sessions)').all().map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['ip_address', 'failed_attempts', 'locked_until']));
  });

  test('migratePatientDocumentDownloadTokens creates token table', () => {
    const { migratePatientDocumentDownloadTokens } = createPatientPortalMigrations(db);
    migratePatientDocumentDownloadTokens();
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='patient_document_download_tokens'").get();
    expect(row).toBeTruthy();
  });
});
