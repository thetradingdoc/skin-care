import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

import * as SecureStore from 'expo-secure-store';
import { PENDING_ROUTINE_CONCERN_KEY } from '@/constants/routineSession';
import {
  clearPendingRoutineConcern,
  getPendingRoutineConcern,
  setPendingRoutineConcern,
} from '@/lib/routine-session';

describe('routine-session pending concern', () => {
  beforeEach(() => {
    vi.mocked(SecureStore.getItemAsync).mockReset();
    vi.mocked(SecureStore.setItemAsync).mockReset();
    vi.mocked(SecureStore.deleteItemAsync).mockReset();
    localStorage.clear();
  });

  it('reads and clears pending concern from localStorage on web', async () => {
    localStorage.setItem(PENDING_ROUTINE_CONCERN_KEY, 'acne');
    await expect(getPendingRoutineConcern()).resolves.toBe('acne');
    await clearPendingRoutineConcern();
    expect(localStorage.getItem(PENDING_ROUTINE_CONCERN_KEY)).toBeNull();
  });

  it('writes pending concern to localStorage on web', async () => {
    await setPendingRoutineConcern('hyperpigmentation');
    expect(localStorage.getItem(PENDING_ROUTINE_CONCERN_KEY)).toBe('hyperpigmentation');
  });
});
