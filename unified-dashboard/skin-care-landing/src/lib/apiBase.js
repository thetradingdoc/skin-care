/** Production API host for split-domain Firebase hosting (empty = relative /api via dev proxy). */
const raw = String(import.meta.env.VITE_API_BASE || '').trim().replace(/\/$/, '');

export const API_BASE = raw;

export function apiUrl(path) {
  const rel = path.startsWith('/') ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${rel}` : rel;
}
