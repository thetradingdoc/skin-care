const COOKIE_NAME = 'sc_visitor_id';
const MAX_AGE_SEC = 7 * 24 * 60 * 60;

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `vis_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  }
  return `vis_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function getVisitorId() {
  try {
    const fromCookie = document.cookie
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${COOKIE_NAME}=`));
    if (fromCookie) {
      return decodeURIComponent(fromCookie.split('=').slice(1).join('='));
    }
  } catch {
    /* ignore */
  }
  try {
    const stored = sessionStorage.getItem(COOKIE_NAME);
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  const id = randomId();
  try {
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(id)}; path=/; max-age=${MAX_AGE_SEC}; SameSite=Lax`;
    sessionStorage.setItem(COOKIE_NAME, id);
  } catch {
    /* ignore */
  }
  return id;
}
