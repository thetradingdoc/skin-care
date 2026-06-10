/**
 * Shared API base for provider portal pages on split-domain staging.
 * config.js sets window.API_BASE on consumer hosts → api.callsomo.com
 */
(function (global) {
  const PROD_API =
    (typeof global.__SKIN_CARE_API_BASE__ === 'string' && global.__SKIN_CARE_API_BASE__.trim()) ||
    'https://api.callsomo.com';

  function resolveApiBase() {
    if (global.API_BASE) return String(global.API_BASE).replace(/\/$/, '');
    const host = (global.location?.hostname || '').toLowerCase();
    // callsomo.com hosts included: same Firebase project serves provider portal + legacy staging.
    if (
      host === 'myskinandcare.com' ||
      host === 'www.myskinandcare.com' ||
      host === 'skinandcare.com' ||
      host === 'www.skinandcare.com' ||
      host === 'callsomo.com' ||
      host === 'www.callsomo.com' ||
      host.endsWith('.callsomo.com')
    ) {
      return PROD_API;
    }
    return (global.location?.origin || 'http://localhost:4000').replace(/\/$/, '');
  }
  global.resolveApiBase = resolveApiBase;
})(typeof window !== 'undefined' ? window : global);
