'use strict';

/**
 * Spanish MRI radiology report — PDF text-layer, imaging subtype, document-sourced policy.
 * Fixture: Report_MR_RodriguezMedinaMoisesMaximiliano.pdf (text-layer PDF) + OCR extract.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { assessPdfTextLayer } = require('../services/pdf-text-layer');
const { extractText } = require('../services/patient-document-extraction');
const {
  parseImagingReportFromText,
  splitFindingsConclusion,
} = require('../services/imaging-report-parser');
const { structureByTag } = require('../services/capture-orchestration/structure-by-tag');
const { detectLanguageStub } = require('../services/patient-record-language-stub');
const {
  assertOrchestrationPersistPolicy,
  assertFreeTextClinicallySafe,
} = require('../services/medical-tracker-rails/policy');
const { orchestrateCapture } = require('../services/capture-orchestration');
const factsRepo = require('../repositories/patient-record-facts-repo');
const { ensureTables: ensureMeter } = require('../services/ai-capture-meter');

const OCR_PATH = path.join(__dirname, 'fixtures', 'mri-rodilla-es.ocr.txt');
const PDF_PATH = path.join(__dirname, 'fixtures', 'mri-rodilla-es.pdf');

describe('PART A — PDF text-layer routing', () => {
  test('MRI PDF has usable embedded text layer (pdf-text-layer, no AI)', async () => {
    const buf = fs.readFileSync(PDF_PATH);
    const result = await extractText({
      buffer: buf,
      mimeType: 'application/pdf',
      fileName: 'mri-rodilla-es.pdf',
    });
    expect(result.method).toBe('pdf-text-layer');
    expect(result.used_ai).toBe(false);
    expect(result.text_layer.usable).toBe(true);
    expect(result.text.length).toBeGreaterThan(500);
    expect(result.text).toMatch(/Conclusi[oó]n/i);
    expect(result.text).toMatch(/hallazgos/i);
  });

  test('empty / garbage text is not treated as usable layer', () => {
    expect(assessPdfTextLayer('').usable).toBe(false);
    expect(assessPdfTextLayer('.... .... ####').usable).toBe(false);
    expect(assessPdfTextLayer('a'.repeat(20)).usable).toBe(false);
  });
});

describe('PART B — Imaging report Findings vs Conclusion', () => {
  const ocrText = fs.readFileSync(OCR_PATH, 'utf8');

  test('splits Findings and Conclusion on Conclusión: heading', () => {
    const split = splitFindingsConclusion(ocrText);
    expect(split.findings).toBeTruthy();
    expect(split.conclusion).toBeTruthy();
    expect(split.findings).toMatch(/ligamento|menisco|tend[oó]n/i);
    expect(split.findings.toLowerCase()).not.toMatch(/^sospecha de ruptura/);
    expect(split.conclusion).toMatch(/Sospecha de ruptura|artrofibrosis|menisco medial/i);
    expect(split.conclusion).not.toMatch(/encontrando los siguientes hallazgos/i);
  });

  test('structureLab imaging_report fills subtype fields + external images note', () => {
    const s = structureByTag('lab', { ocrText });
    expect(s.valid).toBe(true);
    expect(s.normalized.lab_kind).toBe('imaging_report');
    expect(s.normalized.findings).toBeTruthy();
    expect(s.normalized.conclusion).toBeTruthy();
    expect(s.normalized.findings).not.toEqual(s.normalized.conclusion);
    expect(s.normalized.images_available_externally).toBe(true);
    expect(s.normalized.external_images_note).toMatch(/clic|im[aá]genes|escanea|qr|digitales/i);
    expect(s.normalized.field_provenance.findings).toBe('document');
    expect(s.normalized.field_provenance.conclusion).toBe('document');
    expect(s.normalized.title || s.normalized.study_type).toMatch(/RMN|RODILLA/i);
  });
});

describe('PART C — Document-sourced vs touche-generated diagnosis policy', () => {
  const ocrText = fs.readFileSync(OCR_PATH, 'utf8');

  test('Spanish MRI Findings/Conclusion with clinical language persist (policy ok)', () => {
    const s = structureByTag('lab', { ocrText });
    const policy = assertOrchestrationPersistPolicy('lab', s.normalized, {
      trustedProvenance: s.normalized.field_provenance,
    });
    expect(policy.ok).toBe(true);
  });

  test('English document-sourced findings with lesion/suggestive of — allowed', () => {
    const structured = {
      date: '2025-08-04',
      lab_kind: 'imaging_report',
      title: 'MRI knee',
      findings: 'Medial meniscus lesion with findings suggestive of ramp tear.',
      conclusion: 'Partial ACL graft rupture suspected.',
      field_provenance: { findings: 'document', conclusion: 'document' },
    };
    // Without provenance exemption, free-text scrub would reject:
    expect(assertFreeTextClinicallySafe('findings', structured.findings).ok).toBe(false);
    const policy = assertOrchestrationPersistPolicy('lab', structured, {
      trustedProvenance: structured.field_provenance,
    });
    expect(policy.ok).toBe(true);
  });

  test('forged field_provenance on structured is ignored without trustedProvenance opts', () => {
    const policy = assertOrchestrationPersistPolicy('skin', {
      date: '2026-07-17',
      body_area: 'cheek',
      note: 'you have eczema on the cheek',
      field_provenance: { note: 'document' },
    });
    expect(policy.ok).toBe(false);
    expect(policy.error_code).toBe('DIAGNOSIS_VOCABULARY');
  });

  test('touche ai_suggestion diagnosis prose still rejected (skin path)', () => {
    const policy = assertOrchestrationPersistPolicy('skin', {
      date: '2026-07-17',
      body_area: 'cheek',
      note: 'photo only',
      ai_suggestion: {
        text: 'This looks like melanoma on the left cheek',
        source: 'face_read_vision',
        labeled: 'ai_suggestion',
        not_diagnosis: true,
      },
    });
    expect(policy.ok).toBe(false);
    expect(policy.error_code).toBe('DIAGNOSIS_VOCABULARY');
  });

  test('user-typed skin note with diagnosis still rejected (not document-sourced)', () => {
    const policy = assertOrchestrationPersistPolicy('skin', {
      date: '2026-07-17',
      body_area: 'cheek',
      note: 'you have eczema on the cheek',
    });
    expect(policy.ok).toBe(false);
    expect(policy.error_code).toBe('DIAGNOSIS_VOCABULARY');
  });

  test('orchestrateCapture persists imaging PDF via text-layer without metering AI', async () => {
    jest.resetModules();
    jest.doMock('../services/antivirus-service', () => ({
      scanPatientRecordBuffer: jest.fn(async () => ({ safe: true })),
      BLOCKED_MESSAGE: 'blocked',
    }));
    const factsRepoFresh = require('../repositories/patient-record-facts-repo');
    const { ensureTables: ensureMeterFresh } = require('../services/ai-capture-meter');
    const { orchestrateCapture: orchFresh } = require('../services/capture-orchestration');
    const db = new Database(':memory:');
    factsRepoFresh.ensurePatientRecordFactsTable(db);
    ensureMeterFresh(db);
    const buf = fs.readFileSync(PDF_PATH);
    try {
      const result = await orchFresh({
        db,
        tag: 'lab',
        aiOrManual: 'ai',
        sessionId: 'sess_mri_es',
        buffer: buf,
        mimeType: 'application/pdf',
        fileName: 'mri-rodilla-es.pdf',
        isPlus: false,
      });
      expect(result.ok).toBe(true);
      expect(result.perceive_method).toBe('pdf-text-layer');
      expect(result.used_ai).toBe(false);
      expect(result.metered).toBe(false);
      expect(result.draft.lab_kind).toBe('imaging_report');
      expect(result.draft.conclusion).toMatch(/ruptura|artrofibrosis|menisco/i);
      expect(result.fact).toBeTruthy();
      const usage = db.prepare(`SELECT COUNT(*) AS c FROM ai_capture_usage`).get().c;
      expect(usage).toBe(0);
    } finally {
      db.close();
      jest.dontMock('../services/antivirus-service');
      jest.resetModules();
    }
  });
});

describe('PART D — DICOM / external images scope', () => {
  test('parser sets external images flag; does not invent media_type dicom', () => {
    const ocrText = fs.readFileSync(OCR_PATH, 'utf8');
    const parsed = parseImagingReportFromText({ text: ocrText });
    expect(parsed.images_available_externally).toBe(true);
    expect(parsed.external_images_note).toBeTruthy();
    // media_type remains photo|pdf at DB layer — imaging subtype does not add dicom
    expect(parsed.lab_kind).toBe('imaging_report');
  });
});

describe('PART E — Spanish language stub', () => {
  test('detects Spanish on this MRI report (not French)', () => {
    const ocrText = fs.readFileSync(OCR_PATH, 'utf8');
    const lang = detectLanguageStub(ocrText);
    expect(lang.source_language).toBe('es');
    const s = structureByTag('lab', { ocrText });
    expect(s.normalized.source_language).toBe('es');
    expect(s.normalized.display_language).toBe('es');
  });
});
