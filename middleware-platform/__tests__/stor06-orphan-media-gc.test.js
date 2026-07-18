'use strict';

/**
 * STOR-06 — orphan media deleted when structure/policy fails after persist.
 */

const fs = require('fs');
const path = require('path');

describe('STOR-06 orphan media GC on failed persist', () => {
  test('orchestrator deletes storage after structure/policy failure (source)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../services/capture-orchestration/index.js'),
      'utf8'
    );
    expect(src).toMatch(/deleteRecordMedia/);
    expect(src).toMatch(/STRUCTURED_VALIDATION_FAILED/);
    // Adversarial: both failure paths must call delete
    const structIdx = src.indexOf('structured_validation_failed');
    const policyIdx = src.indexOf('policy:${policy.error_code}');
    expect(structIdx).toBeGreaterThan(-1);
    expect(policyIdx).toBeGreaterThan(-1);
    expect(src.slice(structIdx, structIdx + 400)).toMatch(/deleteRecordMedia/);
    expect(src.slice(policyIdx - 200, policyIdx + 200)).toMatch(/deleteRecordMedia/);
  });

  test('deleteRecordMedia removes local:// refs', async () => {
    const { writeLocalMedia } = require('../services/local-media-store');
    const { deleteRecordMedia } = require('../services/patient-record-media');
    const key = `patient-media/stor06/test_${Date.now()}.bin`;
    const written = writeLocalMedia({ buffer: Buffer.from('orphan'), localKey: key });
    expect(fs.existsSync(written.absolutePath)).toBe(true);
    const out = await deleteRecordMedia({
      storage_ref: written.storage_ref,
      storage_key: written.localKey,
      storage_provider: 'local',
    });
    expect(out.deleted).toBe(true);
    expect(fs.existsSync(written.absolutePath)).toBe(false);
  });
});
