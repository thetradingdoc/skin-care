'use strict';

/**
 * Retention no longer returns remote_ref_deferred for azure:// — uses deleteBuffer.
 */

describe('P8.03 remote media purge wiring', () => {
  test('deleteMediaRef source uses gcs.deleteBuffer (not remote_ref_deferred early-return)', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '../services/patient-record-retention.js'),
      'utf8',
    );
    expect(src).not.toMatch(/remote_ref_deferred/);
    expect(src).toMatch(/gcs\.deleteBuffer/);
    expect(src).toMatch(/media_deferred/);
  });

  test('gcs-billing-storage exports deleteBuffer for azure://', () => {
    const gcs = require('../services/gcs-billing-storage');
    expect(typeof gcs.deleteBuffer).toBe('function');
    const blob = require('../services/blob-storage');
    expect(typeof blob.deleteBlob).toBe('function');
  });

  test('deleteMediaRef clears local refs when file missing (already gone)', async () => {
    const prev = process.env.PATIENT_LOCAL_MEDIA_ROOT;
    const os = require('os');
    const fs = require('fs');
    const path = require('path');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ret-local-'));
    process.env.PATIENT_LOCAL_MEDIA_ROOT = tmp;
    const { deleteMediaRef } = require('../services/patient-record-retention');
    const out = await deleteMediaRef('local://does-not-exist.jpg');
    expect(out.deleted).toBe(true);
    if (prev === undefined) delete process.env.PATIENT_LOCAL_MEDIA_ROOT;
    else process.env.PATIENT_LOCAL_MEDIA_ROOT = prev;
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
