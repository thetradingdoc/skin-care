'use strict';

/**
 * STEP 5 — Media gate (DICOM/video/zip) + PDF magic (1KB) + scoped AV adversarial tests.
 *
 * Three adversarial cases must all pass independently:
 * 1) Clean PDF with incidental MZ in embedded stream → heuristics pass
 * 2) PDF with embedded <script> → still AV_HEURISTIC_BLOCKED
 * 3) PE renamed .pdf (no %PDF- magic) → still blocked
 */

const fs = require('fs');
const path = require('path');
const {
  heuristicThreat,
  isPdfMagic,
  scanPatientRecordBuffer,
  SCRIPT_HEURISTIC_PATTERNS,
  BINARY_ENTROPY_FALSE_POSITIVE_PATTERNS,
} = require('../services/antivirus-service');
const {
  bufferHasPdfMagic,
  assertMedicalUploadAllowed,
  isPdfForCaptureRouting,
  looksLikeDicom,
  looksLikeZipArchive,
} = require('../services/patient-record-media-gate');

const MRI_PDF = path.join(__dirname, 'fixtures/mri-rodilla-es.pdf');

describe('STEP 5 — media gate rejects DICOM / video / zip', () => {
  test('DICOM .dcm / application/dicom / DICM magic rejected with report-path copy', () => {
    const byExt = assertMedicalUploadAllowed({
      buffer: Buffer.alloc(200, 0),
      mimeType: 'application/dicom',
      fileName: 'study.dcm',
    });
    expect(byExt.error_code).toBe('MEDIA_TYPE_DICOM_NOT_SUPPORTED');
    expect(byExt.message).toMatch(/report/i);

    const dicomPart10 = Buffer.alloc(200, 0);
    dicomPart10.write('DICM', 128);
    expect(looksLikeDicom({ buffer: dicomPart10 })).toBe(true);
    expect(assertMedicalUploadAllowed({ buffer: dicomPart10 }).error_code).toBe(
      'MEDIA_TYPE_DICOM_NOT_SUPPORTED',
    );
  });

  test('video and zip rejected', () => {
    expect(
      assertMedicalUploadAllowed({ mimeType: 'video/mp4', fileName: 'clip.mp4' }).error_code,
    ).toBe('MEDIA_TYPE_VIDEO_NOT_SUPPORTED');
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Buffer.alloc(20)]);
    expect(looksLikeZipArchive({ buffer: zip })).toBe(true);
    expect(assertMedicalUploadAllowed({ buffer: zip, fileName: 'images.zip' }).error_code).toBe(
      'MEDIA_TYPE_ZIP_NOT_SUPPORTED',
    );
  });
});

describe('STEP 5 — PDF magic within first 1KB', () => {
  test('detects %PDF- after leading garbage inside 1KB window', () => {
    const padded = Buffer.concat([Buffer.alloc(100, 0x20), Buffer.from('%PDF-1.4\n')]);
    expect(bufferHasPdfMagic(padded)).toBe(true);
    expect(isPdfMagic(padded)).toBe(true);
    expect(isPdfForCaptureRouting({ buffer: padded, fileName: 'x.bin' })).toBe(true);
  });

  test('filename .pdf alone is not enough for capture PDF routing', () => {
    const pe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, ...Buffer.alloc(400, 1)]);
    expect(bufferHasPdfMagic(pe)).toBe(false);
    expect(
      isPdfForCaptureRouting({
        buffer: pe,
        mimeType: 'application/pdf',
        fileName: 'malware.pdf',
      }),
    ).toBe(false);
  });
});

