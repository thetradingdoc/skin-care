/**
 * Capture FormData + failure routing — regression for empty-file 2c mask.
 * Device failure: appendUploadToForm(form, 'file', file) uploaded the string "file"
 * → gate 422 QUALITY_GATE_FAILED → generic vision-fail copy.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

import { PatientApiError } from '@/lib/patient-api-error';
import {
  captureFailureHref,
  routeCaptureFailure,
} from '@/lib/route-capture-failure';
import { appendUploadToForm, uriToUploadFile } from '@/lib/upload-uri';
import { copyForCaptureFailure } from '@/lib/capture-failure-copy';

const ROOT = join(__dirname, '../..');

const UPLOAD_CALLERS = [
  'lib/capture-orchestration-client.ts',
  'lib/patient-record-capture.ts',
  'lib/journal-api.ts',
  'lib/spot-store.ts',
  'lib/routine-capture.ts',
] as const;

describe('capture upload FormData call sites (device 2c root cause)', () => {
  it('uriToUploadFile / appendUploadToForm use options objects everywhere', async () => {
    const file = await uriToUploadFile({
      uri: 'file:///var/mobile/IMG_001.HEIC',
      fileName: 'gate-skin.jpg',
      mimeType: 'image/heic',
    });
    expect(file).toMatchObject({
      uri: 'file:///var/mobile/IMG_001.HEIC',
      name: 'gate-skin.jpg',
      type: 'image/heic',
    });

    for (const rel of UPLOAD_CALLERS) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      // No positional calls left
      expect(src, rel).not.toMatch(/uriToUploadFile\(\s*['"`]/);
      expect(src, rel).not.toMatch(/appendUploadToForm\(\s*form\s*,/);
      expect(src, rel).toMatch(/uriToUploadFile\(\{/);
      expect(src, rel).toMatch(/appendUploadToForm\(\{/);
    }
  });

  it('appendUploadToForm appends the file payload, not the string "file"', () => {
    const calls: unknown[] = [];
    const form = {
      append(key: string, value: unknown, filename?: string) {
        calls.push({ key, value, filename });
      },
    } as unknown as FormData;
    const payload = { uri: 'file://x.jpg', name: 'old.jpg', type: 'image/jpeg' };
    appendUploadToForm({ form, file: payload, fileName: 'x.jpg' });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      key: 'file',
      value: { uri: 'file://x.jpg', name: 'x.jpg', type: 'image/jpeg' },
    });
    expect((calls[0] as { value: unknown }).value).not.toBe('file');
  });

  it('capture 2a requests Compatible representation (HEIC → JPEG on iOS)', () => {
    const src = readFileSync(join(ROOT, 'app/capture/index.tsx'), 'utf8');
    expect(src).toMatch(/UIImagePickerPreferredAssetRepresentationMode\.Compatible/);
    expect(src).toMatch(/CAPTURE_IMAGE_PICKER_OPTIONS/);
  });
});

describe('routeCaptureFailure — distinct codes, not one mask', () => {
  it('maps QUALITY_GATE_FAILED to quality_fail with error_code in href', () => {
    const err = new PatientApiError('QUALITY_GATE_FAILED', {
      status: 422,
      error_code: 'QUALITY_GATE_FAILED',
      body: { message: 'No image or document bytes received.' },
    });
    const out = routeCaptureFailure(err);
    expect(out.reason).toBe('quality_fail');
    expect(out.error_code).toBe('QUALITY_GATE_FAILED');
    expect(out.href).toContain('error_code=QUALITY_GATE_FAILED');
    expect(out.href).toContain('reason=quality_fail');
  });

  it('maps AV_SCAN_BLOCKED to av_blocked with distinct reason (not vision_fail)', () => {
    const err = new PatientApiError('AV_SCAN_BLOCKED', {
      status: 403,
      error_code: 'AV_SCAN_BLOCKED',
    });
    const out = routeCaptureFailure(err);
    expect(out.reason).toBe('av_blocked');
    expect(out.href).toContain('reason=av_blocked');
    expect(out.href).toContain('error_code=AV_SCAN_BLOCKED');
  });

  it('maps PERCEIVE_FAILED to vision_fail', () => {
    const err = new PatientApiError('PERCEIVE_FAILED', {
      status: 500,
      error_code: 'PERCEIVE_FAILED',
    });
    const out = routeCaptureFailure(err);
    expect(out.reason).toBe('vision_fail');
    expect(out.href).toContain('error_code=PERCEIVE_FAILED');
  });

  it('maps OCR_EMPTY to vision_fail with manual escape (2c)', () => {
    const err = new PatientApiError('OCR_EMPTY', {
      status: 422,
      error_code: 'OCR_EMPTY',
    });
    const out = routeCaptureFailure(err);
    expect(out.reason).toBe('vision_fail');
    expect(out.href).toContain('/capture/vision-fail');
    expect(out.href).toContain('error_code=OCR_EMPTY');
    const copy = copyForCaptureFailure({ reason: 'vision_fail', error_code: 'OCR_EMPTY' });
    expect(copy.allowManual).toBe(true);
    expect(copy.testID).toBe('screen-2c-vision-fail');
  });

  it('captureFailureHref preserves codes for UI', () => {
    expect(captureFailureHref('/capture/vision-fail', { error_code: 'X', reason: 'av_blocked' })).toBe(
      '/capture/vision-fail?error_code=X&reason=av_blocked',
    );
  });
});

describe('2c copyForCaptureFailure accuracy', () => {
  it('does not show vision-fail title for AV or quality', () => {
    expect(copyForCaptureFailure({ reason: 'av_blocked', error_code: 'AV_SCAN_BLOCKED' }).title).toMatch(
      /couldn't accept this file/,
    );
    expect(copyForCaptureFailure({ reason: 'quality_fail', error_code: 'QUALITY_GATE_FAILED' }).title).toMatch(
      /couldn't get a clear read/,
    );
    expect(copyForCaptureFailure({ reason: 'vision_fail', error_code: 'PERCEIVE_FAILED' }).title).toMatch(
      /couldn't read this clearly/,
    );
  });
});
