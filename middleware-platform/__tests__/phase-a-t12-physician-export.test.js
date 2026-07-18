'use strict';

/**
 * T12 — physician PDF / share link built from real facts rows (not fixtures).
 */

const Database = require('better-sqlite3');
const factsRepo = require('../repositories/patient-record-facts-repo');
const { buildPhysicianPdf } = require('../services/medical-tracker-domain/physician-export-pdf');
const {
  createPhysicianShareLink,
  resolvePhysicianShare,
} = require('../services/medical-tracker-domain/physician-share-links');

describe('T12 physician export from real facts', () => {
  let db;
  beforeEach(() => {
    db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
  });
  afterEach(() => db.close());

  test('PDF includes confirmed bill fact amount from DB', async () => {
    factsRepo.insertFact(db, {
      patient_id: 'pat_t12',
      tag: 'bill',
      ai_or_manual: 'manual',
      structured_json: {
        date: '2026-07-16',
        provider: 'Allerton Eye Care',
        amount_cents: 8400,
        currency: 'USD',
        doc_type: 'receipt',
      },
      confirmed_at: new Date().toISOString(),
    });
    const built = await buildPhysicianPdf(db, { patientId: 'pat_t12' });
    expect(built.ok).toBe(true);
    expect(built.buffer.slice(0, 5).toString()).toBe('%PDF-');
    expect(built.ai_generated).toBe(false);
    const text = built.buffer.toString('latin1');
    expect(text).toMatch(/Allerton|8400|84\.00|bill/i);
  });

  test('share link resolves pack from real skin fact', async () => {
    factsRepo.insertFact(db, {
      patient_id: 'pat_t12_share',
      tag: 'skin',
      ai_or_manual: 'ai',
      structured_json: {
        date: '2026-07-16',
        body_area: 'cheek, left',
        note: 'day 1',
      },
      confirmed_at: new Date().toISOString(),
    });
    const link = await createPhysicianShareLink(db, {
      patientId: 'pat_t12_share',
      ttlSec: 120,
      baseUrl: 'https://api.test',
    });
    expect(link.ok).toBe(true);
    expect(link.url || link.path).toBeTruthy();
    const resolved = await resolvePhysicianShare(db, {
      token: link.token,
      ip: '127.0.0.1',
    });
    expect(resolved.ok).toBe(true);
    expect(resolved.narrative).toBeNull();
    expect(resolved.buffer || resolved.content_type || resolved.fact_count != null).toBeTruthy();
    expect(Number(resolved.fact_count) >= 1 || (resolved.buffer && resolved.buffer.length > 0)).toBe(
      true,
    );
  });
});
