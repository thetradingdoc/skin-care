/**
 * P7.41 — Profile notifications permission.
 */
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  SecondTierChrome,
  TierPrimary,
  TierSecondary,
} from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { PROFILE_HREF } from '@/constants/routes';
import {
  setDailyReminderEnabled,
  syncDailyReminderSchedule,
} from '@/lib/push-reminders';

export const NOTIFICATIONS_TITLE = 'Notifications';
export const NOTIFICATIONS_BODY =
  'Reminders for capture and prescription expiry — only if you opt in.';

export default function ProfileNotificationsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'on' | 'skipped'>('idle');

  const enable = async () => {
    await setDailyReminderEnabled(true);
    await syncDailyReminderSchedule(true);
    setStatus('on');
  };

  return (
    <SecondTierChrome testID="screen-profile-notifications">
      <View>
        <Text style={styles.title} testID="notifications-title">
          {NOTIFICATIONS_TITLE}
        </Text>
        <Text style={styles.body}>{NOTIFICATIONS_BODY}</Text>
        {status === 'on' ? (
          <Text style={styles.hint} testID="notifications-enabled">
            Reminders enabled on this device.
          </Text>
        ) : null}
      </View>
      <View>
        <TierPrimary
          label="Allow notifications"
          testID="notifications-allow"
          onPress={() => void enable()}
        />
        <TierSecondary
          label="Not now"
          testID="notifications-skip"
          onPress={() => {
            setStatus('skipped');
            router.replace(PROFILE_HREF);
          }}
        />
      </View>
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, color: AppTokens.color.muted },
  hint: { marginTop: 16, color: AppTokens.color.safe, fontWeight: '500' },
});
