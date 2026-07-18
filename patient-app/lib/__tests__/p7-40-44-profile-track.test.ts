/**
 * P7.40–P7.44 — Profile destinations + Rx refill + Track AI-reads chip.
 * Each task has dedicated assertions against its own screen/component.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../..');
const APP = join(ROOT, 'app');

function readApp(rel: string) {
  return readFileSync(join(APP, rel), 'utf8');
}

describe('P7.40 Profile allergens management', () => {
  it('has dedicated /profile/allergens screen wired from Profile', () => {
    expect(existsSync(join(APP, 'profile/allergens.tsx'))).toBe(true);
    const src = readApp('profile/allergens.tsx');
    expect(src).toMatch(/P7\.40/);
    expect(src).toMatch(/screen-profile-allergens/);
    expect(src).toMatch(/Save allergens/);
    const account = readApp('(tabs)/account.tsx');
    expect(account).toMatch(/PROFILE_ALLERGENS_HREF/);
    expect(account).not.toMatch(/Edit allergens[\s\S]*TRY_ALLERGENS_HREF/);
  });
});

describe('P7.41 Profile notifications permission', () => {
  it('has dedicated notifications screen', () => {
    expect(existsSync(join(APP, 'profile/notifications.tsx'))).toBe(true);
    const src = readApp('profile/notifications.tsx');
    expect(src).toMatch(/P7\.41/);
    expect(src).toMatch(/screen-profile-notifications/);
    expect(src).toMatch(/Allow notifications/);
    const account = readApp('(tabs)/account.tsx');
    expect(account).toMatch(/PROFILE_NOTIFICATIONS_HREF/);
  });
});

describe('P7.42 Profile consent/privacy', () => {
  it('has dedicated consent & privacy screen', () => {
    expect(existsSync(join(APP, 'profile/consent-privacy.tsx'))).toBe(true);
    const src = readApp('profile/consent-privacy.tsx');
    expect(src).toMatch(/P7\.42/);
    expect(src).toMatch(/screen-profile-consent-privacy/);
    expect(src).toMatch(/Consent & privacy/);
    expect(src).toMatch(/never diagnoses/);
    const account = readApp('(tabs)/account.tsx');
    expect(account).toMatch(/PROFILE_CONSENT_HREF/);
  });
});

describe('P7.43 Rx refill info destination', () => {
  it('is a real screen with never-sells copy — not a dead button', () => {
    expect(existsSync(join(APP, 'shelf/rx-refill-info.tsx'))).toBe(true);
    const src = readApp('shelf/rx-refill-info.tsx');
    expect(src).toMatch(/P7\.43/);
    expect(src).toMatch(/screen-rx-refill-info/);
    expect(src).toMatch(/refill info — contact your prescriber/);
    expect(src).toMatch(/touche never sells or refills prescription medication/);
    expect(src).toMatch(/rx-refill-back/);
    // Shelf link navigates to the destination
    const shelf = readApp('(tabs)/shelf.tsx');
    expect(shelf).toMatch(/RX_REFILL_INFO_HREF/);
    expect(shelf).toMatch(/shelf-rx-refill-info-link/);
    // Must not be a no-op Pressable without href
    expect(shelf).not.toMatch(/refill info[\s\S]{0,80}onPress=\{\(\) => \{\}\}/);
  });
});

describe('P7.44 Track AI-reads-left chip', () => {
  it('chip component exists on Track and hits usage API', () => {
    const chip = readFileSync(
      join(ROOT, 'components/track/TrackAiReadsChip.tsx'),
      'utf8',
    );
    expect(chip).toMatch(/P7\.44/);
    expect(chip).toMatch(/track-ai-reads-left-chip/);
    expect(chip).toMatch(/AI reads left/);
    expect(chip).toMatch(/\/api\/patient\/ai\/usage/);
    const track = readApp('(tabs)/track.tsx');
    expect(track).toMatch(/TrackAiReadsChip/);
  });
});
