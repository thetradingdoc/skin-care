'use strict';

/**
 * Patient portal schema migrations (sessions, documents, download tokens).
 * Extracted from database.js — Phase 2 domain split.
 *
 * @param {import('better-sqlite3').Database} db
 */
function createPatientPortalMigrations(db) {
  function migratePatientPortalSessionsEmail() {
    try {
      db.pragma('foreign_keys = OFF');

      const portalSessionsInfo = db.prepare('PRAGMA table_info(patient_portal_sessions)').all();
      const hasEmail = portalSessionsInfo.some((col) => col.name === 'email');

      if (!hasEmail) {
        console.log('📦 Adding email column to patient_portal_sessions table...');
        db.exec('ALTER TABLE patient_portal_sessions ADD COLUMN email TEXT;');
        db.exec('CREATE INDEX IF NOT EXISTS idx_portal_sessions_email ON patient_portal_sessions(email);');
        console.log('✅ Migration complete: email column added to patient_portal_sessions');
      } else {
        db.exec('CREATE INDEX IF NOT EXISTS idx_portal_sessions_email ON patient_portal_sessions(email);');
      }

      db.pragma('foreign_keys = ON');
    } catch (migrationError) {
      console.warn('⚠️  Patient portal sessions email migration failed:', migrationError.message);
      db.pragma('foreign_keys = ON');
    }
  }

  function migratePatientPortalSessionsSecurityMeta() {
    try {
      db.pragma('foreign_keys = OFF');

      const cols = db.prepare('PRAGMA table_info(patient_portal_sessions)').all();
      const hasIp = cols.some((c) => c.name === 'ip_address');
      const hasUa = cols.some((c) => c.name === 'user_agent');
      const hasFailed = cols.some((c) => c.name === 'failed_attempts');
      const hasLocked = cols.some((c) => c.name === 'locked_until');
      const hasLastSeen = cols.some((c) => c.name === 'last_seen_at');
      const hasRevokedAt = cols.some((c) => c.name === 'revoked_at');
      const hasRotatedTo = cols.some((c) => c.name === 'rotated_to');

      if (!hasIp) {
        console.log('📦 Adding ip_address column to patient_portal_sessions table...');
        db.exec('ALTER TABLE patient_portal_sessions ADD COLUMN ip_address TEXT;');
      }
      if (!hasUa) {
        console.log('📦 Adding user_agent column to patient_portal_sessions table...');
        db.exec('ALTER TABLE patient_portal_sessions ADD COLUMN user_agent TEXT;');
      }
      if (!hasFailed) {
        console.log('📦 Adding failed_attempts column to patient_portal_sessions table...');
        db.exec('ALTER TABLE patient_portal_sessions ADD COLUMN failed_attempts INTEGER DEFAULT 0;');
      }
      if (!hasLocked) {
        console.log('📦 Adding locked_until column to patient_portal_sessions table...');
        db.exec('ALTER TABLE patient_portal_sessions ADD COLUMN locked_until DATETIME;');
      }
      if (!hasLastSeen) {
        console.log('📦 Adding last_seen_at column to patient_portal_sessions table...');
        db.exec('ALTER TABLE patient_portal_sessions ADD COLUMN last_seen_at DATETIME;');
      }
      if (!hasRevokedAt) {
        console.log('📦 Adding revoked_at column to patient_portal_sessions table...');
        db.exec('ALTER TABLE patient_portal_sessions ADD COLUMN revoked_at DATETIME;');
      }
      if (!hasRotatedTo) {
        console.log('📦 Adding rotated_to column to patient_portal_sessions table...');
        db.exec('ALTER TABLE patient_portal_sessions ADD COLUMN rotated_to TEXT;');
      }

      db.pragma('foreign_keys = ON');
    } catch (e) {
      console.warn('⚠️  Patient portal sessions security meta migration failed:', e.message);
      db.pragma('foreign_keys = ON');
    }
  }

  function migratePatientDocumentsStatus() {
    try {
      const info = db.prepare('PRAGMA table_info(patient_documents)').all();
      if (!info.some((c) => c.name === 'status')) {
        db.exec("ALTER TABLE patient_documents ADD COLUMN status TEXT DEFAULT 'available'");
        db.exec('CREATE INDEX IF NOT EXISTS idx_patient_documents_status ON patient_documents(status)');
        console.log('✅ Migration: patient_documents.status added');
      }
      if (!info.some((c) => c.name === 'storage_provider')) {
        db.exec("ALTER TABLE patient_documents ADD COLUMN storage_provider TEXT DEFAULT 'local'");
      }
      if (!info.some((c) => c.name === 'storage_bucket')) {
        db.exec('ALTER TABLE patient_documents ADD COLUMN storage_bucket TEXT');
      }
      if (!info.some((c) => c.name === 'storage_key')) {
        db.exec('ALTER TABLE patient_documents ADD COLUMN storage_key TEXT');
      }
      try {
        db.exec('CREATE INDEX IF NOT EXISTS idx_patient_documents_provider ON patient_documents(storage_provider)');
      } catch (_) {}
    } catch (e) {
      console.warn('⚠️  patient_documents status migration failed:', e.message);
    }
  }

  function migratePatientDocumentDownloadTokens() {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS patient_document_download_tokens (
          token TEXT PRIMARY KEY,
          doc_id TEXT NOT NULL,
          patient_id TEXT NOT NULL,
          expires_at DATETIME NOT NULL,
          used_at DATETIME,
          revoked_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_doc_tokens_doc ON patient_document_download_tokens(doc_id);
        CREATE INDEX IF NOT EXISTS idx_doc_tokens_patient ON patient_document_download_tokens(patient_id);
        CREATE INDEX IF NOT EXISTS idx_doc_tokens_expires ON patient_document_download_tokens(expires_at);
      `);
      console.log('✅ Migration: patient_document_download_tokens ensured');
    } catch (e) {
      console.warn('⚠️  patient_document_download_tokens migration failed:', e.message);
    }
  }

  return {
    migratePatientPortalSessionsEmail,
    migratePatientPortalSessionsSecurityMeta,
    migratePatientDocumentsStatus,
    migratePatientDocumentDownloadTokens,
  };
}

module.exports = { createPatientPortalMigrations };
