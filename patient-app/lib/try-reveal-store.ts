/**
 * Ephemeral try-reveal payload (session → Reveal UI).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { PendingAllergen, PendingTryProduct } from '@/lib/try-verdict-session';

const KEY = 'touche_try_reveal_payload';

export type TryRevealPayload = {
  product: PendingTryProduct;
  allergens: PendingAllergen[];
  verdict: Record<string, unknown>;
};

function webGet(): string | null {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function setTryRevealPayload(payload: TryRevealPayload): Promise<void> {
  const json = JSON.stringify(payload);
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(KEY, json);
    } catch {
      /* ignore */
    }
  }
  await AsyncStorage.setItem(KEY, json);
}

export async function getTryRevealPayload(): Promise<TryRevealPayload | null> {
  const raw = webGet() || (await AsyncStorage.getItem(KEY));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TryRevealPayload;
  } catch {
    return null;
  }
}
