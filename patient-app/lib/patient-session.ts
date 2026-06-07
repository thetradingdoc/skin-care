import * as SecureStore from 'expo-secure-store';

import { API_BASE_URL } from '@/config';

export const SESSION_KEY = 'patient_session_id';
export const EMAIL_KEY = 'patient_session_email';
export const API_BASE_KEY = 'patient_api_base_url';

export async function getPatientSessionId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SESSION_KEY);
  } catch {
    return null;
  }
}

export async function setPatientSession(sessionId: string, email?: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, sessionId);
  await SecureStore.setItemAsync(API_BASE_KEY, API_BASE_URL);
  if (email) {
    await SecureStore.setItemAsync(EMAIL_KEY, email);
  }
}

export async function clearPatientSession(): Promise<void> {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(SESSION_KEY),
    SecureStore.deleteItemAsync(EMAIL_KEY),
    SecureStore.deleteItemAsync(API_BASE_KEY),
  ]);
}
