/**
 * Consumer wordmark HTML — mirrors landing LogoWordmark (see wordmark-snippet.html).
 * Requires /assets/css/logo-wordmark.css on the page.
 */
(function (global) {
  function wordmarkHtml(heightPx) {
    const h = Number(heightPx) || 52;
    return `<span class="sc-logo-wordmark" style="--logo-height: ${h}px" role="img" aria-label="skin care">
  <span class="sc-logo-skin" aria-hidden="true">skin</span>
  <span class="sc-logo-mark-slot" aria-hidden="true">
    <img class="sc-logo-mark" src="/assets/brand/tulip-mark.svg" alt="" width="600" height="215" />
  </span>
  <span class="sc-logo-care" aria-hidden="true">care</span>
</span>`;
  }

  global.scWordmarkHtml = wordmarkHtml;
})(typeof window !== 'undefined' ? window : globalThis);
