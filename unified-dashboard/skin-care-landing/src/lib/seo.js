export const SITE_ORIGIN = 'https://myskinandcare.com';
export const OG_IMAGE = `${SITE_ORIGIN}/og-image.jpg`;
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const SITE_NAME = 'touche';

export const DEFAULT_OG_TITLE = 'touche — The #1 Skincare Journal';
export const DEFAULT_OG_DESCRIPTION =
  'Log one photo a day and see what changes.';
export const DEFAULT_META_DESCRIPTION =
  'Log one photo a day and see what changes.';

export function absoluteUrl(path = '/') {
  if (!path || path === '/') return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
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
 * @param {{ title: string, description: string, path?: string }} opts
 */
export function setDocumentSeo({ title, description, path = '/' }) {
  const pageUrl = absoluteUrl(path);
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;

  document.title = fullTitle;
  setMeta('description', description);
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
