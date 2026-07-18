/** Canonical marketing / SEO origin after Phase E brand consolidation. */
export const SITE_ORIGIN = 'https://trytouche.com';
/** App shell + public legal pages we control on Firebase Hosting. */
export const APP_ORIGIN = 'https://app.trytouche.com';
export const OG_IMAGE = `${SITE_ORIGIN}/og-image.jpg`;
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const SITE_NAME = 'Touche';

export const DEFAULT_OG_TITLE = 'Touche — skincare & medical journal';
export const DEFAULT_OG_DESCRIPTION =
  'One place for your skin, prescriptions, and bills. 20 AI reads free each month — manual entries always free.';
export const DEFAULT_META_DESCRIPTION = DEFAULT_OG_DESCRIPTION;

export function absoluteUrl(path = '/') {
  if (!path || path === '/') return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

export function absoluteAppUrl(path = '/') {
  if (!path || path === '/') return `${APP_ORIGIN}/`;
  return `${APP_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

function setMeta(name, content, { property = false } = {}) {
  const attr = property ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function setCanonical(url) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

/**
 * @param {{ title: string, description: string, path?: string, noindex?: boolean }} opts
 */
export function setDocumentSeo({ title, description, path = '/', noindex = false }) {
  const pageUrl = absoluteUrl(path);
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;

  document.title = fullTitle;
  setMeta('description', description);
  setMeta('robots', noindex ? 'noindex,nofollow' : 'index,follow');
  setMeta('og:type', 'website', { property: true });
  setMeta('og:url', pageUrl, { property: true });
  setMeta('og:title', fullTitle, { property: true });
  setMeta('og:description', description, { property: true });
  setMeta('og:image', OG_IMAGE, { property: true });
  setMeta('og:image:width', String(OG_IMAGE_WIDTH), { property: true });
  setMeta('og:image:height', String(OG_IMAGE_HEIGHT), { property: true });
  setMeta('twitter:card', 'summary_large_image');
  setMeta('twitter:title', fullTitle);
  setMeta('twitter:description', description);
  setMeta('twitter:image', OG_IMAGE);
  setCanonical(pageUrl);
}
