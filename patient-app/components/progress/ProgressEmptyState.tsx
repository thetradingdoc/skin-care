/**
 * Step 30 — Progress empty (mock frame 30).
 * Distinct from load-failed; CTA opens mark tracking.
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { MARK_PICKER_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';

export const PROGRESS_EMPTY_TITLE = 'No marks tracked yet';
export const PROGRESS_EMPTY_BODY = 'Log your day 0 baseline to start tracking a mark.';
export const PROGRESS_EMPTY_CTA = 'Log your first photo';

type Props = {
  onTrackMark?: () => void;
};

export function ProgressEmptyState(props: Props = {}) {
  const { onTrackMark } = props;
  const router = useRouter();
  const go = onTrackMark || (() => router.push(MARK_PICKER_HREF));

  return (
    <View style={styles.wrap} testID="progress-empty">
      <View style={styles.ring} testID="progress-empty-t9b">
        <AppIcon name="chart-bar" size={22} color={V4DesignTokens.color.muted} />
      </View>
      <Text style={styles.title} testID="progress-empty-title">
        {PROGRESS_EMPTY_TITLE}
      </Text>
      <Text style={styles.body} testID="progress-empty-body">
        {PROGRESS_EMPTY_BODY}
      </Text>
      <Pressable
        style={styles.cta}
        onPress={go}
        accessibilityRole="button"
        accessibilityLabel={PROGRESS_EMPTY_CTA}
        testID="progress-empty-cta">
        <Text style={styles.ctaText}>{PROGRESS_EMPTY_CTA}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 48,
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  ring: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: V4DesignTokens.color.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 18,
    color: V4DesignTokens.color.black,
    textAlign: 'center',
  },
  body: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  cta: {
    marginTop: 10,
    backgroundColor: V4DesignTokens.color.red,
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: 10,
  },
  ctaText: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 14,
    color: V4DesignTokens.color.white,
  },
});
