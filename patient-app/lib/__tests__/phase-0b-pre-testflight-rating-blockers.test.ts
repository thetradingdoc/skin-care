/**
 * Phase 0 / 0b — Pre-TestFlight rating blockers.
 * Assert the OLD broken state cannot silently return (retirement pattern).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { ALERTS_EMPTY_NEVER_REDIRECTS, settleAlertsFeed } from '@/lib/alerts-empty-policy';
import { progressShowsBillModule, progressShowsSkinModule } from '@/lib/progress-module-visibility';

const ROOT = join(__dirname, '../..');
const APP = join(ROOT, 'app');

function readApp(rel: string) {
  return readFileSync(join(APP, rel), 'utf8');
}

function readComp(rel: string) {
  return readFileSync(join(ROOT, 'components', rel), 'utf8');
}

describe('Phase 0b — debug/test-lock strings must not render', () => {
  it('ProgressAlertsModule never renders empty_redirect_to_check_retired / redirect_bug', () => {
    const src = readComp('progress/ProgressAlertsModule.tsx');
    expect(src).toMatch(/progress-alerts-empty/);
    expect(src).toMatch(/No alerts right now/);
    expect(src).toMatch(/progress-alerts-no-redirect/);
    expect(src).not.toMatch(/empty_redirect_to_check_retired/);
    expect(src).not.toMatch(/redirect_bug/);
    expect(src).not.toMatch(/ALERTS_EMPTY_NEVER_REDIRECTS \?/);
    // Policy lock still lives in lib (not UI)
    expect(ALERTS_EMPTY_NEVER_REDIRECTS).toBe(true);
    expect(settleAlertsFeed([]).autoRedirectTo).toBeNull();
  });

  it('Track never renders /api/patient/marks as user-visible copy', () => {
    const src = readApp('(tabs)/track.tsx');
    expect(src).toMatch(/fetchMarksList/);
    expect(src).not.toMatch(/track-marks-api-source/);
    expect(src).not.toMatch(/>\s*\/api\/patient\/marks\s*</);
    expect(src).not.toMatch(/apiHint/);
  });

  it('Calendar never renders patient_record_facts / raw API as footer', () => {
    const src = readApp('(tabs)/calendar.tsx');
    expect(src).toMatch(/fetchFactsCalendar/);
    expect(src).not.toMatch(/calendar-api-source/);
    expect(src).not.toMatch(/patient_record_facts/);
    expect(src).not.toMatch(/FACTS_CALENDAR_API/);
    expect(src).not.toMatch(/styles\.source/);
  });

  it('mark-compare never renders API path prefix as visible copy', () => {
    const src = readApp('capture/mark-compare.tsx');
    expect(src).toMatch(/fetchCompareGroupTimeline/);
    expect(src).not.toMatch(/mark-compare-api-source/);
    expect(src).not.toMatch(/MARKS_COMPARE_API_PREFIX/);
  });
});

describe('Phase 0b — brand Touche (not Skin & Care / Skin Journal)', () => {
  it('onboarding signup brand is touche', () => {
    const src = readApp('onboarding/signup.tsx');
    expect(src).toMatch(/>touche</);
    expect(src).not.toMatch(/Skin & Care/);
    expect(src).not.toMatch(/Skin Journal/);
  });

  it('app.json expo.name is touche without Skin Journal suffix', () => {
    const src = readFileSync(join(ROOT, 'app.json'), 'utf8');
    expect(src).toMatch(/"name": "touche"/);
    expect(src).not.toMatch(/Skin Journal/);
    expect(src).not.toMatch(/Skin & Care/);
  });

  it('patient-app TS/TSX sources have no user-facing Skin & Care brand', () => {
    const hits: string[] = [];
    for (const rel of [
      'app/onboarding/signup.tsx',
      'app/welcome.tsx',
      'app/sign-in.tsx',
      'constants/brandCopy.ts',
      'app.json',
    ]) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      if (/Skin & Care|Skin Journal/.test(src)) hits.push(rel);
    }
    expect(hits).toEqual([]);
  });
});

describe('Phase 0b — Progress empty / streak copy + aggregates shape', () => {
  it('PhotoStreakHero has no Home / camera-first streak copy', () => {
    const src = readComp('progress/PhotoStreakHero.tsx');
    expect(src).not.toMatch(/\bHome\b/);
    expect(src).not.toMatch(/Start your photo streak/);
    expect(src).not.toMatch(/daily progress photo on Home/);
    expect(src).toMatch(/Track|Capture|Log/);
  });

  it('Progress only shows PhotoStreakHero when empty — not whenever streak===0 with facts', () => {
    const src = readApp('(tabs)/progress.tsx');
    expect(src).toMatch(/!hasAnyFacts \? <ProgressEmptyState/);
    expect(src).toMatch(/!loading && !hasAnyFacts \? \(\s*\n\s*<PhotoStreakHero/);
    expect(src).toMatch(/streak === 0 && hasAnyFacts/);
    expect(src).toMatch(/proof-streak-zero/);
    expect(src).not.toMatch(/\bCOMPARE_HREF\b/);
    expect(src).not.toMatch(/See day 1 vs today/);
  });

  it('hasAnyFacts keys match real aggregates modules (skin|bill|rx|mark) — not confirmed_total stub shape', () => {
    const src = readApp('(tabs)/progress.tsx');
    expect(src).toMatch(/aggregates\?\.skin \|\| aggregates\?\.bill \|\| aggregates\?\.rx \|\| aggregates\?\.mark/);
    // Wrong Playwright-era stub shape must not drive visibility
    expect(src).not.toMatch(/confirmed_total/);
    expect(progressShowsSkinModule({ skin: { fact_count: 1 } })).toBe(true);
    expect(progressShowsBillModule({ bill: { fact_count: 1 } })).toBe(true);
    expect(progressShowsSkinModule({ confirmed_total: 4 } as never)).toBe(false);
  });
});

describe('Phase 0b — /compare retired; Progress uses mark-compare', () => {
  it('compare.tsx is a Redirect stub — no loadCompareBundle / routine compare', () => {
    const src = readApp('compare.tsx');
    expect(src).toMatch(/Redirect/);
    expect(src).toMatch(/MARK_COMPARE_HREF|MARK_PICKER_HREF/);
    expect(src).not.toMatch(/loadCompareBundle/);
    expect(src).not.toMatch(/routine-compare/);
    expect(src).not.toMatch(/Compare progress/);
    expect(src).not.toMatch(/JournalTokens/);
  });

  it('Progress compare CTA routes to MARK_COMPARE_HREF — never legacy COMPARE_HREF', () => {
    const src = readApp('(tabs)/progress.tsx');
    expect(src).toMatch(/MARK_COMPARE_HREF/);
    expect(src).toMatch(/proof-compare-cta/);
    expect(src).not.toMatch(/\bCOMPARE_HREF\b/);
    expect(src).not.toMatch(/pathname:\s*COMPARE_HREF/);
    expect(src).not.toMatch(/as '\/compare'/);
  });
});

describe('Phase 0b — capture copy is photo-only (no PDF claim while pickers are images-only)', () => {
  it('capture 2a does not claim PDF; pickers stay images-only', () => {
    const src = readApp('capture/index.tsx');
    expect(src).toMatch(/capture-photo-hint-copy/);
    expect(src).toMatch(/CAPTURE_2A_PHOTO_HINT/);
    expect(src).toMatch(/photo — video not in this version/);
    expect(src).not.toMatch(/photo or PDF/i);
    expect(src).not.toMatch(/capture-photo-pdf-copy/);
    expect(src).toMatch(/mediaTypes:\s*\[['"]images['"]\]/);
    expect(src).not.toMatch(/DocumentPicker|expo-document-picker/);
  });

  it('Track Log something subtitle does not claim PDF', () => {
    const src = readApp('(tabs)/track.tsx');
    expect(src).not.toMatch(/Photo or PDF/i);
    expect(src).toMatch(/Take a photo/);
  });
});
