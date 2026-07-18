/**
 * P7.45–P7.47 — Alerts history entry, Ask/Learn Coming soon, empty never redirects to Check.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import {
  ALERTS_EMPTY_NEVER_REDIRECTS,
  settleAlertsFeed,
} from '@/lib/alerts-empty-policy';

const ROOT = join(__dirname, '../..');
const APP = join(ROOT, 'app');

describe('P7.45 Alerts history from Progress/Profile', () => {
  it('Progress + Profile expose alerts history entry points', () => {
    const progressMod = readFileSync(
      join(ROOT, 'components/progress/ProgressAlertsModule.tsx'),
      'utf8',
    );
    expect(progressMod).toMatch(/progress-alerts-history/);
    expect(progressMod).toMatch(/ALERTS_HREF/);

    const account = readFileSync(join(APP, '(tabs)/account.tsx'), 'utf8');
    expect(account).toMatch(/ALERTS_HISTORY_HREF/);
    expect(account).toMatch(/profile-alerts-history-row/);
  });
});

describe('P8.07 / P7.46 Shelf Ask/Learn live (no dead Coming soon CTAs)', () => {
  it('Ask/Learn hit API — not Coming soon stubs after P8.07', () => {
    const src = readFileSync(
      join(ROOT, 'components/shelf/ShelfItemActions.tsx'),
      'utf8',
    );
    expect(src).toMatch(/shelf-ask-action/);
    expect(src).toMatch(/shelf-learn-action/);
    expect(src).toMatch(/\/api\/patient\/shelf\/ask-learn/);
    expect(src).not.toMatch(/SHELF_ASK_COMING_SOON/);
    expect(src).not.toMatch(/Coming soon/);
  });
});

describe('P7.47 Alerts empty must not auto-redirect to Check', () => {
  it('settleAlertsFeed + screens never bounce empty → Check', () => {
    const settled = settleAlertsFeed([]);
    expect(settled.empty).toBe(true);
    expect(settled.autoRedirectTo).toBeNull();
    expect(ALERTS_EMPTY_NEVER_REDIRECTS).toBe(true);

    const alerts = readFileSync(join(APP, 'alerts.tsx'), 'utf8');
    expect(alerts).toMatch(/settleAlertsFeed/);
    expect(alerts).toMatch(/alerts-empty/);
    expect(alerts).toMatch(/alerts-go-progress/);
    // Empty path must not auto-navigate; optional manual Check link is OK
    expect(alerts).not.toMatch(/if \(settled\.empty\)[\s\S]{0,120}CHECK_HREF/);
    expect(alerts).not.toMatch(/autoRedirectTo[\s\S]{0,40}router\.(replace|push)\(CHECK_HREF\)/);

    const progressMod = readFileSync(
      join(ROOT, 'components/progress/ProgressAlertsModule.tsx'),
      'utf8',
    );
    expect(progressMod).not.toMatch(/empty_redirect_to_check_retired/);
    expect(progressMod).not.toMatch(/CHECK_HREF/);
  });
});
