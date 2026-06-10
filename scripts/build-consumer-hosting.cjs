#!/usr/bin/env node
'use strict';

/**
 * Assemble Firebase Hosting bundle for myskinandcare.com (consumer only).
 *   - Skin & Care landing SPA (/)
 *   - Marketing static pages (about, contact)
 *   - Patient legal + login redirect shell
 *   - Expo web patient app (/app)
 *   - Unified-dashboard assets
 *
 * Usage: node scripts/build-consumer-hosting.cjs
 * Output: unified-dashboard/hosting-dist-consumer/
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const UD = path.join(ROOT, 'unified-dashboard');
const LANDING = path.join(UD, 'skin-care-landing');
const PATIENT_APP = path.join(ROOT, 'patient-app');
const OUT = path.join(UD, 'hosting-dist-consumer');

const API_BASE = (process.env.VITE_API_BASE || 'https://api.callsomo.com').replace(/\/$/, '');

const TULIP_FAVICON_LINKS = `  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
  <link rel="icon" type="image/svg+xml" href="/assets/images/favicon.svg" />
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/images/favicon-32x32.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />`;

function walkHtmlFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtmlFiles(p, out);
    else if (entry.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function patchExpoFaviconHtml(html) {
  let next = html.replace(/<link rel="icon" href="\/app\/favicon\.ico" \/>/g, '');
  if (!next.includes('/favicon.svg')) {
    next = next.replace('</head>', `${TULIP_FAVICON_LINKS}\n</head>`);
  }
  return next;
}

function writeTulipFaviconIco(outDir) {
  const png32 = path.join(outDir, 'favicon-32x32.png');
  if (!fs.existsSync(png32)) {
    console.warn('  skip favicon.ico — missing favicon-32x32.png in bundle');
    return;
  }
  const targets = [path.join(outDir, 'favicon.ico'), path.join(outDir, 'app', 'favicon.ico')];
  let wroteIco = false;
  try {
    const tmpIco = path.join(outDir, '.favicon-tulip.ico');
    spawnSync('magick', [png32, tmpIco], { stdio: 'ignore' });
    if (fs.existsSync(tmpIco)) {
      for (const t of targets) copyFile(tmpIco, t);
      fs.unlinkSync(tmpIco);
      wroteIco = true;
    }
  } catch {
    /* magick unavailable */
  }
  if (!wroteIco) {
    try {
      spawnSync('convert', [png32, targets[0]], { stdio: 'ignore' });
      if (fs.existsSync(targets[0])) {
        copyFile(targets[0], targets[1]);
        wroteIco = true;
      }
    } catch {
      /* convert unavailable */
    }
  }
  if (!wroteIco) {
    for (const t of targets) copyFile(png32, t);
    console.warn('  favicon.ico copied from PNG (install ImageMagick for true .ico)');
  } else {
    console.log('  tulip favicon.ico written');
  }
}

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  mkdirp(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest, { merge = false } = {}) {
  if (!fs.existsSync(src)) {
    console.warn(`  skip missing: ${src}`);
    return;
  }
  if (!merge && fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  mkdirp(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d, { merge: true });
    } else if (!fs.existsSync(d)) {
      copyFile(s, d);
    } else if (merge) {
      /* keep existing */
    } else {
      copyFile(s, d);
    }
  }
}

function main() {
  console.log(`Building skin-care-landing (VITE_API_BASE=${API_BASE})…`);
  const env = { ...process.env, VITE_API_BASE: API_BASE };
  const install = spawnSync('npm', ['ci'], {
    cwd: LANDING,
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  if (install.status !== 0) process.exit(install.status || 1);
  const build = spawnSync('npm', ['run', 'build'], {
    cwd: LANDING,
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  if (build.status !== 0) process.exit(build.status || 1);

  console.log('Building Expo web patient app…');
  const patientEnv = {
    ...process.env,
    EXPO_PUBLIC_API_BASE_URL: API_BASE,
    EXPO_PUBLIC_WEB_SIGNUP_URL: 'https://myskinandcare.com/scan',
  };
  const patientInstall = spawnSync('npm', ['ci'], {
    cwd: PATIENT_APP,
    stdio: 'inherit',
    env: patientEnv,
    shell: process.platform === 'win32',
  });
  if (patientInstall.status !== 0) process.exit(patientInstall.status || 1);
  const patientExport = spawnSync(
    'npx',
    ['expo', 'export', '--platform', 'web'],
    {
      cwd: PATIENT_APP,
      stdio: 'inherit',
      env: patientEnv,
      shell: process.platform === 'win32',
    }
  );
  if (patientExport.status !== 0) process.exit(patientExport.status || 1);

  console.log('Assembling hosting-dist-consumer…');
  rmrf(OUT);
  mkdirp(OUT);

  copyDir(path.join(LANDING, 'build'), OUT);
  copyDir(path.join(UD, 'assets'), path.join(OUT, 'assets'));
  copyDir(path.join(LANDING, 'build', 'assets'), path.join(OUT, 'assets'), { merge: true });

  for (const page of ['about.html', 'contact.html', 'waitlist.html']) {
    const src = path.join(UD, page);
    if (fs.existsSync(src)) copyFile(src, path.join(OUT, page));
  }

  copyDir(path.join(UD, 'patients', 'legal'), path.join(OUT, 'patients', 'legal'));
  const patientLogin = path.join(UD, 'patients', 'patient-login.html');
  if (fs.existsSync(patientLogin)) {
    copyFile(patientLogin, path.join(OUT, 'patients', 'patient-login.html'));
  }

  if (fs.existsSync(path.join(UD, 'manifest.webmanifest'))) {
    copyFile(path.join(UD, 'manifest.webmanifest'), path.join(OUT, 'manifest.webmanifest'));
  }

  const expoDist = path.join(PATIENT_APP, 'dist');
  if (!fs.existsSync(path.join(expoDist, 'index.html'))) {
    console.error(`Missing ${expoDist}/index.html — expo export failed`);
    process.exit(1);
  }
  copyDir(expoDist, path.join(OUT, 'app'));

  const logoCss = path.join(OUT, 'assets', 'css', 'logo-wordmark.css');
  if (!fs.existsSync(logoCss)) {
    console.error(`Missing ${logoCss} — ensure unified-dashboard/assets/css/logo-wordmark.css is in bundle`);
    process.exit(1);
  }

  for (const htmlFile of walkHtmlFiles(path.join(OUT, 'app'))) {
    let html = fs.readFileSync(htmlFile, 'utf8');
    html = patchExpoFaviconHtml(html);
    if (htmlFile.endsWith(`${path.sep}index.html`) && !html.includes('logo-wordmark.css')) {
      html = html.replace(
        '</head>',
        '  <link rel="stylesheet" href="/assets/css/logo-wordmark.css" />\n</head>'
      );
    }
    fs.writeFileSync(htmlFile, html);
  }

  const faviconSvg = path.join(UD, 'assets', 'images', 'favicon.svg');
  if (fs.existsSync(faviconSvg)) {
    copyFile(faviconSvg, path.join(OUT, 'app', 'favicon.svg'));
  }

  writeTulipFaviconIco(OUT);

  console.log(`\n✅ Consumer hosting bundle: ${OUT}`);
  console.log('   Verify: npm run verify:consumer-hosting');
  console.log('   Deploy: npm run deploy:consumer-hosting');
}

main();
