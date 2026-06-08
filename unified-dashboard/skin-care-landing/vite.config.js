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

/** about.html lives at unified-dashboard/about.html */
function aboutHtmlPlugin() {
  const aboutPath = path.join(UD_ROOT, 'about.html');
  return {
    name: 'local-ud-about',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (String(req.url || '').split('?')[0] !== '/about.html') {
          return next();
        }
        if (!fs.existsSync(aboutPath)) {
          return next();
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        fs.createReadStream(aboutPath).pipe(res);
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
    aboutHtmlPlugin(),
  ],
  server: {
    port: 5180,
    strictPort: true,
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
