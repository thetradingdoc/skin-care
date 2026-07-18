'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  writeLocalMedia,
  readLocalMedia,
  assertSafeLocalKey,
} = require('../services/local-media-store');

describe('SEC-06 local-media-store path traversal', () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'local-media-sec06-'));
    process.env.PATIENT_LOCAL_MEDIA_ROOT = root;
    // Place a secret outside the media root that traversal must not read
    fs.writeFileSync(path.join(root, '..', 'outside-secret.txt'), 'SECRET_OUTSIDE');
  });

  afterEach(() => {
    delete process.env.PATIENT_LOCAL_MEDIA_ROOT;
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  test('round-trip write/read under root', () => {
    const buf = Buffer.from('patient-bytes');
    const { localKey } = writeLocalMedia({
      buffer: buf,
      localKey: 'patient-media/p1/a.bin',
    });
    expect(Buffer.compare(readLocalMedia(localKey), buf)).toBe(0);
    expect(Buffer.compare(readLocalMedia(`local://${localKey}`), buf)).toBe(0);
  });

  test('adversarial: readLocalMedia rejects .. traversal', () => {
    expect(() => readLocalMedia('../outside-secret.txt')).toThrow(/invalid_local_key/);
    expect(() => readLocalMedia('patient-media/../../outside-secret.txt')).toThrow(
      /invalid_local_key/
    );
    expect(() => assertSafeLocalKey('foo/../../../etc/passwd')).toThrow(/invalid_local_key/);
  });

  test('adversarial: writeLocalMedia rejects ..', () => {
    expect(() =>
      writeLocalMedia({ buffer: Buffer.from('x'), localKey: '../escape.bin' })
    ).toThrow(/invalid_local_key/);
  });

  test('adversarial: absolute path rejected', () => {
    expect(() => readLocalMedia('/etc/passwd')).toThrow(/invalid_local_key/);
  });
});
