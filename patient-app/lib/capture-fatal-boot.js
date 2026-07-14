/**
 * Zero-dependency bootstrap — must run before expo-router.
 * Captures JS fatals to production ingest + stashes for later UI, then lets
 * RN proceed (does NOT swallow — swallowing left a black empty root).
 */
(function installBootFatalCapture() {
  if (globalThis.__SKINCARE_FATAL_BOOT__) return;
  globalThis.__SKINCARE_FATAL_BOOT__ = true;

  var INGEST = 'https://api.callsomo.com/api/patient/public/client-fatal';

  function syncPost(payload) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', INGEST, false);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send(JSON.stringify(payload));
    } catch (_e) {
      /* ignore */
    }
  }

  function capture(e, isFatal) {
    var message = '';
    var stack = '';
    try {
      if (e && typeof e === 'object') {
        message = String(e.message || e);
        stack = String(e.stack || '');
      } else {
        message = String(e);
      }
    } catch (_e2) {
      message = 'unknown_fatal';
    }
    globalThis.__SKINCARE_LAST_FATAL__ = { message: message, stack: stack, at: Date.now() };
    syncPost({
      isFatal: !!isFatal,
      platform: 'ios',
      osVersion: '',
      appVersion: '1.0.0',
      build: '',
      errorMessage: message.slice(0, 800),
      stack: stack.slice(0, 2500),
      at: Date.now(),
    });
    try {
      // eslint-disable-next-line no-console
      console.error('[boot-fatal]', message, stack);
    } catch (_e3) {
      /* ignore */
    }
  }

  function installRnHandle() {
    var current = globalThis.RN$handleException;
    if (current && current.__skincareFatal) return;
    var prev = current;
    var wrapped = function (e, isFatal, reportToConsole) {
      if (isFatal) capture(e, true);
      if (typeof prev === 'function' && !prev.__skincareFatal) {
        return prev(e, isFatal, reportToConsole);
      }
      return false;
    };
    wrapped.__skincareFatal = true;
    globalThis.RN$handleException = wrapped;
  }
  installRnHandle();

  function wrapErrorUtils() {
    var EU = globalThis.ErrorUtils;
    if (!EU || !EU.setGlobalHandler || EU.__skincareWrapped) return false;
    var prevHandler = EU.getGlobalHandler && EU.getGlobalHandler();
    EU.setGlobalHandler(function (error, isFatal) {
      if (isFatal) capture(error, true);
      if (prevHandler) prevHandler(error, isFatal);
    });
    EU.__skincareWrapped = true;
    return true;
  }
  wrapErrorUtils();
  var tries = 0;
  var t = setInterval(function () {
    tries += 1;
    installRnHandle();
    wrapErrorUtils();
    if (tries > 40) clearInterval(t);
  }, 50);
})();
