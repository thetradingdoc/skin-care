/**
 * Exact byte-duplicate confirm copy (pure — no RN).
 */
export type PossibleDuplicateInfo = {
  fact_id: string;
  logged_on?: string | null;
  tag?: string | null;
  entry_date?: string | null;
  request_id?: string | null;
};

export function exactDuplicateWarningCopy(
  info: PossibleDuplicateInfo | null | undefined,
): string | null {
  if (!info?.fact_id) return null;
  const date = (info.logged_on || info.entry_date || '').trim() || 'previously';
  return `This looks like a document you've already logged on ${date}. Save anyway?`;
}
