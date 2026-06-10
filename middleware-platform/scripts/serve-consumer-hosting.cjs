#!/usr/bin/env node
/**
 * Static server for hosting-dist-consumer (landing + /app Expo SPA + patients stub).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(
  process.argv[2] || path.join(__dirname, '../../unified-dashboard/hosting-dist-consumer')
);
const port = Number(process.argv[3] || process.env.PW_CONSUMER_PORT || 5190, 10);

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

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const relPath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');

  if (trySend(safeJoin(root, relPath), res)) return;

  if (urlPath.startsWith('/app/')) {
    if (trySend(safeJoin(root, 'app/index.html'), res)) return;
  }

  if (trySend(safeJoin(root, 'index.html'), res)) return;

  res.statusCode = 404;
  res.end('Not found');
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`serve-consumer-hosting ${root} http://127.0.0.1:${port}\n`);
});
