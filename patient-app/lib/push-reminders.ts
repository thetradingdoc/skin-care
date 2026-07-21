/**
 * TOUCH-115 — local daily Check reminder schedule (Expo Notifications).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const ENABLED_KEY = 'touche_daily_reminder_enabled';
const NOTIF_ID_KEY = 'touche_daily_reminder_notif_id';

export async function getDailyReminderEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ENABLED_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setDailyReminderEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, on ? '1' : '0');
}

/** Local-only prefs — no patient alerts API for these toggles (Step 34 honesty). */
const WEEKLY_MARK_KEY = 'touche_weekly_mark_reminder_local';
const RX_EXPIRY_KEY = 'touche_rx_expiry_alerts_local';

export const NOTIFICATION_PREFS_ARE_LOCAL_ONLY = true as const;

export async function getWeeklyMarkReminderEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(WEEKLY_MARK_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setWeeklyMarkReminderEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(WEEKLY_MARK_KEY, on ? '1' : '0');
}

export async function getRxExpiryAlertsEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(RX_EXPIRY_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setRxExpiryAlertsEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(RX_EXPIRY_KEY, on ? '1' : '0');
}

export async function syncDailyReminderSchedule(enabled: boolean): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications');
    const existing = await AsyncStorage.getItem(NOTIF_ID_KEY);
    if (existing) {
      await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});
      await AsyncStorage.removeItem(NOTIF_ID_KEY);
    }
    if (!enabled) return;

    const perms = await Notifications.getPermissionsAsync();
    if (perms.status !== 'granted') {
      const asked = await Notifications.requestPermissionsAsync();
      if (asked.status !== 'granted') return;
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'skiñcare',
        body: 'Time for today’s Check photo.',
        data: { route: '/capture', kind: 'daily_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes?.DAILY || 'daily',
        hour: 20,
        minute: 0,
      },
    });
    await AsyncStorage.setItem(NOTIF_ID_KEY, String(id));
  } catch {
    /* non-blocking */
  }
}
