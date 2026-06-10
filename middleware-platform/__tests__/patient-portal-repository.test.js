'use strict';

const Database = require('better-sqlite3');
const { createPatientPortalRepository } = require('../database/repositories/patient-portal');

describe('patient-portal repository', () => {
  let db;
  let repo;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE patient_portal_sessions (
        id TEXT PRIMARY KEY,
        email TEXT,
        verification_code TEXT,
        expires_at DATETIME,
        verified INTEGER DEFAULT 0,
        verified_at DATETIME,
        ip_address TEXT,
        user_agent TEXT,
        failed_attempts INTEGER DEFAULT 0,
        locked_until DATETIME,
        last_seen_at DATETIME,
        patient_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    repo = createPatientPortalRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  test('insert and find active unverified session', () => {
    const expires = new Date(Date.now() + 600000).toISOString();
    repo.insertVerificationSession({
      sessionId: 's1',
      email: 'a@example.com',
      code: '123456',
      expiresAt: expires,
      ip: '1.2.3.4',
      userAgent: 'test',
    });
    const row = repo.findActiveUnverifiedSessionByEmail('a@example.com');
    expect(row).toEqual({ id: 's1' });
  });

  test('updateVerificationSession resets failed attempts', () => {
    const expires = new Date(Date.now() + 600000).toISOString();
    repo.insertVerificationSession({
      sessionId: 's2',
      email: 'b@example.com',
      code: '111111',
      expiresAt: expires,
    });
    db.prepare('UPDATE patient_portal_sessions SET failed_attempts = 3 WHERE id = ?').run('s2');
    repo.updateVerificationSession({
      id: 's2',
      code: '222222',
      expiresAt: expires,
      ip: null,
      userAgent: null,
    });
    const session = repo.findLatestUnverifiedSessionByEmail('b@example.com');
    expect(session.verification_code).toBe('222222');
    expect(session.failed_attempts).toBe(0);
  });

  test('markSessionVerified and getVerifiedSession', () => {
    const expires = new Date(Date.now() + 600000).toISOString();
    repo.insertVerificationSession({
      sessionId: 's3',
      email: 'c@example.com',
      code: '333333',
      expiresAt: expires,
    });
    repo.markSessionVerified('s3');
    const verified = repo.getVerifiedSession('s3');
    expect(verified).toBeTruthy();
    expect(verified.verified).toBe(1);
    expect(verified.verified_at).toBeTruthy();
  });

  test('incrementFailedAttempts sets lock after too many tries', () => {
    const expires = new Date(Date.now() + 600000).toISOString();
    repo.insertVerificationSession({
      sessionId: 's4',
      email: 'd@example.com',
      code: '444444',
      expiresAt: expires,
    });
    const lockUntil = new Date(Date.now() + 300000).toISOString();
    repo.incrementFailedAttempts('s4', lockUntil);
    const lock = repo.getLatestLockForEmail('d@example.com');
    expect(lock.locked_until).toBe(lockUntil);
  });
});
