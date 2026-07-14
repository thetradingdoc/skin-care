/**
 * `experiments.baseUrl` is for web static hosting under /app only.
 * Shipping it into native EAS embeds inlines EXPO_BASE_URL="/app" into the
 * Hermes bundle and prefixes every production route (appendBaseUrl) — a known
 * Expo footgun that must not apply to iOS/Android binaries.
 */
const appJson = require('./app.json');

function isWebBuild() {
  if (process.env.EAS_BUILD_PLATFORM === 'web') return true;
  if (process.env.EXPO_OS === 'web') return true;
  const args = process.argv.join(' ');
  if (/\b(--platform|-p)\s+web\b/.test(args) || args.includes('platform web')) return true;
  if (process.env.EXPO_PUBLIC_FORCE_BASE_URL === '1') return true;
  return false;
}

module.exports = () => {
  const expo = structuredClone(appJson.expo);
  expo.experiments = { ...(expo.experiments || {}) };
  if (isWebBuild()) {
    expo.experiments.baseUrl = '/app';
  } else {
    delete expo.experiments.baseUrl;
  }
  return { expo };
};
