import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { API_BASE_URL } from '@/config';

export const SESSION_KEY = 'patient_session_id';
export const EMAIL_KEY = 'patient_session_email';
export const API_BASE_KEY = 'patient_api_base_url';

function readWebStorage(key: string): string | null {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeWebStorage(key: string, value: string): void {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore quota / private mode */
  }
}

function removeWebStorage(key: string): void {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    const web = readWebStorage(key);
    if (web) return web;
  }
  try {
    const value = await SecureStore.getItemAsync(key);
    if (value) return value;
  } catch {
    /* expo-secure-store web shim may be unavailable in static export */
  }
  return readWebStorage(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  writeWebStorage(key, value);
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    /* web static bundle — localStorage is the source of truth */
  }
}

async function secureDelete(key: string): Promise<void> {
  removeWebStorage(key);
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    /* ignore */
  }
}

export async function getPatientSessionId(): Promise<string | null> {
  return secureGet(SESSION_KEY);
}

export async function getStoredApiBase(): Promise<string | null> {
  return secureGet(API_BASE_KEY);
}

export async function getStoredEmail(): Promise<string | null> {
  return secureGet(EMAIL_KEY);
}

export async function setPatientSession(sessionId: string, email?: string): Promise<void> {
  await secureSet(SESSION_KEY, sessionId);
  await secureSet(API_BASE_KEY, API_BASE_URL);
  if (email) {
    await secureSet(EMAIL_KEY, email);
  }
}

export async function clearPatientSession(): Promise<void> {
  await Promise.all([
    secureDelete(SESSION_KEY),
    secureDelete(EMAIL_KEY),
    secureDelete(API_BASE_KEY),
  ]);
}
