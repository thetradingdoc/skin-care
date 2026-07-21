/**
 * P7.33–P7.39 — Each second-tier screen has its own file + dedicated assertions.
 * Not an umbrella "auth/capture UI" check.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../..');
const APP = join(ROOT, 'app');

function read(rel: string) {
  return readFileSync(join(APP, rel), 'utf8');
}

describe('P7.33 Screen 2b camera denied', () => {
  it('has its own screen with locked copy + upload escape', () => {
    const path = 'capture/camera-denied.tsx';
    expect(existsSync(join(APP, path))).toBe(true);
    const src = read(path);
    expect(src).toMatch(/P7\.33/);
    expect(src).toMatch(/screen-2b-camera-denied/);
    expect(src).toMatch(/camera access needed/);
    expect(src).toMatch(/upload photo instead/);
    expect(src).toMatch(/enter it manually/);
  });
});

describe('P7.34 Screen 2c vision fail/retry', () => {
  it('has its own screen with retry + manual escape', () => {
    const path = 'capture/vision-fail.tsx';
    expect(existsSync(join(APP, path))).toBe(true);
    const src = read(path);
    expect(src).toMatch(/P7\.34/);
    expect(src).toMatch(/vision-fail-retry/);
    expect(src).toMatch(/vision-fail-manual/);
    const copy = readFileSync(join(ROOT, 'lib/capture-failure-copy.ts'), 'utf8');
    expect(copy).toMatch(/screen-2c-vision-fail/);
    expect(copy).toMatch(/couldn't read this clearly/);
    expect(copy).toMatch(/retake or re-upload/);
    expect(copy).toMatch(/enter it manually/);
    expect(copy).toMatch(/screen-2c-av-blocked/);
    expect(copy).toMatch(/screen-2c-quality-fail/);
  });
});

describe('P7.35 Screen 2m manual entry all six tags', () => {
  it('has its own screen with canonical six-tag enum', () => {
    const path = 'capture/manual-entry.tsx';
    expect(existsSync(join(APP, path))).toBe(true);
    const src = read(path);
    expect(src).toMatch(/P7\.35/);
    expect(src).toMatch(/screen-2m-manual-entry/);
    expect(src).toMatch(/Enter it yourself/);
    expect(src).toMatch(/no AI · no photo needed/);
    expect(src).toMatch(/MANUAL_TAGS/);
    expect(src).toMatch(/manual-tag-\$/);
    for (const tag of ['skin', 'bill', 'prescription', 'mark', 'lab', 'other']) {
      expect(src).toContain(`'${tag}'`);
    }
  });
});

describe('P7.36 Screen 9 OPQRST-lite', () => {
  it('has its own skippable skin questionnaire screen', () => {
    const path = 'capture/opqrst-lite.tsx';
    expect(existsSync(join(APP, path))).toBe(true);
    const src = read(path);
    expect(src).toMatch(/P7\.36/);
    expect(src).toMatch(/screen-9-opqrst-lite/);
    expect(src).toMatch(/A few quick questions/);
    expect(src).toMatch(/only shown when you tag a skin issue · skippable/);
    expect(src).toMatch(/skip this/);
  });
});

describe('P7.37 Screen 10 routine nudge', () => {
  it('has its own one-time skippable reminders screen', () => {
    const path = 'capture/routine-nudge.tsx';
    expect(existsSync(join(APP, path))).toBe(true);
    const src = read(path);
    expect(src).toMatch(/P7\.37/);
    expect(src).toMatch(/screen-10-routine-nudge/);
    expect(src).toMatch(/Want reminders\?/);
    expect(src).toMatch(/no thanks, just let me log/);
  });
});

describe('P7.38 Screen 7b OTP entry', () => {
  it('has its own OTP entry screen (not folded into sign-in only)', () => {
    const path = 'auth/otp-entry.tsx';
    expect(existsSync(join(APP, path))).toBe(true);
    const src = read(path);
    expect(src).toMatch(/P7\.38/);
    expect(src).toMatch(/screen-7b-otp-entry/);
    expect(src).toMatch(/Enter your code/);
    expect(src).toMatch(/use a different email/);
    expect(src).toMatch(/Confirm/);
  });

  it('SEC-32 — OTP code never travels in navigation params', () => {
    const entry = read('auth/otp-entry.tsx');
    const err = read('auth/otp-error.tsx');
    expect(entry).toMatch(/otp-flow-session/);
    expect(entry).not.toMatch(/useLocalSearchParams/);
    expect(entry).not.toMatch(/params:\s*\{\s*email,\s*code/);
    expect(err).toMatch(/otp-flow-session/);
    expect(err).not.toMatch(/useLocalSearchParams/);
    expect(err).not.toMatch(/params\.code/);
    expect(err).not.toMatch(/params:\s*\{[^}]*code/);
  });
});

describe('P7.39 Screen 7c OTP error/resend', () => {
  it('has its own error/resend screen', () => {
    const path = 'auth/otp-error.tsx';
    expect(existsSync(join(APP, path))).toBe(true);
    const src = read(path);
    expect(src).toMatch(/P7\.39/);
    expect(src).toMatch(/screen-7c-otp-error/);
    expect(src).toMatch(/that code's wrong or expired/);
    expect(src).toMatch(/Resend code/);
  });
});
