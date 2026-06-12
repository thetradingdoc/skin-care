#!/usr/bin/env node
'use strict';

/**
 * Verify local consumer dev stack: middleware :4000 + static server :5194 + /api proxy.
 *
 * Usage:
 *   npm run verify:local-consumer-dev
 *
 * Prerequisite: middleware running with DB_PATH=./middleware-dev.db
 */

const { spawn, spawnSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'unified-dashboard', 'hosting-dist-consumer-local');
const API_TARGET = (process.env.API_PROXY_TARGET || 'http://127.0.0.1:4000').replace(/\/$/, '');
const PORT = Number(process.env.CONSUMER_LOCAL_PORT || '5194', 10);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SERVE_SCRIPT = path.join(ROOT, 'middleware-platform', 'scripts', 'serve-consumer-hosting.cjs');

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

function fetchUrl(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? require('https') : http;
    const req = lib.request(url, opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () =>
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        })
      );
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function main() {
  console.log('\n==> verify:local-consumer-dev\n');

  if (!fs.existsSync(path.join(DIST, 'app', 'index.html'))) {
    console.log('Building local consumer bundle…');
    const build = spawnSync(process.execPath, [path.join(__dirname, 'build-consumer-hosting-local.cjs')], {
      stdio: 'inherit',
      cwd: ROOT,
    });
    if (build.status !== 0) fail('build-consumer-hosting-local failed');
  }

  const health = await fetchUrl(`${API_TARGET}/health/live`).catch(() => null);
  if (!health || health.status < 200 || health.status >= 300) {
    fail(
      `Middleware not healthy at ${API_TARGET}. Start:\n` +
        '  cd middleware-platform && DB_PATH=./middleware-dev.db npm run dev'
    );
  }
  ok(`Middleware ${API_TARGET}/health/live`);

  const child = spawn(
    process.execPath,
    [SERVE_SCRIPT, DIST, String(PORT)],
    {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, API_PROXY_TARGET: API_TARGET },
    }
  );
  child.unref();

  await new Promise((r) => setTimeout(r, 800));

  try {
    const signIn = await fetchUrl(`${ORIGIN}/app/sign-in`);
    if (signIn.status < 200 || signIn.status >= 400) {
      fail(`/app/sign-in status=${signIn.status}`);
    }
    ok(`Static server ${ORIGIN}/app/sign-in`);

    const preflight = await fetchUrl(`${ORIGIN}/api/patient/verify/send`, {
      method: 'OPTIONS',
      headers: {
        Origin: ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    if (preflight.status !== 204 && preflight.status !== 200) {
      fail(`Preflight via proxy status=${preflight.status} (expected 204)`);
    }
    ok('Same-origin API preflight via proxy (no CORS)');

    const webBundleDir = path.join(DIST, 'app', '_expo', 'static', 'js', 'web');
    const entryFile = fs.existsSync(webBundleDir)
      ? fs.readdirSync(webBundleDir).find((f) => f.startsWith('entry-') && f.endsWith('.js'))
      : null;
    if (entryFile) {
      const bundled = fs.readFileSync(path.join(webBundleDir, entryFile), 'utf8');
      if (bundled.includes('api.callsomo.com')) {
        console.warn('⚠️  Local bundle still references api.callsomo.com — rebuild with build-consumer-hosting-local');
      } else {
        ok('Local bundle does not hardcode production API host');
      }
    }
  } finally {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      try {
        process.kill(child.pid, 'SIGTERM');
      } catch {
        /* ignore */
      }
    }
  }

  console.log('\n✅ verify:local-consumer-dev complete\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
