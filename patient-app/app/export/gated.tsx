/**
 * PIH v2 — Export gated (design ID: export-gated) — need ≥2 photos with media.
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { MARK_PICKER_HREF, PROGRESS_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';

export const EXPORT_GATED_TITLE = 'Add a photo to unlock your report';
export const EXPORT_GATED_BODY =
  "You've logged 1 photo. Reports need at least 2 to show a comparison.";

export default function ExportGatedScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.root} testID="screen-export-gated" edges={['top', 'bottom']}>
      <BackNavHeader label="Back" onBack={() => router.replace(PROGRESS_HREF)} />
      <View style={styles.body}>
        <Text style={styles.badge}>gated state</Text>
        <Text style={styles.title} testID="export-gated-title">
          {EXPORT_GATED_TITLE}
        </Text>
        <Text style={styles.sub}>{EXPORT_GATED_BODY}</Text>
      </View>
      <View style={styles.footer}>
        <Pressable
          style={styles.cta}
          testID="export-gated-cta"
          onPress={() => router.push(MARK_PICKER_HREF)}>
          <Text style={styles.ctaLabel}>Log another photo</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.ground },
  body: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center', gap: 12 },
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
    textAlign: 'center',
  },
  sub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
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
