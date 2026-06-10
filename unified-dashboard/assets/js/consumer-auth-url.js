/**
 * Consumer auth — single sign-in surface at /app/sign-in.
 */
(function (global) {
  function consumerSignInUrl(params) {
    var q;
    if (params && typeof params === 'object' && !(params instanceof URLSearchParams)) {
      q = new URLSearchParams();
      Object.keys(params).forEach(function (k) {
        if (params[k] != null && params[k] !== '') q.set(k, String(params[k]));
      });
    } else if (typeof window !== 'undefined' && !params) {
      q = new URLSearchParams(window.location.search);
    } else {
      q = new URLSearchParams(params || '');
    }
    var qs = q.toString();
    return '/app/sign-in' + (qs ? '?' + qs : '');
  }

  function redirectToConsumerSignIn(params) {
    if (typeof window === 'undefined') return;
    window.location.href = consumerSignInUrl(params);
  }

  global.consumerSignInUrl = consumerSignInUrl;
  global.redirectToConsumerSignIn = redirectToConsumerSignIn;
})(typeof window !== 'undefined' ? window : globalThis);
