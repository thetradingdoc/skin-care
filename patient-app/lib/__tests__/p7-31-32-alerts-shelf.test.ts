/**
 * P7.31–P7.32 — Progress Alerts module + Shelf hard_no surface.
 * Must consume P5.13/14 feed APIs; empty must not redirect to Check (P7.47).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import {
  ALERTS_EMPTY_NEVER_REDIRECTS,
  settleAlertsFeed,
} from '@/lib/alerts-empty-policy';
import {
  PROGRESS_ALERTS_FEED_API,
  SHELF_ALERTS_FEED_API,
  SHELF_EVALUATE_API,
} from '@/lib/alerts-shelf-apis';

const ROOT = join(__dirname, '../..');

describe('P7.31 Progress Alerts module', () => {
  it('consumes /api/patient/alerts/feed + settleAlertsFeed (no client aggregation)', () => {
    const src = readFileSync(
      join(ROOT, 'components/progress/ProgressAlertsModule.tsx'),
      'utf8',
    );
    expect(PROGRESS_ALERTS_FEED_API).toBe('/api/patient/alerts/feed');
    expect(src).toMatch(/settleAlertsFeed/);
    expect(src).toMatch(/PROGRESS_ALERTS_FEED_API|\/api\/patient\/alerts\/feed/);
    expect(src).not.toMatch(/buildUnifiedAlertsFeed|buildPatientAlerts/);
    expect(src).not.toMatch(/allergen.*aggregat|computeFactsAgentDelta/);
  });

  it('empty alerts never redirect to Check (P5.13 / P7.47)', () => {
    const settled = settleAlertsFeed([]);
    expect(settled.empty).toBe(true);
    expect(settled.autoRedirectTo).toBeNull();
    expect(ALERTS_EMPTY_NEVER_REDIRECTS).toBe(true);

    const src = readFileSync(
      join(ROOT, 'components/progress/ProgressAlertsModule.tsx'),
      'utf8',
    );
    expect(src).toMatch(/progress-alerts-empty/);
    expect(src).toMatch(/progress-alerts-no-redirect/);
    expect(src).not.toMatch(/empty_redirect_to_check_retired/);
    expect(src).not.toMatch(/redirect_bug/);
    expect(src).not.toMatch(/router\.(replace|push)\(CHECK_HREF\)/);
    expect(src).not.toMatch(/CHECK_HREF/);

    const progress = readFileSync(join(ROOT, 'app/(tabs)/progress.tsx'), 'utf8');
    expect(progress).toMatch(/ProgressAlertsModule/);
  });
});

describe('P7.32 Shelf conflict/hard_no surface', () => {
  it('uses evaluate + alerts feed — not a client-side allergen reimplementation', () => {
    const src = readFileSync(
      join(ROOT, 'components/shelf/ShelfConflictHardNoSurface.tsx'),
      'utf8',
    );
    expect(SHELF_ALERTS_FEED_API).toBe('/api/patient/alerts/feed');
    expect(SHELF_EVALUATE_API).toBe('/api/patient/routine/evaluate');
    expect(src).toMatch(/fetchEvaluateLineup/);
    expect(src).toMatch(/settleAlertsFeed/);
    expect(src).toMatch(/shelf-conflict-hard-no-surface/);
    expect(src).not.toMatch(/detectAllergenHardNos|allergen-hard-no-service/);
  });

  it('shelf tab mounts the hard_no surface', () => {
    const shelf = readFileSync(join(ROOT, 'app/(tabs)/shelf.tsx'), 'utf8');
    expect(shelf).toMatch(/ShelfConflictHardNoSurface/);
    expect(shelf).toMatch(/P7\.32/);
    expect(shelf).not.toMatch(/export \{ default \} from '\.\/scan'/);
  });
});
