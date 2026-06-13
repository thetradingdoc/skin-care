#!/usr/bin/env node
'use strict';

/**
 * Generate 1200×630 og-image.jpg for social sharing.
 * Usage: node scripts/generate-og-image.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SHARP_PATH = path.join(ROOT, 'middleware-platform', 'node_modules', 'sharp');
const OUT = path.join(ROOT, 'unified-dashboard', 'skin-care-landing', 'public', 'og-image.jpg');
const TULIP = path.join(ROOT, 'unified-dashboard', 'assets', 'brand', 'tulip-mark.png');

const WIDTH = 1200;
const HEIGHT = 630;

async function main() {
  if (!fs.existsSync(SHARP_PATH)) {
    console.error('sharp not found — run npm ci in middleware-platform first');
    process.exit(1);
  }
  if (!fs.existsSync(TULIP)) {
    console.error(`missing tulip mark: ${TULIP}`);
    process.exit(1);
  }

  const sharp = require(SHARP_PATH);

  const tulipWidth = 420;
  const tulip = await sharp(TULIP).resize({ width: tulipWidth }).png().toBuffer();

  const titleSvg = `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <text x="600" y="380" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="700" fill="#000000">MySkin&amp;Care</text>
      <text x="600" y="460" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="400" fill="#333333">The #1 Skincare Journal</text>
    </svg>
  `;

  const base = await sharp(Buffer.from(titleSvg)).png().toBuffer();
  const tulipMeta = await sharp(tulip).metadata();
  const tulipTop = Math.round(HEIGHT * 0.12);
  const tulipLeft = Math.round((WIDTH - tulipMeta.width) / 2);

  await sharp(base)
    .composite([{ input: tulip, top: tulipTop, left: tulipLeft }])
    .jpeg({ quality: 90 })
    .toFile(OUT);

  console.log(`✅ Wrote ${OUT} (${WIDTH}×${HEIGHT})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
