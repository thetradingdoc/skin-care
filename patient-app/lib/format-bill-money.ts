/**
 * P8.11 + amount_cents canonical — bill display from integer minor units.
 * Never treat amount_cents as major units (that caused 100× display bugs).
 */

/** ISO 4217 exponent for minor units (default 2). */
export function currencyMinorDigits(currency: string | null | undefined): number {
  const code = String(currency || 'USD').trim().toUpperCase();
  if (code === 'JPY' || code === 'KRW' || code === 'VND') return 0;
  return 2;
}

export function amountCentsToMajor(
  amountCents: number | string | null | undefined,
  currency?: string | null,
): number | null {
  const n =
    typeof amountCents === 'number'
      ? amountCents
      : Number(String(amountCents ?? '').replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n)) return null;
  const digits = currencyMinorDigits(currency);
  return n / 10 ** digits;
}

/**
 * Format stored amount_cents for UI.
 * @param amountCents integer minor units (e.g. 8400 → $84.00 USD)
 */
export function formatBillMoney(
  amountCents: number | string | null | undefined,
  currency: string | null | undefined,
  locale = 'en-US',
): string {
  const code = String(currency || 'USD').trim().toUpperCase() || 'USD';
  const major = amountCentsToMajor(amountCents, code);
  if (major == null) {
    const raw = String(amountCents || '').trim();
    if (raw) return raw.includes(code) ? raw : `${raw} ${code}`;
    return code;
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'symbol',
    }).format(major);
  } catch {
    return `${major.toFixed(currencyMinorDigits(code))} ${code}`;
  }
}
