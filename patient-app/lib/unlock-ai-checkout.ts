/**
 * Unlock AI checkout response helper (pure — safe for unit tests).
 */
export function unlockCheckoutUrlFromResponse(res: unknown): string | null {
  if (!res || typeof res !== 'object') return null;
  const url = (res as { url?: unknown }).url;
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  return trimmed.length > 0 ? trimmed : null;
}
