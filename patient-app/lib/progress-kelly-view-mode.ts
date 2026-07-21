/**
 * Pure Progress Kelly render guard — no React Native imports (unit-testable).
 * Body only when payloadMarkId === selectedMarkId and not loading.
 */
import type { ProgressKellyPayload } from '@/lib/progress-kelly-api';

export type ProgressKellyViewMode = 'loading' | 'empty' | 'message';

export function resolveProgressKellyViewMode(args: {
  loading: boolean;
  payload: ProgressKellyPayload | null;
  payloadMarkId: string | null;
  selectedMarkId: string | null;
}): ProgressKellyViewMode {
  const { loading, payload, payloadMarkId, selectedMarkId } = args;
  const payloadMatches =
    selectedMarkId != null &&
    payloadMarkId != null &&
    String(payloadMarkId) === String(selectedMarkId);

  if (loading || (selectedMarkId != null && !payloadMatches)) {
    return 'loading';
  }
  if (!payload) return 'empty';
  if (payload.client_action === 'suppress' || payload.status === 'nothing_new') {
    return 'empty';
  }
  if (!payload.message?.body?.trim()) return 'empty';
  return 'message';
}
