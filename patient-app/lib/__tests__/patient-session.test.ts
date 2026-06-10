import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    store.delete(key);
  }),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

vi.mock('@/config', () => ({
  API_BASE_URL: 'https://api.test.example',
}));

import {
  API_BASE_KEY,
  EMAIL_KEY,
  SESSION_KEY,
  clearPatientSession,
  getPatientSessionId,
  setPatientSession,
} from '../patient-session';

describe('patient-session', () => {
  beforeEach(() => {
    store.clear();
  });

  it('exports stable storage keys', () => {
    expect(SESSION_KEY).toBe('patient_session_id');
    expect(EMAIL_KEY).toBe('patient_session_email');
    expect(API_BASE_KEY).toBe('patient_api_base_url');
  });

  it('setPatientSession persists session id and api base', async () => {
    await setPatientSession('sess-abc', 'user@example.com');
    await expect(getPatientSessionId()).resolves.toBe('sess-abc');
    expect(store.get(EMAIL_KEY)).toBe('user@example.com');
    expect(store.get(API_BASE_KEY)).toBe('https://api.test.example');
  });

  it('clearPatientSession removes all session keys', async () => {
    await setPatientSession('sess-xyz', 'user@example.com');
    await clearPatientSession();
    await expect(getPatientSessionId()).resolves.toBeNull();
    expect(store.has(EMAIL_KEY)).toBe(false);
    expect(store.has(API_BASE_KEY)).toBe(false);
  });
});