describe('STEP 5 — AV adversarial trio (narrow skip)', () => {
  let prevBypass;
  let prevClamSocket;
  let prevClamBin;
  let prevNodeEnv;

  beforeEach(() => {
    prevBypass = process.env.PATIENT_RECORD_AV_DEV_BYPASS;
    prevClamSocket = process.env.CLAMAV_SOCKET;
    prevClamBin = process.env.CLAMAV_BIN;
    prevNodeEnv = process.env.NODE_ENV;
    delete process.env.CLAMAV_SOCKET;
    delete process.env.CLAMAV_BIN;
    process.env.PATIENT_RECORD_AV_DEV_BYPASS = '1';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    if (prevBypass === undefined) delete process.env.PATIENT_RECORD_AV_DEV_BYPASS;
    else process.env.PATIENT_RECORD_AV_DEV_BYPASS = prevBypass;
    if (prevClamSocket === undefined) delete process.env.CLAMAV_SOCKET;
    else process.env.CLAMAV_SOCKET = prevClamSocket;
    if (prevClamBin === undefined) delete process.env.CLAMAV_BIN;
    else process.env.CLAMAV_BIN = prevClamBin;
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
  });

  test('ADVERSARIAL 1: clean PDF with incidental MZ in stream passes heuristics (MRI)', () => {
    const buf = fs.readFileSync(MRI_PDF);
    expect(isPdfMagic(buf)).toBe(true);
    // Prove old full-set would have been at risk of MZ FP somewhere in first 64KB (MRI may or may not)
    const synthetic = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.alloc(200, 0x20),
      Buffer.from([0x4d, 0x5a, 0x90, 0x00]), // incidental MZ mid-stream
      Buffer.from('\n%%EOF\n'),
    ]);
    expect(BINARY_ENTROPY_FALSE_POSITIVE_PATTERNS.some((p) => p.test(synthetic))).toBe(true);
    expect(heuristicThreat(synthetic, { fullBuffer: synthetic })).toBeNull();
    expect(heuristicThreat(buf.slice(0, 65536), { fullBuffer: buf })).toBeNull();
  });

  test('ADVERSARIAL 2: PDF with embedded <script> still blocked', () => {
    const pdf = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.from('<script>alert(1)</script>\n'),
      Buffer.from('%%EOF\n'),
    ]);
    expect(isPdfMagic(pdf)).toBe(true);
    expect(SCRIPT_HEURISTIC_PATTERNS.some((p) => p.test(pdf))).toBe(true);
    const heur = heuristicThreat(pdf, { fullBuffer: pdf });
    expect(heur).not.toBeNull();
    expect(heur.error_code).toBe('AV_HEURISTIC_BLOCKED');
  });

  test('ADVERSARIAL 2b: javascript: and vbscript: still blocked on PDF', () => {
    for (const payload of ['javascript:alert(1)', 'vbscript:msgbox(1)']) {
      const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from(payload)]);
      const heur = heuristicThreat(pdf, { fullBuffer: pdf });
      expect(heur?.error_code).toBe('AV_HEURISTIC_BLOCKED');
    }
  });

  test('ADVERSARIAL 3: PE renamed .pdf (no %PDF- magic) still blocked', async () => {
    const pe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, ...Buffer.alloc(400, 1)]);
    expect(bufferHasPdfMagic(pe)).toBe(false);
    // Media gate rejects claimed-PDF without magic
    const gate = assertMedicalUploadAllowed({
      buffer: pe,
      mimeType: 'application/pdf',
      fileName: 'invoice.pdf',
    });
    expect(gate.error_code).toBe('INVALID_PDF_MAGIC');
    // Heuristics alone also block (full pattern set — MZ at start)
    const heur = heuristicThreat(pe, { fullBuffer: pe });
    expect(heur?.error_code).toBe('AV_HEURISTIC_BLOCKED');
    const scan = await scanPatientRecordBuffer(pe);
    expect(scan.safe).toBe(false);
    expect(scan.error_code).toBe('AV_HEURISTIC_BLOCKED');
  });

  test('docs + code: ClamAV still runs after heuristics when configured', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../services/antivirus-service.js'),
      'utf8',
    );
    expect(src).toMatch(/heuristicThreat/);
    expect(src).toMatch(/scanWithClamAV/);
    // Order: heur then ClamAV in scanPatientRecordBuffer
    const heurIdx = src.indexOf('const heur = heuristicThreat(slice, { fullBuffer: buf });');
    const clamIdx = src.indexOf('return await scanWithClamAV(tmpPath);');
    expect(heurIdx).toBeGreaterThan(0);
    expect(clamIdx).toBeGreaterThan(heurIdx);
    const doc = fs.readFileSync(
      path.join(__dirname, '../../docs/security/UPLOAD_AND_AV.md'),
      'utf8',
    );
    expect(doc).toMatch(/ClamAV is the real scanner/i);
    expect(doc).toMatch(/pre-filter only/i);
  });
});
