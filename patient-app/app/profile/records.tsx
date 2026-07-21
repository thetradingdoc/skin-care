/**
 * PIH v2 — Medical records advanced hub (design ID: profile-records).
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { CAPTURE_TAG_HREF, PROFILE_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';

const TAGS = ['Prescription', 'Lab', 'Bill', 'Other'] as const;

export default function ProfileRecordsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.root} testID="screen-profile-records" edges={['top', 'bottom']}>
      <BackNavHeader label="Back" onBack={() => router.replace(PROFILE_HREF)} />
      <View style={styles.body}>
        <Text style={styles.title}>Medical records</Text>
        <Text style={styles.sub}>
          Prescriptions, labs, bills — kept separate from your PIH tracking.
        </Text>
        <View style={styles.chips}>
          {TAGS.map((t) => (
            <Pressable
              key={t}
              style={styles.chip}
              onPress={() =>
                router.push({ pathname: CAPTURE_TAG_HREF, params: { pref: t.toLowerCase() } } as never)
              }>
              <Text style={styles.chipText}>{t}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.footer}>
        <Pressable style={styles.cta} onPress={() => router.push(CAPTURE_TAG_HREF)}>
          <Text style={styles.ctaLabel}>Log a record</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.ground },
  body: { flex: 1, paddingHorizontal: 22, paddingTop: 8, gap: 12 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 19,
    color: V4DesignTokens.color.wine,
  },
  sub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    lineHeight: 20,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(61,0,11,0.06)',
    borderWidth: 1.5,
    borderColor: V4DesignTokens.color.line,
  },
  chipText: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 13,
    color: V4DesignTokens.color.wine,
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
