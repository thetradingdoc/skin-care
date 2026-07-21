#!/usr/bin/env node
/**
 * Static gate: no in-app checkout chrome on iOS build targets.
 *
 * Fails if patient-app sources (outside allowlist) contain:
 *   - openAuthSessionAsync(
 *   - react-native-webview / <WebView
 *   - @stripe/stripe-react-native / PaymentSheet / CardField / StripeProvider
 *
 * Allowlisted files may import expo-web-browser for *external* openBrowserAsync
 * (Shopify handoff, generic external links) but still may NOT use AuthSession.
 *
 * Usage: node scripts/check-ios-no-inapp-checkout.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_ROOT = path.join(ROOT, 'patient-app');

/** Paths relative to repo root — may import expo-web-browser for openBrowserAsync only. */
const ALLOW_EXPO_WEBBROWSER_IMPORT = new Set([
  'patient-app/components/external-link.tsx',
  'patient-app/app/checkout-handoff.tsx',
]);

/** Always skipped (tests may assert absence by naming the banned APIs). */
const SKIP_DIRS = new Set(['node_modules', '.expo', 'dist', 'build', 'coverage']);
const SKIP_FILE_RE = /\.(test|spec)\.(ts|tsx|js|jsx)$/;

const BANNED = [
  { id: 'openAuthSessionAsync', re: /openAuthSessionAsync\s*\(/ },
  { id: 'react-native-webview', re: /from\s+['"]react-native-webview['"]|require\(\s*['"]react-native-webview['"]\s*\)/ },
  { id: 'WebView_jsx', re: /<\s*WebView\b/ },
  { id: 'stripe-react-native', re: /@stripe\/stripe-react-native/ },
  { id: 'PaymentSheet', re: /\bPaymentSheet\b/ },
  { id: 'CardField', re: /\bCardField\b/ },
  { id: 'StripeProvider', re: /\bStripeProvider\b/ },
];

const EXPO_WEBBROWSER_IMPORT =
  /from\s+['"]expo-web-browser['"]|require\(\s*['"]expo-web-browser['"]\s*\)|\*\s+as\s+WebBrowser\s+from\s+['"]expo-web-browser['"]/;

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(ent.name) && !SKIP_FILE_RE.test(ent.name)) out.push(full);
  }
  return out;
}

/** Strip block + line comments so docstrings naming banned APIs do not fail the gate. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function main() {
  const files = walk(SCAN_ROOT);
  const errors = [];

  for (const f of files) {
    const r = rel(f);
    let raw = '';
    try {
      raw = fs.readFileSync(f, 'utf8');
    } catch (e) {
      errors.push(`${r}: read failed (${e.message})`);
      continue;
    }
    const text = stripComments(raw);

    for (const ban of BANNED) {
      if (ban.re.test(text)) {
        errors.push(`${r}: banned ${ban.id}`);
      }
    }

    if (EXPO_WEBBROWSER_IMPORT.test(text) && !ALLOW_EXPO_WEBBROWSER_IMPORT.has(r)) {
      errors.push(
        `${r}: expo-web-browser import not allowlisted (use Linking.openURL / billing-platform-checkout)`,
      );
    }
  }

  if (errors.length) {
    console.error('[check-ios-no-inapp-checkout] FAIL');
    for (const e of errors) console.error('  -', e);
    console.error(
      `\nAllowlist (expo-web-browser openBrowserAsync only):\n${[...ALLOW_EXPO_WEBBROWSER_IMPORT].map((x) => `  ${x}`).join('\n')}`,
    );
    process.exit(1);
  }

  console.log(
    `[check-ios-no-inapp-checkout] OK — scanned ${files.length} files under patient-app (AuthSession/WebView/Stripe Elements banned)`,
  );
}

main();
