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
        title: 'touche',
        body: 'Time for today’s Check photo.',
        data: { route: '/check', kind: 'daily_reminder' },
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
