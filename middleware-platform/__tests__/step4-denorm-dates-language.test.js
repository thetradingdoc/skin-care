'use strict';

/**
 * STEP 4 — Denorm clear, Spanish DD/MM dates, language stub, MRI path.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const factsRepo = require('../repositories/patient-record-facts-repo');
const { structureByTag } = require('../services/capture-orchestration/structure-by-tag');
const { detectLanguageStub } = require('../services/patient-record-language-stub');
const { coerceDate, applyTemplate } = require('../services/record-field-templates/apply-template');
const { getTemplate } = require('../services/record-field-templates');
const { parseImagingReportFromText } = require('../services/imaging-report-parser');

const OCR_PATH = path.join(__dirname, 'fixtures', 'mri-rodilla-es.ocr.txt');

describe('STEP 4 — denorm clear on confirm', () => {
  test('set expiry then clear via updateFactConfirm → expiry_date column is null', () => {
    const db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
    const fact = factsRepo.insertFact(db, {
      tag: 'prescription',
      ai_or_manual: 'manual',
      session_id: 'sess_denorm_clear',
      patient_id: 'Patient/denorm1',
      structured_json: {
        date: '2026-07-07',
        drug: 'Glasses prescription',
        rx_kind: 'optical',
        template_id: 'prescription.optical',
        od_sph: '-0.25',
        os_sph: '-0.25',
        expiry: '2027-07-07',
      },
      confirmed_at: null,
    });
    expect(fact.expiry_date).toBe('2027-07-07');

    const cleared = factsRepo.updateFactConfirm(db, {
      id: fact.id,
      patientId: 'Patient/denorm1',
      sessionId: 'sess_denorm_clear',
      patch: {
        structured_json: {
          date: '2026-07-07',
          drug: 'Glasses prescription',
          rx_kind: 'optical',
          template_id: 'prescription.optical',
          od_sph: '-0.25',
          os_sph: '-0.25',
          expiry: null,
        },
        confirmed_at: new Date().toISOString(),
      },
    });
    expect(cleared.expiry_date).toBeNull();
    const raw = db
      .prepare(`SELECT expiry_date, provider FROM patient_record_facts WHERE id = ?`)
      .get(fact.id);
    expect(raw.expiry_date).toBeNull();
    db.close();
  });
});

describe('STEP 4 — Spanish FECHA DD/MM (not April MM/DD)', () => {
  test('coerceDate dayFirst: 04/08/2025 → 2025-08-04 (not 2025-04-08)', () => {
    expect(coerceDate('04/08/2025', { dayFirst: true }).value).toBe('2025-08-04');
    expect(coerceDate('04/08/2025', { sourceLanguage: 'es' }).value).toBe('2025-08-04');
    // US default still month-first when not Spanish / dayFirst
    expect(coerceDate('04/08/2025', { dayFirst: false }).value).toBe('2025-04-08');
    // ISO unchanged
    expect(coerceDate('2025-08-04').value).toBe('2025-08-04');
  });

  test('imaging template applyTemplate with Spanish slash date → August', () => {
    const t = getTemplate('lab.imaging_report');
    const applied = applyTemplate(t, {
      date: '04/08/2025',
      source_language: 'es',
      findings: 'cartilage intact',
      conclusion: 'no acute tear',
    });
    expect(applied.normalized.date).toBe('2025-08-04');
  });

  test('MRI fixture full lab/imaging path → date 2025-08-04', () => {
    const ocrText = fs.readFileSync(OCR_PATH, 'utf8');
    expect(ocrText).toMatch(/FECHA:\s*04\/08\/2025/);
    const parsed = parseImagingReportFromText({ text: ocrText });
    expect(parsed.date).toBe('2025-08-04');
    const s = structureByTag('lab', { ocrText });
    expect(s.valid).toBe(true);
    expect(s.normalized.lab_kind).toBe('imaging_report');
    expect(s.normalized.date).toBe('2025-08-04');
    expect(s.normalized.date).not.toBe('2025-04-08');
  });
});

describe('STEP 4 — language stub Spanish vs French', () => {
  test('MRI fixture → es, not fr', () => {
    const ocrText = fs.readFileSync(OCR_PATH, 'utf8');
    const lang = detectLanguageStub(ocrText);
    expect(lang.source_language).toBe('es');
    expect(lang.source_language).not.toBe('fr');
    const s = structureByTag('lab', { ocrText });
    expect(s.normalized.source_language).toBe('es');
  });

  test('true French still detects fr', () => {
    expect(
      detectLanguageStub("Bonjour, voici les résultats de l'examen dans le dossier.").source_language,
    ).toBe('fr');
  });

  test('architecture doc states denorm encryption decision in prose', () => {
    const doc = fs.readFileSync(
      path.join(__dirname, '../../docs/product/TOUCHE_AGENTIC_ARCHITECTURE.md'),
      'utf8',
    );
    expect(doc).toMatch(/Deliberate plaintext denorm exception/i);
    expect(doc).toMatch(/not an accidental hole/i);
    expect(doc).toMatch(/SPH\/CYL\/AXIS/i);
    expect(doc).toMatch(/Findings and Conclusion/i);
    expect(doc).toMatch(/encrypted `structured_json`/i);
    expect(doc).toMatch(/fact_subtype/);
    expect(doc).toMatch(/expiry_date/);
  });
});
