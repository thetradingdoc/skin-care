import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CAPTURE_2A_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import {
  CALENDAR_EMPTY_BODY,
  CALENDAR_EMPTY_CTA,
  CALENDAR_EMPTY_TITLE,
} from '@/lib/calendar-empty-copy';

/** P7.29 / Step 25 — Calendar empty */
export { CALENDAR_EMPTY_TITLE, CALENDAR_EMPTY_BODY, CALENDAR_EMPTY_CTA };

export function FactsCalendarEmpty() {
  const router = useRouter();
  return (
    <View style={styles.wrap} testID="calendar-empty-t2b">
      <View style={styles.ring}>
        <Text style={styles.ringGlyph}>▢</Text>
      </View>
      <Text style={styles.title} testID="calendar-empty-title">
        {CALENDAR_EMPTY_TITLE}
      </Text>
      <Text style={styles.body} testID="calendar-empty-body">
        {CALENDAR_EMPTY_BODY}
      </Text>
      <Pressable
        accessibilityRole="button"
        style={styles.cta}
        testID="calendar-empty-capture"
        onPress={() =>
          router.push({ pathname: CAPTURE_2A_HREF, params: { entry: 'track' } } as never)
        }>
        <Text style={styles.ctaLabel}>{CALENDAR_EMPTY_CTA}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  ring: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: V4DesignTokens.color.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  ringGlyph: {
    fontSize: 18,
    color: V4DesignTokens.color.muted,
  },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 20,
    color: V4DesignTokens.color.black,
    marginBottom: 8,
    textAlign: 'center',
  },
  body: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 15,
    color: V4DesignTokens.color.muted,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
    maxWidth: 280,
  },
  cta: {
    backgroundColor: V4DesignTokens.color.red,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    color: V4DesignTokens.color.white,
    fontSize: 15,
  },
});
