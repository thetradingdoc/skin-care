/**
 * PIH v2 — Sign out confirm (design ID: profile-signout).
 */
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { PROFILE_HREF, WELCOME_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { clearPatientSession } from '@/lib/patient-session';

export default function ProfileSignOutScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try {
      await clearPatientSession();
      router.replace(WELCOME_HREF);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} testID="screen-profile-signout" edges={['top', 'bottom']}>
      <BackNavHeader label="Back" onBack={() => router.replace(PROFILE_HREF)} />
      <View style={styles.body}>
        <Text style={styles.badge}>confirmation state</Text>
        <Text style={styles.title}>Sign out?</Text>
        <Text style={styles.sub}>You'll need your email and a new code to sign back in.</Text>
      </View>
      <View style={styles.footer}>
        <Pressable
          style={[styles.cta, busy && { opacity: 0.6 }]}
          disabled={busy}
          testID="profile-signout-confirm"
          onPress={() => void signOut()}>
          <Text style={styles.ctaLabel}>Sign out</Text>
        </Pressable>
        <Pressable testID="profile-signout-cancel" onPress={() => router.replace(PROFILE_HREF)}>
          <Text style={styles.cancel}>Cancel</Text>
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
  footer: { padding: 22, gap: 12 },
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
  cancel: {
    textAlign: 'center',
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
  },
});
