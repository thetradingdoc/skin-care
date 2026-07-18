'use strict';

/**
 * Real device-format HEIC fixture through quality gate + HEIC vision reject.
 * Fixture produced via macOS `sips` from patient-app assets (ISO BMFF ftypheic).
 */
const fs = require('fs');
const path = require('path');
const { assessCaptureQuality } = require('../services/capture-orchestration/quality-gate');
const {
  analyzeWithVision,
  isHeifFamilyBuffer,
} = require('../services/face-read-vision');

const HEIC = path.join(__dirname, 'fixtures/sample-device.heic');
const JPEG = path.join(__dirname, 'fixtures/sample-device.jpg');

describe('device HEIC fixture through capture pipeline pieces', () => {
  test('fixture is real HEIC (ftyp + heic brand), not a renamed JPEG', () => {
    expect(fs.existsSync(HEIC)).toBe(true);
    const buf = fs.readFileSync(HEIC);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(4, 8).toString('ascii')).toBe('ftyp');
    expect(isHeifFamilyBuffer(buf)).toBe(true);
    expect(buf[0]).not.toBe(0xff); // not JPEG SOI
  });

  test('quality gate accepts real HEIC without corrupt_or_unknown', () => {
    const buf = fs.readFileSync(HEIC);
    const q = assessCaptureQuality({ buffer: buf, mimeType: 'image/heic', tag: 'skin' });
    expect(q.ok).toBe(true);
    expect(q.quality_issues).not.toContain('corrupt_or_unknown');
  });

  test('quality gate still accepts JPEG fixture', () => {
    const buf = fs.readFileSync(JPEG);
    const q = assessCaptureQuality({ buffer: buf, mimeType: 'image/jpeg', tag: 'skin' });
    expect(q.ok).toBe(true);
    expect(q.quality_issues).not.toContain('corrupt_or_unknown');
  });

  test('empty / non-file buffer still fails quality (the device FormData bug signature)', () => {
    const q = assessCaptureQuality({ buffer: null, mimeType: 'image/jpeg', tag: 'skin' });
    expect(q.ok).toBe(false);
    expect(q.quality_issues).toContain('no_media');
  });

  test('vision analyzeWithVision rejects HEIC loudly (HEIC_UNSUPPORTED), not a opaque OpenAI error', async () => {
    process.env.FACE_READ_VISION_ENABLED = '1';
    process.env.OPENAI_API_KEY = 'sk-test-not-used';
    const buf = fs.readFileSync(HEIC);
    await expect(analyzeWithVision(buf, 'image/heic')).rejects.toMatchObject({
      message: 'HEIC_UNSUPPORTED',
      code: 'HEIC_UNSUPPORTED',
    });
    // Mislabeling HEIC bytes as jpeg still detected via magic
    await expect(analyzeWithVision(buf, 'image/jpeg')).rejects.toMatchObject({
      code: 'HEIC_UNSUPPORTED',
    });
  });
});
