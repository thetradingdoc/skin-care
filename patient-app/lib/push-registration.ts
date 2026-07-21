/**
 * TOUCH-114 — iOS push permission + device token registration.
 * Deny path is non-blocking (Check still usable).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { patientPost } from '@/lib/patient-api';

const PUSH_DENIED_KEY = 'touche_push_permission_denied';
const PUSH_TOKEN_KEY = 'touche_push_device_token';

export type PushRegistrationResult =
  | { status: 'granted'; token: string }
  | { status: 'denied' }
  | { status: 'unsupported' }
  | { status: 'skipped' };

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/**
 * Read OS notification permission without prompting.
 * Used by Profile → Notifications to route to profile-notif-denied when off.
 */
export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications');
    const perms = await Notifications.getPermissionsAsync();
    const status = String(perms?.status || 'undetermined');
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'unsupported';
  }
}

/**
 * Request notification permission on iOS (native). Web/Android skip.
 * On grant, POST token to backend. On deny, persist flag and continue.
 */
export async function registerPushDeviceToken(patientHint?: string): Promise<PushRegistrationResult> {
  if (Platform.OS !== 'ios') {
    return { status: 'unsupported' };
  }

  const denied = await AsyncStorage.getItem(PUSH_DENIED_KEY);
  if (denied === '1') {
    return { status: 'skipped' };
  }

  try {
    // Lazy require so web bundles without expo-notifications still build.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications');
    const perms = await Notifications.getPermissionsAsync();
    let status = perms.status;
    if (status !== 'granted') {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== 'granted') {
      await AsyncStorage.setItem(PUSH_DENIED_KEY, '1');
      return { status: 'denied' };
    }

    const tokenRes = await Notifications.getExpoPushTokenAsync();
    const token = String(tokenRes?.data || '');
    if (!token) return { status: 'denied' };

    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    await patientPost('/api/patient/devices/push-token', {
      token,
      platform: 'ios',
      patient_hint: patientHint || null,
    }).catch(() => {
      /* backend may be temporarily down — app remains usable */
    });
    return { status: 'granted', token };
  } catch {
    // Module missing / simulator — non-blocking
    return { status: 'unsupported' };
  }
}

/** Docs: permission flow for TOUCH-114 acceptance. */
export const PUSH_PERMISSION_FLOW_DOC = `
TOUCH-114 push permission flow (iOS native):
1. After post-auth lands on Check, call registerPushDeviceToken() once.
2. OS shows system permission prompt.
3. Grant → Expo push token stored locally + POST /api/patient/devices/push-token.
4. Deny → AsyncStorage touche_push_permission_denied=1; Check remains fully usable.
5. Web and Android: unsupported/skipped (6c App Store path covers iOS install).
6. Profile → Notifications: if getNotificationPermissionStatus() === denied → /profile/notif-denied.
`;
