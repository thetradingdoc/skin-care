'use strict';

/**
 * AV heuristic narrowing for compressed images (device false-positive fix).
 * Real sample-device.jpg contains PE magic `MZ` at offset 3616 inside JPEG entropy —
 * that tripped AV_HEURISTIC_BLOCKED on device while ClamAV would accept a clean photo.
 */
const fs = require('fs');
const path = require('path');
const {
  heuristicThreat,
  isCompressedImageMagic,
  isPdfMagic,
  scanPatientRecordBuffer,
  BINARY_ENTROPY_FALSE_POSITIVE_PATTERNS,
  SCRIPT_HEURISTIC_PATTERNS,
} = require('../services/antivirus-service');

const JPEG = path.join(__dirname, 'fixtures/sample-device.jpg');
const HEIC = path.join(__dirname, 'fixtures/sample-device.heic');
const MRI_PDF = path.join(__dirname, 'fixtures/mri-rodilla-es.pdf');

describe('AV heuristic — compressed image false-positive fix', () => {
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

  test('fixture JPEG is real (SOI) and contains old PE-magic false-positive bytes', () => {
    const buf = fs.readFileSync(JPEG);
    expect(buf[0]).toBe(0xff);
    expect(buf[1]).toBe(0xd8);
    expect(isCompressedImageMagic(buf)).toBe(true);
    const mzAt = buf.indexOf(Buffer.from([0x4d, 0x5a]));
    expect(mzAt).toBeGreaterThan(100); // not at start — entropy hit
    // Old-style full-pattern scan would flag MZ
    let oldHit = false;
    for (const pat of BINARY_ENTROPY_FALSE_POSITIVE_PATTERNS) {
      if (pat.test(buf.slice(0, 65536))) oldHit = true;
    }
    expect(oldHit).toBe(true);
  });

  test('real device JPEG with MZ-in-entropy passes heuristicThreat (narrowed)', () => {
    const buf = fs.readFileSync(JPEG);
    const slice = buf.slice(0, Math.min(buf.length, 65536));
    expect(heuristicThreat(slice, { fullBuffer: buf })).toBeNull();
  });

  test('real device HEIC passes heuristicThreat', () => {
    const buf = fs.readFileSync(HEIC);
    expect(isCompressedImageMagic(buf)).toBe(true);
    expect(heuristicThreat(buf.slice(0, 65536), { fullBuffer: buf })).toBeNull();
  });

  test('scanPatientRecordBuffer allows clean device JPEG under DEV bypass (was AV_HEURISTIC_BLOCKED)', async () => {
    const buf = fs.readFileSync(JPEG);
    const result = await scanPatientRecordBuffer(buf);
    expect(result.safe).toBe(true);
    expect(result.bypass).toBe('dev_heuristic_only');
  });

  test('actual PE / EXE content still blocked', async () => {
    const pe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, ...Buffer.alloc(400, 1)]);
    expect(isCompressedImageMagic(pe)).toBe(false);
    const heur = heuristicThreat(pe, { fullBuffer: pe });
    expect(heur).not.toBeNull();
    expect(heur.error_code).toBe('AV_HEURISTIC_BLOCKED');
    const result = await scanPatientRecordBuffer(pe);
    expect(result.safe).toBe(false);
    expect(result.error_code).toBe('AV_HEURISTIC_BLOCKED');
  });

  test('script payload still blocked even when wrapped after JPEG SOI', () => {
    // Valid JPEG SOI + COM-ish payload containing <script — script heuristics stay on for images
    const evil = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
      Buffer.from('JFIF\0'),
      Buffer.from('<script>alert(1)</script>'),
      Buffer.alloc(200, 0x00),
    ]);
    expect(isCompressedImageMagic(evil)).toBe(true);
    const heur = heuristicThreat(evil, { fullBuffer: evil });
    expect(heur).not.toBeNull();
    expect(heur.error_code).toBe('AV_HEURISTIC_BLOCKED');
    expect(SCRIPT_HEURISTIC_PATTERNS.some((p) => p.test(evil))).toBe(true);
  });

  test('PDF magic skips MZ entropy false-positive (embedded JPEG streams)', () => {
    const pdf = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.from([0x4d, 0x5a, 0x90, 0x00]),
      Buffer.from(' rest of pretend pdf '),
    ]);
    expect(isCompressedImageMagic(pdf)).toBe(false);
    expect(isPdfMagic(pdf)).toBe(true);
    // MZ mid-PDF no longer blocked — same class of FP as JPEG entropy
    expect(heuristicThreat(pdf, { fullBuffer: pdf })).toBeNull();
  });

  test('real Spanish MRI PDF passes heuristicThreat', () => {
    const buf = fs.readFileSync(MRI_PDF);
    expect(isPdfMagic(buf)).toBe(true);
    expect(heuristicThreat(buf.slice(0, 65536), { fullBuffer: buf })).toBeNull();
  });

  test('PDF still blocks script payloads', () => {
    const pdf = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.from('<script>alert(1)</script>'),
    ]);
    expect(isPdfMagic(pdf)).toBe(true);
    const heur = heuristicThreat(pdf, { fullBuffer: pdf });
    expect(heur).not.toBeNull();
    expect(heur.error_code).toBe('AV_HEURISTIC_BLOCKED');
  });
});
