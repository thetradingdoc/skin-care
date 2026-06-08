#!/usr/bin/env node
'use strict';

/**
 * HTTP brand audit for consumer hosts (no browser).
 * Usage: node scripts/check-live-consumer-hosts.cjs
 */

const HOSTS = [
  'https://myskinandcare.com',
  'https://www.myskinandcare.com',
  'https://callsomo.com',
  'https://www.callsomo.com',
];

const SOMO_MARKERS = [/Never answer business calls/i, /\bTry for \$0\b/i, /AI Front Desk \| 24\/7 Calls/i];
const SKIN_MARKERS = [/Track today/i, /Facial Age Checker/i, /Skin&Care/i];

async function fetchText(url, { follow = true } = {}) {
  const res = await fetch(url, { redirect: follow ? 'follow' : 'manual' });
  const text = res.status < 400 ? await res.text() : '';
  const location = res.headers.get('location') || '';
  return { status: res.status, url: res.url, location, text, redirected: res.redirected };
}

function fail(msg) {
  console.error(`FAIL ${msg}`);
  return false;
}

function pass(msg) {
  console.log(`PASS ${msg}`);
  return true;
}

async function auditHost(base) {
  console.log(`\n== ${base}`);
  let ok = true;

  if (base.includes('www.myskinandcare.com')) {
    const probe = await fetchText(`${base}/`, { follow: false });
    if (probe.status >= 300 && probe.status < 400) {
      const loc = probe.location || probe.url;
      if (loc && /myskinandcare\.com/i.test(loc) && !/www\./i.test(loc)) {
        return pass(`GET / redirects to apex (${probe.status} → ${loc})`);
      }
    }
  }

  const home = await fetchText(`${base}/`);
  if (home.status >= 400) ok = fail(`GET / status=${home.status}`) && ok;
  const hasSkin = SKIN_MARKERS.some((re) => re.test(home.text));
  const hasSomo = SOMO_MARKERS.some((re) => re.test(home.text));
  if (!hasSkin) ok = fail(`GET / missing Skin & Care hero`) && ok;
  else ok = pass(`GET / Skin & Care hero`) && ok;
  if (hasSomo) ok = fail(`GET / still shows legacy Somo B2B copy`) && ok;
  else ok = pass(`GET / no Somo B2B copy`) && ok;

  for (const path of ['/scan', '/about.html', '/contact.html']) {
    const r = await fetchText(`${base}${path}`);
    if (r.status >= 400) ok = fail(`${path} status=${r.status}`) && ok;
    else if (SOMO_MARKERS.some((re) => re.test(r.text))) ok = fail(`${path} has Somo copy`) && ok;
    else ok = pass(`${path} status=${r.status}`) && ok;
  }
  return ok;
}

async function main() {
  console.log('\nLive consumer host audit\n');
  let all = true;
  for (const host of HOSTS) {
    all = (await auditHost(host)) && all;
  }
  console.log('');
  process.exit(all ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
