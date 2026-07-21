/**
 * P7.09–P7.17 — Language, share-doctor, welcome, capture copy, try-*, auth 7,
 * empty states, T6/T8, welcome bonus.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { CALENDAR_EMPTY_TITLE } from '@/lib/calendar-empty-copy';

const ROOT = join(__dirname, '../..');
const APP = join(ROOT, 'app');

describe('P7.09 Profile Language stub T11', () => {
  it('has dedicated language screen wired from Profile', () => {
    expect(existsSync(join(APP, 'profile/language.tsx'))).toBe(true);
    const src = readFileSync(join(APP, 'profile/language.tsx'), 'utf8');
    expect(src).toMatch(/screen-profile-language/);
    expect(src).toMatch(/LANGUAGE_TITLE = 'Language'/);
    expect(src).toMatch(/more app languages coming/);
    const account = readFileSync(join(APP, '(tabs)/account.tsx'), 'utf8');
    expect(account).toMatch(/PROFILE_LANGUAGE_HREF/);
    expect(account).toMatch(/profile-language-row/);
  });
});

describe('P7.10 Share with doctor wired to export API', () => {
  it('hits physician.pdf + physician-share — not a dead stub', () => {
    const src = readFileSync(join(APP, 'profile/share-with-doctor.tsx'), 'utf8');
    expect(src).toMatch(/SHARE_EXPORT_API = '\/api\/patient\/export\/physician\.pdf'/);
    expect(src).toMatch(/SHARE_LINK_API = '\/api\/patient\/export\/physician-share'/);
    expect(src).toMatch(/screen-share-with-doctor/);
    expect(src).toMatch(/patientGet/);
    expect(src).toMatch(/patientPost/);
    const account = readFileSync(join(APP, '(tabs)/account.tsx'), 'utf8');
    expect(account).toMatch(/PROFILE_SHARE_DOCTOR_HREF/);
  });
});

describe('P7.11 Welcome copy states 20 AI reads free each month', () => {
  it('locks the 20 AI reads free phrase', () => {
    const src = readFileSync(join(APP, 'welcome.tsx'), 'utf8');
    expect(src).toMatch(/20 AI reads free each month/);
    expect(src).toMatch(/welcome-20-ai-reads/);
    expect(src).toMatch(/screen-welcome/);
  });
});

describe('P7.12 Capture copy photo-only — video not in this version', () => {
  it('locks photo-only copy on 2a (no PDF claim while pickers are images-only)', () => {
    const src = readFileSync(join(APP, 'capture/index.tsx'), 'utf8');
    expect(src).toMatch(/capture-photo-hint-copy/);
    expect(src).toMatch(/photo — video not in this version/);
    expect(src).not.toMatch(/photo or PDF/i);
  });
});

describe('P7.13 Keep try-* Shopify funnel entry', () => {
  it('is guarded by dedicated adversarial funnel suite (not route-existence alone)', () => {
    expect(existsSync(join(__dirname, 'p7-13-try-shopify-funnel.test.ts'))).toBe(true);
    const funnel = readFileSync(join(__dirname, 'p7-13-try-shopify-funnel.test.ts'), 'utf8');
    expect(funnel).toMatch(/P7\.13 try-\* Shopify funnel end-to-end/);
    expect(funnel).toMatch(/try-verdict → allergens → reveal → handoff/);
  });
});

describe('P7.14 OTP + name collection (no password)', () => {
  it('auth collects name with OTP and has no password field', () => {
    const otp = readFileSync(join(ROOT, 'components/OtpForm.tsx'), 'utf8');
    expect(otp).toMatch(/auth-name-input/);
    expect(otp).toMatch(/P7\.14/);
    expect(otp).toMatch(/styles\.label\}>Name</);
    expect(otp).not.toMatch(/secureTextEntry/);
    expect(otp).not.toMatch(/autoComplete="password"/);
    const signIn = readFileSync(join(APP, 'sign-in.tsx'), 'utf8');
    expect(signIn).toMatch(/OtpForm/);
    expect(signIn).not.toMatch(/secureTextEntry/);
  });
});

describe('P7.15 Empty states Calendar Shelf Progress', () => {
  it('three tabs each have empty UI', () => {
    expect(CALENDAR_EMPTY_TITLE).toBe('Nothing logged yet');
    expect(existsSync(join(ROOT, 'components/facts-calendar/FactsCalendarEmpty.tsx'))).toBe(
      true,
    );
    const shelf = readFileSync(join(APP, '(tabs)/shelf.tsx'), 'utf8');
    expect(shelf).toMatch(/shelf-empty/);
    expect(shelf).toMatch(/Your shelf is empty|SHELF_EMPTY_TITLE/);
    const progressEmpty = readFileSync(
      join(ROOT, 'components/progress/ProgressEmptyState.tsx'),
      'utf8',
    );
    expect(progressEmpty).toMatch(/progress-empty-t9b/);
    expect(progressEmpty).toMatch(/No progress to show yet|Nothing to show yet/);
    const progress = readFileSync(join(APP, '(tabs)/progress.tsx'), 'utf8');
    expect(progress).toMatch(/ProgressEmptyState/);
    expect(progress).toMatch(/progress-empty|ProgressEmptyState/);
  });
});

describe('P7.16 AI cap T6 and unlock T8 screens', () => {
  it('has dedicated T6 + T8 screens', () => {
    const cap = readFileSync(join(APP, 'capture/ai-cap.tsx'), 'utf8');
    expect(cap).toMatch(/screen-t6-ai-cap/);
    expect(cap).toMatch(/AI reads used up for this month/);
    const unlock = readFileSync(join(APP, 'capture/unlock-ai.tsx'), 'utf8');
    expect(unlock).toMatch(/screen-t8-unlock-ai/);
    expect(unlock).toMatch(/unlock-pack-20/);
    expect(unlock).toMatch(/unlock-plus/);
  });
});

describe('P7.17 Welcome bonus T7 interstitial', () => {
  it('has T7 welcome bonus screen', () => {
    const src = readFileSync(join(APP, 'capture/welcome-bonus.tsx'), 'utf8');
    expect(src).toMatch(/screen-t7-welcome-bonus/);
    expect(src).toMatch(/welcome-bonus-got-it/);
    expect(src).toMatch(/Extra reads on us/);
  });
});
