/**
 * PIH v2 — Notification permission denied (design ID: profile-notif-denied).
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { PROFILE_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';

export default function ProfileNotifDeniedScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.root} testID="screen-profile-notif-denied" edges={['top', 'bottom']}>
      {/* Back to Profile — not Notifications, which would immediately re-redirect here when denied */}
      <BackNavHeader label="Back" onBack={() => router.replace(PROFILE_HREF)} />
      <View style={styles.body}>
        <Text style={styles.badge}>permission state</Text>
        <Text style={styles.title}>Notifications are off</Text>
        <Text style={styles.sub}>
          Turn them on in Settings to get photo reminders and Kelly's check-ins.
        </Text>
      </View>
      <View style={styles.footer}>
        <Pressable
          style={styles.cta}
          testID="notif-denied-settings"
          onPress={() => void Linking.openSettings()}>
          <Text style={styles.ctaLabel}>Open settings</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.ground },
  body: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 12 },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 10,
    fontFamily: V4DesignTokens.font.bodyBold,
    color: V4DesignTokens.color.red,
    borderWidth: 1,
    borderColor: V4DesignTokens.color.red,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 22,
    color: V4DesignTokens.color.wine,
  },
  sub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    lineHeight: 21,
  },
  footer: { padding: 22 },
  cta: {
    backgroundColor: V4DesignTokens.color.wine,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 15,
    color: V4DesignTokens.color.white,
  },
});
