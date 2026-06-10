#!/usr/bin/env node
/**
 * Design audit: compare live landing vs mockup spec.
 * Usage: node scripts/playwright-landing-design-audit.mjs
 */
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BUILD = path.join(ROOT, 'unified-dashboard/skin-care-landing/build');
const SERVE = path.join(ROOT, 'middleware-platform/scripts/serve-cra-build.cjs');
const PORT = Number(process.env.PW_AUDIT_PORT || 5202);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const OUT = path.join(ROOT, '.cursor/landing-design-audit.json');

const MOCKUP = {
  pageBg: ['#f5f5f0', '#f2f0ed', '#e8e2d9', '#e5e0d8'],
  ink: '#1a1a1a',
  headline: 'Track today.',
  headlineLine2: 'Glow tomorrow.',
  subtitle:
    'Your personal skincare tracker to understand your skin, build better habits, and see real results over time.',
  cta: 'Facial Age Checker',
  tagline: 'TRACK. CARE. GLOW.',
  brandName: 'Skin&Care',
  navLinks: ['How It Works', 'About', 'Contact'],
  features: ['Face scan → skin age', 'Tell us what to track', 'One photo a day'],
  footerLinks: ['Privacy', 'Terms', 'Sign in'],
  footerTagline: 'Track today. Glow tomorrow.',
};

