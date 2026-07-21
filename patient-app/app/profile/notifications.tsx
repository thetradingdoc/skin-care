/**
 * Step 34 / P7.41 — Notifications entry (design ID: profile-notifications).
 * Reuses allergens prefs UI for toggles; gates on OS permission so
 * profile-notif-denied is reachable when notifications are off.
 */
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AllergensNotificationsScreen } from './allergens';
import { PROFILE_NOTIF_DENIED_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { getNotificationPermissionStatus } from '@/lib/push-registration';

export const NOTIFICATIONS_TITLE = 'Notifications';
export const NOTIFICATIONS_BODY =
  'Reminders for capture and prescription expiry — only if you opt in.';

export default function ProfileNotificationsScreen() {
  const router = useRouter();
  const [gate, setGate] = useState<'checking' | 'ok'>('checking');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setGate('checking');
      void (async () => {
        const status = await getNotificationPermissionStatus();
        if (cancelled) return;
        if (status === 'denied') {
          router.replace(PROFILE_NOTIF_DENIED_HREF);
          return;
        }
        setGate('ok');
      })();
      return () => {
        cancelled = true;
      };
    }, [router]),
  );

  if (gate === 'checking') {
    return (
      <SafeAreaView style={styles.root} testID="screen-profile-notifications-checking">
        <ActivityIndicator color={V4DesignTokens.color.wine} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <AllergensNotificationsScreen
      screenTestID="screen-profile-notifications"
      onNotificationPermissionDenied={() => router.replace(PROFILE_NOTIF_DENIED_HREF)}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.ground },
});
