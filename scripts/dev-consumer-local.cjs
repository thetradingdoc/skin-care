#!/usr/bin/env node
'use strict';

/**
 * Build local consumer bundle + serve on :5194 with /api proxy → middleware :4000.
 *
 * Prerequisite (separate terminal):
 *   cd middleware-platform && DB_PATH=./middleware-dev.db npm run dev
 *
 * Usage: npm run dev:consumer-local
 */

const { spawnSync, spawn } = require('child_process');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'unified-dashboard', 'hosting-dist-consumer-local');
const PORT = Number(process.env.CONSUMER_LOCAL_PORT || '5194', 10);
const API_TARGET = (process.env.API_PROXY_TARGET || 'http://127.0.0.1:4000').replace(/\/$/, '');
const SERVE_SCRIPT = path.join(ROOT, 'middleware-platform', 'scripts', 'serve-consumer-hosting.cjs');

function checkMiddleware() {
  return new Promise((resolve) => {
    const url = new URL('/health/live', `${API_TARGET}/`);
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  if (process.env.SKIP_CONSUMER_LOCAL_BUILD !== '1') {
    console.log('==> Building local consumer hosting (relative /api)…');
    const build = spawnSync(process.execPath, [path.join(__dirname, 'build-consumer-hosting-local.cjs')], {
      stdio: 'inherit',
      cwd: ROOT,
    });
    if (build.status !== 0) process.exit(build.status || 1);
  }

  const apiUp = await checkMiddleware();
  if (!apiUp) {
    console.warn(
      `\n⚠️  Middleware not reachable at ${API_TARGET}\n` +
        '   Start in another terminal:\n' +
        '   cd middleware-platform && DB_PATH=./middleware-dev.db npm run dev\n'
    );
  } else {
    console.log(`✅ Middleware healthy at ${API_TARGET}`);
  }

  console.log(`\n==> Serving ${DIST}`);
  console.log(`    App:  http://127.0.0.1:${PORT}/app/sign-in`);
  console.log(`    API:  proxied /api → ${API_TARGET}\n`);

  const child = spawn(
    process.execPath,
    [SERVE_SCRIPT, DIST, String(PORT)],
    {
      stdio: 'inherit',
      env: { ...process.env, API_PROXY_TARGET: API_TARGET },
      cwd: ROOT,
    }
  );
  child.on('exit', (code) => process.exit(code || 0));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
