'use strict';

/**
 * APP-07 — physician PDF renders optical / imaging catalog fields, not hardcoded sparse keys.
 */

const Database = require('better-sqlite3');
const factsRepo = require('../repositories/patient-record-facts-repo');
const {
  buildPhysicianPdf,
  factToLines,
} = require('../services/medical-tracker-domain/physician-export-pdf');

describe('APP-07 physician export catalog-driven', () => {
  let db;
  beforeEach(() => {
    db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
  });
  afterEach(() => db.close());

  test('optical Rx lines include OD/OS SPH labels from catalog', () => {
    const lines = factToLines({
      tag: 'prescription',
      confirmed_at: '2026-07-16T00:00:00.000Z',
      structured_json: {
        template_id: 'prescription.optical',
        rx_kind: 'optical',
        date: '2026-07-16',
        od_sph: '-1.25',
        os_sph: '-1.00',
        practice: 'Allerton Eye Care',
      },
    });
    const joined = lines.join('\n');
    expect(joined).toMatch(/Right \(OD\) SPH/i);
    expect(joined).toMatch(/Left \(OS\) SPH/i);
    expect(joined).toMatch(/-1\.25/);
    expect(joined).toMatch(/Allerton|Practice/i);
  });

  test('imaging lab lines include Findings/Conclusion from catalog', () => {
    const lines = factToLines({
      tag: 'lab',
      confirmed_at: '2026-07-16T00:00:00.000Z',
      structured_json: {
        template_id: 'lab.imaging_report',
        lab_kind: 'imaging_report',
        date: '2026-07-16',
        findings: 'Meniscus intact',
        conclusion: 'No acute fracture',
      },
    });
    const joined = lines.join('\n');
    expect(joined).toMatch(/Findings/i);
    expect(joined).toMatch(/Meniscus intact/);
    expect(joined).toMatch(/Conclusion/i);
    expect(joined).toMatch(/No acute fracture/);
  });

  test('PDF buffer includes catalog optical fields from DB fact', async () => {
    factsRepo.insertFact(db, {
      patient_id: 'pat_app07',
      tag: 'prescription',
      ai_or_manual: 'manual',
      structured_json: {
        template_id: 'prescription.optical',
        rx_kind: 'optical',
        date: '2026-07-16',
        od_sph: '-2.00',
        os_cyl: '-0.50',
      },
      confirmed_at: new Date().toISOString(),
    });
    const built = await buildPhysicianPdf(db, { patientId: 'pat_app07' });
    expect(built.ok).toBe(true);
    const text = built.buffer.toString('latin1');
    expect(text).toMatch(/OD\) SPH|-2\.00/i);
  });
});
