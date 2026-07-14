/**
 * SessionStorage / AsyncStorage helpers for anonymous try-verdict → OTP handoff.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const PRODUCT_KEY = 'touche_try_pending_product';
const ALLERGENS_KEY = 'touche_try_pending_allergens';

export type PendingTryProduct = {
  product_name?: string;
  barcode?: string;
  ingredients_text?: string;
  query?: string;
  source?: 'search' | 'barcode';
};

export type PendingAllergen = {
  allergen_class: string;
  label: string;
};

function webGet(key: string): string | null {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function webSet(key: string, value: string) {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function webRemove(key: string) {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export async function setPendingTryProduct(product: PendingTryProduct): Promise<void> {
  const json = JSON.stringify(product);
  webSet(PRODUCT_KEY, json);
  await AsyncStorage.setItem(PRODUCT_KEY, json);
}

export async function getPendingTryProduct(): Promise<PendingTryProduct | null> {
  const raw = webGet(PRODUCT_KEY) || (await AsyncStorage.getItem(PRODUCT_KEY));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingTryProduct;
  } catch {
    return null;
  }
}

export async function clearPendingTryProduct(): Promise<void> {
  webRemove(PRODUCT_KEY);
  await AsyncStorage.removeItem(PRODUCT_KEY);
}

export async function setPendingAllergens(items: PendingAllergen[]): Promise<void> {
  const json = JSON.stringify(items);
  webSet(ALLERGENS_KEY, json);
  await AsyncStorage.setItem(ALLERGENS_KEY, json);
}

export async function getPendingAllergens(): Promise<PendingAllergen[]> {
  const raw = webGet(ALLERGENS_KEY) || (await AsyncStorage.getItem(ALLERGENS_KEY));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function clearPendingAllergens(): Promise<void> {
  webRemove(ALLERGENS_KEY);
  await AsyncStorage.removeItem(ALLERGENS_KEY);
}
