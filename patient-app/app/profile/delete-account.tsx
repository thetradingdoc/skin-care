/**
 * PIH v2 — Delete account confirm (design ID: profile-delete).
 * Wires to current patient account purge API.
 */
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { PROFILE_HREF, WELCOME_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { patientPost } from '@/lib/patient-api';
import { clearPatientSession } from '@/lib/patient-session';

export default function ProfileDeleteScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const purge = async () => {
    setBusy(true);
    setError(null);
    try {
      await patientPost('/api/patient/account/delete', { confirm: true });
      await clearPatientSession();
      router.replace(WELCOME_HREF);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not delete account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} testID="screen-profile-delete" edges={['top', 'bottom']}>
      <BackNavHeader label="Back" onBack={() => router.replace(PROFILE_HREF)} />
      <View style={styles.body}>
        <Text style={styles.badge}>confirmation state</Text>
        <Text style={styles.title}>Delete your account?</Text>
        <Text style={styles.sub}>
          This permanently removes your photos, records, and progress. This can't be undone.
        </Text>
        {error ? <Text style={styles.err}>{error}</Text> : null}
      </View>
      <View style={styles.footer}>
        <Pressable
          style={[styles.danger, busy && { opacity: 0.6 }]}
          disabled={busy}
          testID="profile-delete-confirm"
          onPress={() => void purge()}>
          <Text style={styles.dangerLabel}>{busy ? 'Deleting…' : 'Delete permanently'}</Text>
        </Pressable>
        <Pressable testID="profile-delete-cancel" onPress={() => router.replace(PROFILE_HREF)}>
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
  err: { color: V4DesignTokens.color.red, fontSize: 13 },
  footer: { padding: 22, gap: 12 },
  danger: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: V4DesignTokens.color.red,
    paddingVertical: 15,
    alignItems: 'center',
  },
  dangerLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 15,
    color: V4DesignTokens.color.red,
  },
  cancel: {
    textAlign: 'center',
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
  },
});
