/**
 * P7.09 — Profile Language stub T11.
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  SecondTierChrome,
  TierPrimary,
} from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { PROFILE_HREF } from '@/constants/routes';

export const LANGUAGE_TITLE = 'Language';
export const LANGUAGE_BODY =
  'App language: English. more app languages coming. documents you upload keep their own language — we detect it and ask you to confirm on each one.';

export default function ProfileLanguageScreen() {
  const router = useRouter();
  return (
    <SecondTierChrome testID="screen-profile-language">
      <View>
        <Text style={styles.title} testID="language-title">
          {LANGUAGE_TITLE}
        </Text>
        <Text style={styles.body} testID="language-body">
          {LANGUAGE_BODY}
        </Text>
      </View>
      <TierPrimary label="Done" testID="language-done" onPress={() => router.replace(PROFILE_HREF)} />
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, color: AppTokens.color.muted },
});
