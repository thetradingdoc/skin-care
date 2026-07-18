'use strict';

const Database = require('better-sqlite3');
const {
  uploadBuffer,
  downloadBuffer,
  parseStorageRef,
  issueReadUrl,
} = require('../services/gcs-billing-storage');
const {
  presentFact,
  consumeMediaToken,
  issueSignedOrTokenUrl,
} = require('../services/patient-record-media-access');
const { mediaFieldsFromRef } = require('../services/patient-record-dual-write');

describe('gcs-billing-storage P3.06 + opaque refs', () => {
  test('parseStorageRef handles azure:// and legacy https', () => {
    const a = parseStorageRef('azure://cont/patients/x/y.jpg');
    expect(a.provider).toBe('azure');
    expect(a.key).toBe('patients/x/y.jpg');
    const legacy = parseStorageRef(
      'https://acct.blob.core.windows.net/cont/patients/x/y.jpg?sv=1',
    );
    expect(legacy.provider).toBe('azure');
    expect(legacy.key).toBe('patients/x/y.jpg');
    expect(legacy.storage_ref).toBe('azure://cont/patients/x/y.jpg');
  });

  test('uploadBuffer local returns opaque local:// + storageKey', async () => {
    const prev = {
      AZURE_STORAGE_ACCOUNT: process.env.AZURE_STORAGE_ACCOUNT,
      AZURE_STORAGE_KEY: process.env.AZURE_STORAGE_KEY,
      AZURE_STORAGE_CONTAINER: process.env.AZURE_STORAGE_CONTAINER,
    };
    delete process.env.AZURE_STORAGE_ACCOUNT;
    delete process.env.AZURE_STORAGE_KEY;
    delete process.env.AZURE_STORAGE_CONTAINER;
    const uploaded = await uploadBuffer({
      buffer: Buffer.from('hello'),
      contentType: 'image/jpeg',
      patientId: 'p1',
      fileName: 'a.jpg',
    });
    expect(uploaded.storageRef.startsWith('local://')).toBe(true);
    expect(uploaded.storageKey).toBeTruthy();
    expect(uploaded.provider).toBe('local');
    expect(String(uploaded.storageRef)).not.toMatch(/^https?:\/\//);
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  test('downloadBuffer rejects unsupported refs', async () => {
    await expect(downloadBuffer('ftp://nope')).rejects.toThrow(/unsupported_storage_ref/);
  });

  test('mediaFieldsFromRef drops permanent https into opaque', () => {
    const fields = mediaFieldsFromRef(
      'https://acct.blob.core.windows.net/cont/patients/x.jpg?sig=1',
    );
    expect(fields.storage_ref).toBe('azure://cont/patients/x.jpg');
    expect(fields.storage_key).toBe('patients/x.jpg');
    expect(fields.storage_provider).toBe('azure');
  });
});

describe('durable media tokens (070)', () => {
  let db;
  beforeEach(() => {
    db = new Database(':memory:');
  });
  afterEach(() => {
    try {
      db.close();
    } catch (_) {}
  });

  test('token issued with db can be consumed on another lookup', () => {
    const fact = {
      id: 'prf_1',
      storage_ref: 'local://patient-media/x.jpg',
      storage_key: 'patient-media/x.jpg',
      storage_provider: 'local',
    };
    const issued = issueSignedOrTokenUrl(fact, { db, ttlSec: 120 });
    expect(issued.media_url).toMatch(/\/api\/patient\/records\/media\//);
    const token = issued.media_url.split('/').pop();
    const entry = consumeMediaToken(token, db);
    expect(entry).toBeTruthy();
    expect(entry.storage_key).toBe('patient-media/x.jpg');

    const presented = presentFact(fact, { db });
    expect(presented.storage_ref).toBe('local://patient-media/x.jpg');
    expect(presented.media_url).toBeTruthy();
  });

  test('presentFact redacts https', () => {
    const presented = presentFact({
      id: 'prf_2',
      storage_ref: 'https://acct.blob.core.windows.net/c/k.jpg',
      storage_key: null,
    });
    expect(presented.storage_ref).toBe('azure://c/k.jpg');
  });
});
