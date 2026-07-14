#!/usr/bin/env node
/**
 * Static server for hosting-dist-consumer (landing + /app Expo SPA + patients stub).
 * Proxies /api/* and /health/* to local middleware when API_PROXY_TARGET is set (default in local dev).
 *
 * Usage:
 *   node scripts/serve-consumer-hosting.cjs [distDir] [port]
 *   API_PROXY_TARGET=http://127.0.0.1:4000 node scripts/serve-consumer-hosting.cjs
 *
 * Set API_PROXY_TARGET= (empty) to disable proxy (production-like static only).
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const root = path.resolve(
  process.argv[2] || path.join(__dirname, '../../unified-dashboard/hosting-dist-consumer')
);
const port = Number(process.argv[3] || process.env.PW_CONSUMER_PORT || 5190, 10);
const proxyTargetRaw = process.env.API_PROXY_TARGET;
const proxyEnabled = Boolean(proxyTargetRaw && String(proxyTargetRaw).trim());
const API_PROXY_TARGET = (proxyTargetRaw || 'http://127.0.0.1:4000').replace(/\/$/, '');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

const PROXY_PREFIXES = ['/api', '/health', '/waitlist'];

function shouldProxy(urlPath) {
  return PROXY_PREFIXES.some((p) => urlPath === p || urlPath.startsWith(`${p}/`));
}

function safeJoin(base, rel) {
  const baseR = path.resolve(base);
  const target = path.resolve(path.join(baseR, rel));
  if (!target.startsWith(baseR + path.sep) && target !== baseR) return null;
  return target;
}

function trySend(file, res) {
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
  return true;
}

function proxyToApi(req, res) {
  const target = new URL(req.url || '/', `${API_PROXY_TARGET}/`);
  const lib = target.protocol === 'https:' ? https : http;
  const headers = { ...req.headers, host: target.host };

  const proxyReq = lib.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err) => {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(
      `API proxy error: ${err.message}\n` +
        `Start middleware: cd middleware-platform && DB_PATH=./middleware-dev.db npm run dev\n` +
        `Proxy target: ${API_PROXY_TARGET}`
    );
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

  if (proxyEnabled && shouldProxy(urlPath)) {
    proxyToApi(req, res);
    return;
  }

  // Expo web entry is /app (baseUrl). /app/index is not a valid client route — redirect.
  if (urlPath === '/app/index' || urlPath === '/app/index.html') {
    res.writeHead(302, { Location: '/app', 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  const relPath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');

  if (trySend(safeJoin(root, relPath), res)) return;

  // Directory-style /app or /app/foo with no static file → SPA shell (Expo router).
  if (urlPath === '/app' || urlPath === '/app/' || urlPath.startsWith('/app/')) {
    if (trySend(safeJoin(root, 'app/index.html'), res)) return;
  }

  if (trySend(safeJoin(root, 'index.html'), res)) return;

  res.statusCode = 404;
  res.end('Not found');
});

server.listen(port, '127.0.0.1', () => {
  const proxyNote = proxyEnabled ? ` api→${API_PROXY_TARGET}` : ' (no API proxy)';
  process.stdout.write(`serve-consumer-hosting ${root} http://127.0.0.1:${port}${proxyNote}\n`);
});
