/**
 * Phase D — Legacy retirement regression.
 * Prove old routes cannot quietly keep serving product UI alongside the new paths.
 * Pattern: assert Redirect / retired stub, not that the new screen merely exists.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { pickPriorProgressPhotoFromDays } from '@/lib/facts-calendar';

const ROOT = join(__dirname, '../..');
const APP = join(ROOT, 'app');

function readApp(rel: string) {
  return readFileSync(join(APP, rel), 'utf8');
}

describe('Phase D — check / severity no longer alternate home', () => {
  it('check.tsx is a Redirect stub into /capture — not the camera shell', () => {
    const src = readApp('check.tsx');
    expect(src).toMatch(/Redirect/);
    expect(src).toMatch(/CAPTURE_2A_HREF|\/capture/);
    expect(src).not.toMatch(/CameraView/);
    expect(src).not.toMatch(/agent-delta/);
    expect(src).not.toMatch(/sole home/i);
  });

  it('severity.tsx is a Redirect stub — not journal daily-entry writer', () => {
    const src = readApp('severity.tsx');
    expect(src).toMatch(/Redirect/);
    expect(src).toMatch(/CAPTURE_2A_HREF|\/capture/);
    expect(src).not.toMatch(/journal\/daily-entry/);
    expect(src).not.toMatch(/postJournalDailyPhoto/);
  });

  it('HOME_HREF is Progress; preferProgress:false resolves to capture not Check', () => {
    const routes = readFileSync(join(ROOT, 'constants/routes.ts'), 'utf8');
    expect(routes).toMatch(/export const HOME_HREF = PROGRESS_HREF/);
    expect(routes).toMatch(/export const CHECK_HREF = '\/check'/);
    expect(routes).toMatch(/export const SEVERITY_HREF = '\/severity'/);
    const resolver = readFileSync(join(ROOT, 'lib/resolve-post-auth-route.ts'), 'utf8');
    expect(resolver).toMatch(/preferProgress \? PROGRESS_HREF : CAPTURE_2A_HREF/);
    expect(resolver).not.toMatch(/preferProgress \? PROGRESS_HREF : CHECK_HREF/);
  });

  it('product CTAs no longer hard-navigate to Check as a working camera shell', () => {
    const progress = readApp('(tabs)/progress.tsx');
    expect(progress).toMatch(/CAPTURE_2A_HREF/);
    expect(progress).not.toMatch(/CHECK_HREF/);

    const getApp = readApp('get-the-app.tsx');
    expect(getApp).toMatch(/PROGRESS_HREF/);
    expect(getApp).not.toMatch(/CHECK_HREF/);

    const signIn = readApp('sign-in.tsx');
    expect(signIn).toMatch(/resolvePostAuthRoute/);
    expect(signIn).not.toMatch(/router\.replace\(CHECK_HREF\)/);

    const push = readFileSync(join(ROOT, 'lib/push-reminders.ts'), 'utf8');
    expect(push).toMatch(/route: '\/capture'/);
    expect(push).not.toMatch(/route: '\/check'/);

    // Middleware emitters must match client (Phase D follow-up from audit)
    const mwRoot = join(ROOT, '..', 'middleware-platform');
    for (const rel of [
      'routes/patient-devices.js',
      'services/patient-push-service.js',
      'services/medical-tracker-domain/reminder-jobs.js',
    ]) {
      const src = readFileSync(join(mwRoot, rel), 'utf8');
      expect(src).not.toMatch(/route: '\/check'/);
      expect(src).toMatch(/route: '\/capture'/);
    }
  });
});

describe('Phase D — _journal retired (product decision: remove)', () => {
  it('_journal.tsx redirects to Calendar — does not load journal calendar-range UI', () => {
    const src = readApp('(tabs)/_journal.tsx');
    expect(src).toMatch(/Redirect/);
    expect(src).toMatch(/CALENDAR_HREF|\/\(tabs\)\/calendar/);
    expect(src).not.toMatch(/journal\/calendar-range/);
    expect(src).not.toMatch(/JournalCalendarTab/);
    expect(src).not.toMatch(/RETIREMENT CANDIDATE/);
  });

  it('journal/capture.tsx redirects to /capture — no daily photo journal write', () => {
    const src = readApp('journal/capture.tsx');
    expect(src).toMatch(/Redirect/);
    expect(src).toMatch(/CAPTURE_2A_HREF|\/capture/);
    expect(src).not.toMatch(/postJournalDailyPhoto/);
  });

  it('tab layout still registers _journal only as a hidden redirect target', () => {
    const layout = readApp('(tabs)/_layout.tsx');
    expect(layout).toMatch(/name="_journal"/);
    expect(layout).toMatch(/href:\s*null/);
  });
});

describe('Phase D — track/[spotId] wrapped behind marks compare; dual-write stopped', () => {
  it('track/[spotId] redirects to mark-compare — does not call spot-store', () => {
    const src = readApp('track/[spotId].tsx');
    expect(src).toMatch(/Redirect/);
    expect(src).toMatch(/MARK_COMPARE_HREF|mark-compare/);
    expect(src).toMatch(/compareGroupId/);
    expect(src).not.toMatch(/getSpot/);
    expect(src).not.toMatch(/fetchSpotTimeline/);
    expect(src).not.toMatch(/spot-store/);
  });

  it('track/capture writes facts only — no createSpot/addSpotPhoto dual-write', () => {
    const src = readApp('track/capture.tsx');
    expect(src).toMatch(/captureRecordFact/);
    expect(src).toMatch(/MARK_COMPARE_HREF/);
    expect(src).not.toMatch(/createSpot/);
    expect(src).not.toMatch(/addSpotPhoto/);
    expect(src).not.toMatch(/Keep spots timeline UX/);
  });

  it('MARK_COMPARE_HREF remains the compare surface', () => {
    const routes = readFileSync(join(ROOT, 'constants/routes.ts'), 'utf8');
    expect(routes).toMatch(/MARK_COMPARE_HREF = '\/capture\/mark-compare'/);
    const compare = readApp('capture/mark-compare.tsx');
    expect(compare).toMatch(/fetchCompareGroupTimeline/);
  });

  it('compare.tsx is a Redirect stub into mark-compare / mark-picker — not routine compare', () => {
    const src = readApp('compare.tsx');
    expect(src).toMatch(/Redirect/);
    expect(src).toMatch(/MARK_COMPARE_HREF|MARK_PICKER_HREF/);
    expect(src).not.toMatch(/loadCompareBundle/);
    expect(src).not.toMatch(/routine\/compare/);
  });
});

describe('Phase D — routine prior-photo overlay off journal/calendar-range', () => {
  it('routine-capture-overlay reads facts calendar SSOT — not the journal calendar API', () => {
    const overlay = readFileSync(join(ROOT, 'lib/routine-capture-overlay.ts'), 'utf8');
    expect(overlay).toMatch(/fetchFactsCalendar/);
    expect(overlay).toMatch(/FACTS_CALENDAR_API|pickPriorProgressPhotoFromDays/);
    expect(overlay).not.toMatch(/\/api\/patient\/journal\/calendar-range/);
    expect(overlay).not.toMatch(/\/api\/patient\/routine\/daily/);
  });

  it('routine/capture.tsx still wires the overlay (prior photo comparison)', () => {
    const src = readApp('routine/capture.tsx');
    expect(src).toMatch(/fetchPriorProgressPhotoUrl/);
    expect(src).toMatch(/setGhostUrl/);
  });

  it('no product-path source under app/ or lib/ still calls the journal calendar API', () => {
    const roots = [join(ROOT, 'app'), join(ROOT, 'lib')];
    const hits: string[] = [];
    const CALL = /\/api\/patient\/journal\/calendar-range/;

    function walk(dir: string) {
      for (const name of readdirSync(dir)) {
        if (name === '__tests__' || name === 'node_modules') continue;
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) {
          walk(p);
          continue;
        }
        if (!/\.(tsx?|jsx?)$/.test(name)) continue;
        const src = readFileSync(p, 'utf8');
        if (CALL.test(src)) hits.push(p.replace(ROOT + '/', ''));
      }
    }
    for (const r of roots) walk(r);
    expect(hits).toEqual([]);
  });

  it('pickPriorProgressPhotoFromDays prefers newest prior skin media', () => {
    const picked = pickPriorProgressPhotoFromDays(
      [
        {
          date: '2026-07-10',
          tags: ['skin'],
          multi_type: false,
          facts: [{ id: 'a', tag: 'skin', media_url: 'https://cdn/old.jpg' }],
        },
        {
          date: '2026-07-14',
          tags: ['skin', 'bill'],
          multi_type: true,
          facts: [
            { id: 'b', tag: 'bill' },
            { id: 'c', tag: 'skin', media_url: 'https://cdn/prior.jpg' },
          ],
        },
        {
          date: '2026-07-16',
          tags: ['skin'],
          multi_type: false,
          facts: [{ id: 'd', tag: 'skin', media_url: 'https://cdn/today.jpg' }],
        },
      ],
      '2026-07-16',
    );
    expect(picked).toEqual({ priorDate: '2026-07-14', imageUrl: 'https://cdn/prior.jpg' });
  });
});
