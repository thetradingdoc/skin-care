/**
 * Phase E — public legal URLs, marketing copy alignment, try-* noindex.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const REPO = join(__dirname, '../../..');
const LANDING_PUBLIC = join(REPO, 'unified-dashboard/skin-care-landing/public');
const LANDING_CONTENT = join(REPO, 'unified-dashboard/skin-care-landing/src/content');
const APP = join(__dirname, '../..');

function read(relFromRepo: string) {
  return readFileSync(join(REPO, relFromRepo), 'utf8');
}

describe('Phase E — public Privacy / Terms', () => {
  it('ships standalone privacy.html and terms.html (not login-gated)', () => {
    expect(existsSync(join(LANDING_PUBLIC, 'privacy.html'))).toBe(true);
    expect(existsSync(join(LANDING_PUBLIC, 'terms.html'))).toBe(true);
    const privacy = readFileSync(join(LANDING_PUBLIC, 'privacy.html'), 'utf8');
    const terms = readFileSync(join(LANDING_PUBLIC, 'terms.html'), 'utf8');
    expect(privacy).toMatch(/AES-256-GCM/);
    expect(privacy).toMatch(/key rotation|KMS/i);
    expect(privacy).toMatch(/90 days/);
    expect(privacy).toMatch(/30 days/);
    expect(privacy).toMatch(/ClamAV|antivirus/i);
    expect(privacy).toMatch(/skin.*bill.*prescription.*mark.*lab.*other/is);
    expect(privacy).toMatch(/canonical.*app\.trytouche\.com\/privacy/);
    expect(terms).toMatch(/canonical.*app\.trytouche\.com\/terms/);
    expect(terms).toMatch(/not.*diagnos/i);
  });

  it('in-app consent opens app.trytouche.com/privacy', () => {
    const consent = readFileSync(join(APP, 'app/profile/consent-privacy.tsx'), 'utf8');
    const capture = readFileSync(join(APP, 'app/capture/consent.tsx'), 'utf8');
    expect(consent).toMatch(/https:\/\/app\.trytouche\.com\/privacy/);
    expect(capture).toMatch(/https:\/\/app\.trytouche\.com\/privacy/);
    expect(consent).not.toMatch(/myskinandcare\.com\/patients\/legal/);
  });
});

describe('Phase E — marketing matches Welcome', () => {
  it('landing content uses Touche medical journal positioning', () => {
    const landing = readFileSync(join(LANDING_CONTENT, 'landingContent.js'), 'utf8');
    expect(landing).toMatch(/Touche/);
    expect(landing).toMatch(/Be Bold/);
    expect(landing).toMatch(/Skincare &/);
    expect(landing).toMatch(/medical/);
    expect(landing).toMatch(/journal/i);
    expect(landing).toMatch(/20 AI reads free each month/);
    expect(landing).not.toMatch(/Acne & Skin Photo Diary/);
    expect(landing).toMatch(/app\.trytouche\.com\/privacy/);
  });

  it('Welcome screen still tells the same story', () => {
    const welcome = readFileSync(join(APP, 'app/welcome.tsx'), 'utf8');
    expect(welcome).toMatch(/WELCOME_BRAND = 'touche'/);
    expect(welcome).toMatch(/WELCOME_TAGLINE = 'Be Bold'/);
    expect(welcome).toMatch(/WELCOME_SUBTITLE = 'Skincare & medical journal'/);
    expect(welcome).toMatch(/Medical Tracker/);
    expect(welcome).toMatch(/20 AI reads free each month/);
    expect(welcome).toMatch(/skin, your prescriptions, your bills/);
  });
});

describe('Phase E — try-* funnel noindex decision', () => {
  it('wires useTryFunnelNoIndex on verdict, allergens, reveal, handoff', () => {
    for (const file of [
      'app/try-verdict.tsx',
      'app/try-allergens.tsx',
      'app/try-reveal.tsx',
      'app/try-handoff.tsx',
    ]) {
      const src = readFileSync(join(APP, file), 'utf8');
      expect(src).toMatch(/useTryFunnelNoIndex/);
    }
    const helper = readFileSync(join(APP, 'lib/try-funnel-noindex.ts'), 'utf8');
    expect(helper).toMatch(/noindex/);
  });
});

describe('Phase E — SEO assets + domain redirect config', () => {
  it('has robots.txt and sitemap.xml', () => {
    const robots = readFileSync(join(LANDING_PUBLIC, 'robots.txt'), 'utf8');
    const sitemap = readFileSync(join(LANDING_PUBLIC, 'sitemap.xml'), 'utf8');
    expect(robots).toMatch(/Sitemap: https:\/\/trytouche\.com\/sitemap\.xml/);
    expect(robots).toMatch(/Disallow: \/try-verdict/);
    expect(sitemap).toMatch(/app\.trytouche\.com\/privacy/);
    expect(sitemap).toMatch(/https:\/\/trytouche\.com\/</);
  });

  it('myskinandcare Firebase hosting 301s to trytouche / app legal', () => {
    const cfg = read('unified-dashboard/firebase.consumer.json');
    expect(cfg).toMatch(/"site": "myskinandcare"/);
    expect(cfg).toMatch(/https:\/\/trytouche\.com/);
    expect(cfg).toMatch(/https:\/\/app\.trytouche\.com\/privacy/);
    expect(cfg).toMatch(/"type": 301/);
  });

  it('App Store runbook points at Touche + app.trytouche.com/privacy', () => {
    const doc = read('docs/runbooks/APP_STORE_SUBMISSION.md');
    expect(doc).toMatch(/^\*\*App:\*\* Touche/m);
    expect(doc).toMatch(/https:\/\/app\.trytouche\.com\/privacy/);
    expect(doc).toMatch(/Skincare & medical journal/);
    expect(doc).not.toMatch(/Acne & Skin Photo Diary/);
  });
});
