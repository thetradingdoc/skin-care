#!/usr/bin/env node
'use strict';

/**
 * Regenerate favicon PNGs from unified-dashboard/assets/brand/logo-panda.svg.
 * Requires macOS `sips` plus ImageMagick `magick`/`convert` for SVG rasterization.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BRAND = path.join(__dirname, '..', 'unified-dashboard', 'assets', 'brand');
const IMAGES = path.join(__dirname, '..', 'unified-dashboard', 'assets', 'images');
const ICON = path.join(BRAND, 'logo-panda.svg');

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

function has(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function ensureIcon() {
  if (fs.existsSync(ICON)) return;
  const fromImages = path.join(IMAGES, 'logo-panda.svg');
  if (!fs.existsSync(fromImages)) {
    console.error('Missing', ICON, 'and', fromImages);
    process.exit(1);
  }
  fs.mkdirSync(BRAND, { recursive: true });
  fs.copyFileSync(fromImages, ICON);
}

ensureIcon();

if (!has('magick') && !has('convert')) {
  console.error('ImageMagick required to rasterize logo-panda.svg');
  process.exit(1);
}

const raster = path.join(BRAND, 'logo-panda-raster.png');
const rasterCmd = has('magick')
  ? `magick -background none "${ICON}" -resize 512x512 "${raster}"`
  : `convert -background none "${ICON}" -resize 512x512 "${raster}"`;
run(rasterCmd);

if (!has('sips')) {
  console.error('sips not found (macOS). Install ImageMagick or run on macOS.');
  process.exit(1);
}

const sizes = [
  ['favicon-16x16.png', 16],
  ['favicon-32x32.png', 32],
  ['apple-touch-icon.png', 180],
];

for (const [name, px] of sizes) {
  const out = path.join(BRAND, name);
  run(`sips -z ${px} ${px} "${raster}" --out "${out}"`);
}

const fav32 = path.join(BRAND, 'favicon-32x32.png');
const favIco = path.join(BRAND, 'favicon.ico');
if (has('magick')) {
  run(`magick "${fav32}" "${favIco}"`);
} else {
  run(`convert "${fav32}" "${favIco}"`);
}

fs.unlinkSync(raster);
console.log('Brand favicons updated in', BRAND);
