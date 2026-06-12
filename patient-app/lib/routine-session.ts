import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { PENDING_ROUTINE_CONCERN_KEY } from '@/constants/routineSession';

export async function getPendingRoutineConcern(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(PENDING_ROUTINE_CONCERN_KEY);
    }
    return (await SecureStore.getItemAsync(PENDING_ROUTINE_CONCERN_KEY)) || null;
  } catch {
    return null;
  }
}

export async function setPendingRoutineConcern(concernId: string): Promise<void> {
  const value = String(concernId || '').trim();
  if (!value) return;
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PENDING_ROUTINE_CONCERN_KEY, value);
      }
      return;
    }
    await SecureStore.setItemAsync(PENDING_ROUTINE_CONCERN_KEY, value);
  } catch {
    // best-effort
  }
}

export async function clearPendingRoutineConcern(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(PENDING_ROUTINE_CONCERN_KEY);
      }
      return;
    }
    await SecureStore.deleteItemAsync(PENDING_ROUTINE_CONCERN_KEY);
  } catch {
    // best-effort
  }
}
