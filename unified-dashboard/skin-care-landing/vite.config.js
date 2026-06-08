import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UD_ROOT = path.resolve(__dirname, '..');
const UD_ASSETS = path.join(UD_ROOT, 'assets');
const UD_PATIENTS = path.join(UD_ROOT, 'patients');
const UD_MANIFEST = path.join(UD_ROOT, 'manifest.webmanifest');

function contentTypeForExt(ext) {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.webmanifest': 'application/manifest+json',
  };
  return types[ext] || 'application/octet-stream';
}

function localStaticPlugin(basePath, urlPrefix, logLabel) {
  return {
    name: `local-ud-${logLabel}`,
    configureServer(server) {
      server.middlewares.use(urlPrefix, (req, res, next) => {
        const pathname = decodeURIComponent(String(req.url || '/').split('?')[0]);
        const rel = pathname.replace(/^\//, '');
        const filePath = path.join(basePath, rel);
        if (!filePath.startsWith(basePath) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          return next();
        }
        res.setHeader('Content-Type', contentTypeForExt(path.extname(filePath).toLowerCase()));
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

/** Static HTML pages at unified-dashboard root (about.html, contact.html, …) */
function rootHtmlPlugin() {
  return {
    name: 'local-ud-root-html',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = String(req.url || '').split('?')[0];
        if (!pathname.endsWith('.html') || pathname.includes('..')) {
          return next();
        }
        const filePath = path.join(UD_ROOT, pathname.replace(/^\//, ''));
        if (!filePath.startsWith(UD_ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          return next();
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

/** patient-login.html links to ../manifest.webmanifest → /manifest.webmanifest */
function localManifestPlugin() {
  return {
    name: 'local-ud-manifest',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (String(req.url || '').split('?')[0] !== '/manifest.webmanifest') {
          return next();
        }
        if (!fs.existsSync(UD_MANIFEST)) {
          return next();
        }
        res.setHeader('Content-Type', 'application/manifest+json');
        fs.createReadStream(UD_MANIFEST).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    localStaticPlugin(UD_ASSETS, '/assets', 'assets'),
    localStaticPlugin(UD_PATIENTS, '/patients', 'patients'),
    localManifestPlugin(),
    rootHtmlPlugin(),
  ],
  server: {
    port: 5180,
    strictPort: true,
    fs: {
      allow: [UD_ROOT, UD_ASSETS],
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
      '/waitlist': {
        target: process.env.VITE_API_PROXY || 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
  },
});
