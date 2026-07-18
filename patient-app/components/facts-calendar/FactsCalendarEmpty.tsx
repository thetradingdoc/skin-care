import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTokens } from '@/constants/appTokens';
import { TRACK_CAPTURE_HREF } from '@/constants/routes';
import { CALENDAR_EMPTY_BODY, CALENDAR_EMPTY_TITLE } from '@/lib/calendar-empty-copy';

/** P7.29 — Calendar empty T2b */
export { CALENDAR_EMPTY_TITLE, CALENDAR_EMPTY_BODY };

export function FactsCalendarEmpty() {
  const router = useRouter();
  return (
    <View style={styles.wrap} testID="calendar-empty-t2b">
      <Text style={styles.title}>{CALENDAR_EMPTY_TITLE}</Text>
      <Text style={styles.body}>{CALENDAR_EMPTY_BODY}</Text>
      <Pressable
        accessibilityRole="button"
        style={styles.cta}
        testID="calendar-empty-capture"
        onPress={() => router.push(TRACK_CAPTURE_HREF)}>
        <Text style={styles.ctaLabel}>Log something</Text>
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
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: AppTokens.color.ink,
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    color: AppTokens.color.muted,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  cta: {
    backgroundColor: AppTokens.color.fabBg,
    borderRadius: AppTokens.radius.md,
    minHeight: AppTokens.minTap,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