function hex(rgb) {
  if (!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return rgb;
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return rgb;
  return (
    '#' +
    [m[1], m[2], m[3]]
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .join('')
  );
}

function dist(a, b) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const dr = ((pa >> 16) & 255) - ((pb >> 16) & 255);
  const dg = ((pa >> 8) & 255) - ((pb >> 8) & 255);
  const db = (pa & 255) - (pb & 255);
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function closestMockupBg(hexColor) {
  let best = MOCKUP.pageBg[0];
  let bestD = Infinity;
  for (const c of MOCKUP.pageBg) {
    const d = dist(hexColor, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return { closest: best, delta: Math.round(bestD) };
}

async function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [SERVE, BUILD, String(PORT)], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    const timer = setTimeout(() => reject(new Error('Server timeout')), 30000);
    child.stdout.on('data', (d) => {
      out += d;
      if (out.includes('serve-cra-build') || out.includes('Serving')) {
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.stderr.on('data', (d) => {
      out += d;
    });
    child.on('error', reject);
  });
}

async function audit() {
  if (!fs.existsSync(BUILD)) {
    console.error('Missing build. Run: cd unified-dashboard/skin-care-landing && npm run build');
    process.exit(1);
  }

  const server = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const issues = [];

  try {
    await page.goto(ORIGIN + '/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(ROOT, '.cursor/landing-audit-screenshot.png'), fullPage: true });

    const data = await page.evaluate(() => {
      const pick = (sel) => document.querySelector(sel);
      const style = (el) => (el ? getComputedStyle(el) : null);
      const box = (el) => (el ? el.getBoundingClientRect() : null);

      const body = pick('body');
      const header = pick('.sc-site-header');
      const headline = pick('.sc-hero-headline');
      const sub = pick('.sc-hero-split-sub');
      const cta = pick('.sc-hero-cta');
      const photo = pick('.sc-hero-photo');
      const grid = pick('.sc-hero-split-grid');
      const copy = pick('.sc-hero-split-copy');
      const features = pick('.sc-hero-features');
      const footer = pick('.sc-footer');
      const favicon = document.querySelector('link[rel="icon"]')?.getAttribute('href');

      return {
        favicon,
        title: document.title,
        bodyBg: style(body)?.backgroundColor,
        headerBg: style(header)?.backgroundColor,
        headerBorder: style(header)?.borderBottom,
        headlineText: headline?.innerText?.replace(/\s+/g, ' ').trim(),
        headlineFont: style(headline)?.fontFamily,
        headlineSize: style(headline)?.fontSize,
        headlineWeight: style(headline)?.fontWeight,
        headlineItalic: style(headline?.querySelector('em'))?.fontStyle,
        subText: sub?.innerText?.trim(),
        subColor: style(sub)?.color,
        subSize: style(sub)?.fontSize,
        subLineHeight: style(sub)?.lineHeight,
        ctaText: cta?.innerText?.replace(/\s+/g, ' ').trim(),
        ctaBg: style(cta)?.backgroundColor,
        ctaRadius: style(cta)?.borderRadius,
        ctaColor: style(cta)?.color,
        brandName: pick('.sc-brand-name')?.innerText,
        tagline: pick('.sc-brand-tagline')?.innerText,
        taglineTransform: style(pick('.sc-brand-tagline'))?.textTransform,
        taglineLetterSpacing: style(pick('.sc-brand-tagline'))?.letterSpacing,
        navLinks: [...document.querySelectorAll('.sc-site-nav-link')].map((a) => a.textContent.trim()),
        storeBadges: [...document.querySelectorAll('.sc-store-badge-img')].map((el) => ({
          alt: el.getAttribute('alt'),
          opacity: style(el)?.opacity,
          naturalWidth: el.naturalWidth,
        })),
        copyWidth: box(pick('.sc-hero-split-inner'))?.width,
        photoWidth: box(photo)?.width,
        photoHeight: box(photo)?.height,
        photoObjectFit: style(photo)?.objectPosition,
        headerHeight: box(header)?.height,
        photoTop: box(photo)?.top,
        featuresTop: box(features)?.top,
        featuresMaxWidth: style(pick('.sc-hero-features-inner'))?.maxWidth,
        featureTitles: [...document.querySelectorAll('.sc-hero-feature-title')].map((el) => el.textContent.trim()),
        featureBodies: [...document.querySelectorAll('.sc-hero-feature-body')].map((el) => el.textContent.trim()),
        footerText: footer?.innerText,
        footerAlign: style(pick('.sc-footer-inner'))?.textAlign,
        copyright: pick('.sc-footer-copy')?.innerText,
        doveSvg: pick('.sc-brand-dove')?.tagName?.toLowerCase() === 'svg' || !!pick('.sc-brand-dove svg'),
        dovePaths: [...document.querySelectorAll('.sc-brand-dove path')].length,
        heroImgSrc: photo?.getAttribute('src'),
        heroImgNatural: photo ? { w: photo.naturalWidth, h: photo.naturalHeight } : null,
        missingAnchors: ['#how', '#blog'].filter((id) => !document.querySelector(id)),
      };
    });

    const bodyHex = hex(data.bodyBg);
    const bgMatch = closestMockupBg(bodyHex);
    if (bgMatch.delta > 12) {
      issues.push({
        area: 'Color',
        issue: `Page background ${bodyHex} differs from mockup palette (closest ${bgMatch.closest}, Δ${bgMatch.delta})`,
        mockup: MOCKUP.pageBg.join(' / '),
        actual: bodyHex,
      });
    }

    if (data.headerBorder && !data.headerBorder.includes('0px')) {
      issues.push({
        area: 'Header',
        issue: 'Header has visible bottom border; mockup is seamless with hero background',
        mockup: 'No divider line under nav',
        actual: data.headerBorder,
      });
    }

    if (data.tagline !== 'TRACK. CARE. GLOW.' && data.tagline?.toUpperCase() !== 'TRACK. CARE. GLOW.') {
      issues.push({
        area: 'Logo',
        issue: 'Tagline casing/text mismatch',
        mockup: MOCKUP.tagline,
        actual: data.tagline,
      });
    }

    if (!data.doveSvg) {
      issues.push({ area: 'Logo', issue: 'Dove SVG not rendered inline in header', mockup: 'Thin line-art dove mark', actual: 'missing' });
    }

    if (data.headlineText !== 'Track today. Glow tomorrow.') {
      issues.push({ area: 'Hero copy', issue: 'Headline text mismatch', mockup: 'Track today. Glow tomorrow.', actual: data.headlineText });
    }

    if (data.headlineWeight !== '400' && Number(data.headlineWeight) < 500) {
      issues.push({
        area: 'Typography',
        issue: 'Headline weight lighter than mockup (mockup reads bolder/high-contrast serif)',
        mockup: 'Bold or high-contrast serif',
        actual: `font-weight ${data.headlineWeight}`,
      });
    }

    if (data.subText !== MOCKUP.subtitle) {
      issues.push({ area: 'Hero copy', issue: 'Subheadline text mismatch', mockup: MOCKUP.subtitle, actual: data.subText });
    }

    if (!data.ctaText?.includes('Facial Age Checker')) {
      issues.push({ area: 'CTA', issue: 'Primary CTA label mismatch', mockup: MOCKUP.cta, actual: data.ctaText });
    }

    if (hex(data.ctaBg) !== MOCKUP.ink && hex(data.ctaBg) !== '#000000') {
      issues.push({ area: 'CTA', issue: 'CTA button background color off', mockup: MOCKUP.ink, actual: hex(data.ctaBg) });
    }

    if (!data.heroImgNatural || data.heroImgNatural.w === 0) {
      issues.push({
        area: 'Hero image',
        issue: 'Hero image failed to load in static build',
        mockup: 'Portrait photo visible',
        actual: data.heroImgSrc || 'missing',
      });
    }

    for (const badge of data.storeBadges) {
      if (!badge.naturalWidth) {
        issues.push({
          area: 'Store badges',
          issue: 'Store badge image failed to load',
          mockup: 'Official badge graphics',
          actual: badge.alt || 'missing',
        });
      }
      if (Number(badge.opacity) < 0.95) {
        issues.push({
          area: 'Store badges',
          issue: 'Badge rendered at reduced opacity',
          mockup: 'Full-opacity badges',
          actual: String(badge.opacity),
        });
      }
    }

    const photoStartsBelowHeader = data.photoTop > 2;
    if (photoStartsBelowHeader) {
      issues.push({
        area: 'Hero layout',
        issue: 'Hero photo starts below header; mockup photo extends to top/right edge behind nav area',
        mockup: 'Photo occupies right 50% from top of viewport',
        actual: `photo top ${Math.round(data.photoTop)}px, header ${Math.round(data.headerHeight)}px`,
      });
    }

    const leftPct = (data.copyWidth / 1440) * 100;
    if (leftPct < 40) {
      issues.push({
        area: 'Hero layout',
        issue: 'Left copy column narrower than mockup (~50% split with generous padding)',
        mockup: '~50% width left column',
        actual: `${Math.round(leftPct)}% (${Math.round(data.copyWidth)}px)`,
      });
    }

    if (data.heroImgNatural && data.heroImgNatural.w / data.heroImgNatural.h > 1.2) {
      issues.push({
        area: 'Hero image',
        issue: 'Hero asset is landscape; mockup uses portrait-oriented crop with large left negative space',
        mockup: 'Portrait crop, subject right-aligned',
        actual: `${data.heroImgNatural.w}×${data.heroImgNatural.h}`,
      });
    }

    if (JSON.stringify(data.navLinks) !== JSON.stringify(MOCKUP.navLinks)) {
      issues.push({ area: 'Navigation', issue: 'Nav link set mismatch', mockup: MOCKUP.navLinks, actual: data.navLinks });
    }

    for (const id of data.missingAnchors) {
      issues.push({ area: 'Navigation', issue: `Nav target ${id} has no matching section id on page`, mockup: `Section ${id}`, actual: 'missing' });
    }

    if (JSON.stringify(data.featureTitles) !== JSON.stringify(MOCKUP.features)) {
      issues.push({ area: 'Features', issue: 'Feature titles mismatch', mockup: MOCKUP.features, actual: data.featureTitles });
    }

    if (data.footerAlign !== 'center') {
      issues.push({ area: 'Footer', issue: 'Footer alignment mismatch', mockup: 'center', actual: data.footerAlign });
    }

    if (!data.footerText?.includes(MOCKUP.footerTagline)) {
      issues.push({ area: 'Footer', issue: 'Footer tagline mismatch', mockup: MOCKUP.footerTagline, actual: data.footerText });
    }

    if (!data.favicon || !data.favicon.includes('favicon')) {
      issues.push({ area: 'Favicon', issue: 'Favicon link missing or broken in document head', mockup: 'Dove favicon visible in tab', actual: data.favicon || 'none' });
    }

    if (!data.headlineFont?.includes('Gloock')) {
      issues.push({ area: 'Typography', issue: 'Display font may not be loading', mockup: 'Gloock serif', actual: data.headlineFont });
    }

    fs.writeFileSync(OUT, JSON.stringify({ capturedAt: new Date().toISOString(), data, issues }, null, 2));

    console.log('\n=== SKIN&CARE LANDING DESIGN AUDIT ===\n');
    console.log(`Screenshot: .cursor/landing-audit-screenshot.png`);
    console.log(`Report: .cursor/landing-design-audit.json\n`);
    console.log(`Found ${issues.length} issues:\n`);
    issues.forEach((item, i) => {
      console.log(`${i + 1}. [${item.area}] ${item.issue}`);
      console.log(`   Mockup: ${typeof item.mockup === 'object' ? JSON.stringify(item.mockup) : item.mockup}`);
      console.log(`   Actual: ${typeof item.actual === 'object' ? JSON.stringify(item.actual) : item.actual}\n`);
    });
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }
}

audit().catch((err) => {
  console.error(err);
  process.exit(1);
});
