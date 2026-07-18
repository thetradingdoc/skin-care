'use strict';

/**
 * STEP 3 — Empty OCR fail-closed: no insertFact, OCR_EMPTY + manual_allowed, meter refund.
 */

const Database = require('better-sqlite3');

/** Minimal valid PDF with no text layer and no embedded JPEGs — pad past quality gate. */
function emptyPdfBuffer() {
  const core = Buffer.from(
    `%PDF-1.1
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>endobj
xref
0 4
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000115 00000 n 
trailer<< /Size 4 /Root 1 0 R >>
startxref
190
%%EOF
`,
    'utf8',
  );
  return Buffer.concat([core, Buffer.alloc(Math.max(0, 4096 - core.length), 0x20)]);
}

describe('STEP 3 — OCR_EMPTY fail closed', () => {
  const prevAv = process.env.PATIENT_RECORD_AV_DEV_BYPASS;
  const prevKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.PATIENT_RECORD_AV_DEV_BYPASS = '1';
    // No vision key → scan-vision fallback cannot invent text
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (prevAv === undefined) delete process.env.PATIENT_RECORD_AV_DEV_BYPASS;
    else process.env.PATIENT_RECORD_AV_DEV_BYPASS = prevAv;
    if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevKey;
    jest.resetModules();
    jest.dontMock('../services/capture-orchestration/perceive');
    jest.dontMock('../services/antivirus-service');
  });

  test('genuinely empty PDF → OCR_EMPTY, no DB row, manual_allowed', async () => {
    jest.resetModules();
    jest.doMock('../services/antivirus-service', () => ({
      scanPatientRecordBuffer: jest.fn(async () => ({ safe: true })),
      BLOCKED_MESSAGE: 'blocked',
    }));
    const factsRepoFresh = require('../repositories/patient-record-facts-repo');
    const { ensureTables: ensureMeterFresh } = require('../services/ai-capture-meter');
    const { orchestrateCapture } = require('../services/capture-orchestration');
    const insertSpy = jest.spyOn(factsRepoFresh, 'insertFact');

    const db = new Database(':memory:');
    factsRepoFresh.ensurePatientRecordFactsTable(db);
    ensureMeterFresh(db);

    const result = await orchestrateCapture({
      db,
      tag: 'lab',
      aiOrManual: 'ai',
      sessionId: 'sess_ocr_empty',
      buffer: emptyPdfBuffer(),
      mimeType: 'application/pdf',
      fileName: 'blank.pdf',
      isPlus: false,
    });

    expect(result.ok).toBe(false);
    expect(result.error_code).toBe('OCR_EMPTY');
    expect(result.vision_fail).toBe(true);
    expect(result.manual_allowed).toBe(true);
    expect(result.action).toBe('retake');
    expect(insertSpy).not.toHaveBeenCalled();
    const count = db.prepare(`SELECT COUNT(*) AS c FROM patient_record_facts`).get().c;
    expect(count).toBe(0);
    insertSpy.mockRestore();
    db.close();
  });

  test('short but genuine extracted text does NOT fail closed', async () => {
    jest.resetModules();
    jest.doMock('../services/antivirus-service', () => ({
      scanPatientRecordBuffer: jest.fn(async () => ({ safe: true })),
      BLOCKED_MESSAGE: 'blocked',
    }));
    jest.doMock('../services/capture-orchestration/perceive', () => ({
      perceiveSkinVision: jest.fn(async () => ({ ok: false, vision: null })),
      perceiveDocOcr: jest.fn(async () => ({
        ok: true,
        // Thin/short — below text-layer "usable" threshold but not empty
        text: 'Rx refill OK — Dr. Lee',
        method: 'pdf-text-layer-weak',
        used_ai: false,
        text_layer: { usable: false, reason: 'too_short', char_count: 22 },
      })),
    }));
    const factsRepoFresh = require('../repositories/patient-record-facts-repo');
    const { ensureTables: ensureMeterFresh } = require('../services/ai-capture-meter');
    const { orchestrateCapture } = require('../services/capture-orchestration');

    const db = new Database(':memory:');
    factsRepoFresh.ensurePatientRecordFactsTable(db);
    ensureMeterFresh(db);

    const result = await orchestrateCapture({
      db,
      tag: 'prescription',
      aiOrManual: 'ai',
      sessionId: 'sess_short_ok',
      buffer: emptyPdfBuffer(),
      mimeType: 'application/pdf',
      fileName: 'short-note.pdf',
      isPlus: true,
      userHints: { rx_kind: 'medication', drug: 'refill note' },
    });

    expect(result.ok).toBe(true);
    expect(result.fact).toBeTruthy();
    expect(result.error_code).toBeUndefined();
    const count = db.prepare(`SELECT COUNT(*) AS c FROM patient_record_facts`).get().c;
    expect(count).toBe(1);
    db.close();
  });

  test('OCR_EMPTY after metered AI attempt refunds usage (meter fairness)', async () => {
    jest.resetModules();
    jest.doMock('../services/antivirus-service', () => ({
      scanPatientRecordBuffer: jest.fn(async () => ({ safe: true })),
      BLOCKED_MESSAGE: 'blocked',
    }));
    jest.doMock('../services/capture-orchestration/perceive', () => ({
      perceiveSkinVision: jest.fn(async () => ({ ok: false, vision: null })),
      // First call (preDoc) empty → meters; second call also empty → OCR_EMPTY + refund
      perceiveDocOcr: jest.fn(async () => ({
        ok: true,
        text: '',
        method: 'pdf-no-text',
        used_ai: false,
        text_layer: { usable: false, reason: 'too_short', char_count: 0 },
      })),
    }));
    const factsRepoFresh = require('../repositories/patient-record-facts-repo');
    const meter = require('../services/ai-capture-meter');
    const { orchestrateCapture } = require('../services/capture-orchestration');
    const refundSpy = jest.spyOn(meter, 'refundFailedIfNeeded');

    const db = new Database(':memory:');
    factsRepoFresh.ensurePatientRecordFactsTable(db);
    meter.ensureTables(db);

    const before = await orchestrateCapture({
      db,
      tag: 'bill',
      aiOrManual: 'ai',
      patientId: 'Patient/ocr_refund',
      sessionId: 'sess_ocr_refund',
      buffer: emptyPdfBuffer(),
      mimeType: 'application/pdf',
      fileName: 'blank-bill.pdf',
      isPlus: false,
    });

    expect(before.ok).toBe(false);
    expect(before.error_code).toBe('OCR_EMPTY');
    expect(refundSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.objectContaining({ reason: 'ocr_empty' }),
    );
    const usageId = refundSpy.mock.calls.find(
      (c) => c[2] && c[2].reason === 'ocr_empty',
    )?.[1];
    expect(usageId).toBeTruthy();
    const row = db.prepare(`SELECT status FROM ai_capture_usage WHERE id = ?`).get(usageId);
    expect(row.status).toBe('refunded');

    refundSpy.mockRestore();
    db.close();
  });
});
