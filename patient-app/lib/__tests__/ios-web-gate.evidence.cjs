'use strict';

/**
 * TOUCH-027 evidence — iOS vs Android/desktop branches.
 * Run: node lib/__tests__/ios-web-gate.evidence.cjs
 */

const assert = require('assert');

function isIosWebClientFromUa(ua, platformOs = 'web') {
  if (platformOs !== 'web') return false;
  const lower = String(ua || '').toLowerCase();
  const isIphone = /iphone/.test(lower);
  const isIpad = /ipad/.test(lower);
  if (!isIphone && !isIpad) return false;
  return /applewebkit/.test(lower);
}

const cases = [
  {
    name: 'iPhone Safari',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    expect: true,
  },
  {
    name: 'iPad Safari',
    ua: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    expect: true,
  },
  {
    name: 'Android Chrome',
    ua: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    expect: false,
  },
  {
    name: 'Desktop Chrome macOS',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    expect: false,
  },
  {
    name: 'Desktop Firefox Windows',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    expect: false,
  },
];

for (const c of cases) {
  const got = isIosWebClientFromUa(c.ua);
  assert.strictEqual(got, c.expect, `${c.name}: expected ${c.expect} got ${got}`);
  console.log(`PASS ${c.name} → ${got}`);
}

console.log('TOUCH-027 EVIDENCE: PASS');
