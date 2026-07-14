#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const TULIP_PATH_FILE = path.join(ROOT, '..', 'unified-dashboard', 'assets', 'brand', 'tulip-path.js');
const OUT_DIR = path.join(ROOT, 'assets', 'images');
const BRAND_ORANGE = '#F7591F';
const BG_WHITE = '#FFFFFF';

function readTulipPath() {
  const src = fs.readFileSync(TULIP_PATH_FILE, 'utf8');
  const match = src.match(/export const TULIP_PATH =\s*\n?\s*'([^']+)'/);
  if (!match) throw new Error(`Could not read TULIP_PATH from ${TULIP_PATH_FILE}`);
  return match[1];
}

function tulipSvg({ size, fill, background, padding = 0.18, viewBox = '0 0 600 215' }) {
  const pathD = readTulipPath();
  const inner = size * (1 - padding * 2);
  const scale = inner / 600;
  const tx = size / 2 - 300 * scale;
  const ty = size / 2 - 107.5 * scale;
  const bg = background
    ? `<rect width="${size}" height="${size}" fill="${background}"/>`
    : '';
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg}
  <g transform="translate(${tx} ${ty}) scale(${scale})">
    <path fill="${fill}" d="${pathD}"/>
  </g>
</svg>`);
}

async function writePng(svg, outPath) {
  await sharp(svg).png().toFile(outPath);
  const meta = await sharp(outPath).metadata();
  console.log(`  wrote ${path.relative(ROOT, outPath)} (${meta.width}x${meta.height})`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Generating touche tulip app icons…');

  await writePng(
    tulipSvg({ size: 1024, fill: BRAND_ORANGE, background: BG_WHITE, padding: 0.2 }),
    path.join(OUT_DIR, 'icon.png')
  );

  await writePng(
    tulipSvg({ size: 512, fill: BRAND_ORANGE, background: BG_WHITE, padding: 0.22 }),
    path.join(OUT_DIR, 'splash-icon.png')
  );

  await writePng(
    tulipSvg({ size: 1024, fill: BRAND_ORANGE, background: null, padding: 0.16 }),
    path.join(OUT_DIR, 'android-icon-foreground.png')
  );

  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: BG_WHITE },
  })
    .png()
    .toFile(path.join(OUT_DIR, 'android-icon-background.png'));
  console.log('  wrote assets/images/android-icon-background.png (1024x1024)');

  await writePng(
    tulipSvg({ size: 1024, fill: '#000000', background: null, padding: 0.16 }),
    path.join(OUT_DIR, 'android-icon-monochrome.png')
  );

  await writePng(
    tulipSvg({ size: 48, fill: BRAND_ORANGE, background: BG_WHITE, padding: 0.15 }),
    path.join(OUT_DIR, 'favicon.png')
  );

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
