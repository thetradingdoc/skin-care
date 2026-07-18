'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

describe('C1 local media write → downloadBuffer round-trip', () => {
  let tmpRoot;
  const prevRoot = process.env.PATIENT_LOCAL_MEDIA_ROOT;
  const prevAzure = {
    AZURE_STORAGE_ACCOUNT: process.env.AZURE_STORAGE_ACCOUNT,
    AZURE_STORAGE_KEY: process.env.AZURE_STORAGE_KEY,
    AZURE_STORAGE_CONTAINER: process.env.AZURE_STORAGE_CONTAINER,
  };

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'touche-media-'));
    process.env.PATIENT_LOCAL_MEDIA_ROOT = tmpRoot;
    delete process.env.AZURE_STORAGE_ACCOUNT;
    delete process.env.AZURE_STORAGE_KEY;
    delete process.env.AZURE_STORAGE_CONTAINER;
    jest.resetModules();
  });

  afterEach(() => {
    if (prevRoot === undefined) delete process.env.PATIENT_LOCAL_MEDIA_ROOT;
    else process.env.PATIENT_LOCAL_MEDIA_ROOT = prevRoot;
    for (const [k, v] of Object.entries(prevAzure)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch (_) {}
  });

  test('gcs-billing-storage uploadBuffer writes bytes downloadBuffer can read', async () => {
    const gcs = require('../services/gcs-billing-storage');
    const payload = Buffer.from('jpeg-bytes-roundtrip-c1');
    const uploaded = await gcs.uploadBuffer({
      buffer: payload,
      contentType: 'image/jpeg',
      patientId: 'p_c1',
      fileName: 'spot.jpg',
    });
    expect(uploaded.storageRef.startsWith('local://')).toBe(true);
    expect(uploaded.provider).toBe('local');
    const abs = path.join(tmpRoot, uploaded.storageKey);
    expect(fs.existsSync(abs)).toBe(true);
    const back = await gcs.downloadBuffer(uploaded.storageRef);
    expect(Buffer.compare(back, payload)).toBe(0);
  });

  test('persistRecordMedia local fallback round-trips via downloadBuffer', async () => {
    const { persistRecordMedia } = require('../services/patient-record-media');
    const gcs = require('../services/gcs-billing-storage');
    const payload = Buffer.from('%PDF-1.4 fake');
    const stored = await persistRecordMedia({
      buffer: payload,
      contentType: 'application/pdf',
      sessionId: 'sess_c1',
      fileName: 'bill.pdf',
      mediaType: 'pdf',
    });
    expect(stored.storage_ref.startsWith('local://')).toBe(true);
    expect(fs.existsSync(path.join(tmpRoot, stored.storage_key))).toBe(true);
    const back = await gcs.downloadBuffer(stored.storage_ref);
    expect(Buffer.compare(back, payload)).toBe(0);
  });
});
