/**
 * G-EMPTY — distinguish "no data yet" from "failed to load" (outage ≠ empty shelf).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTokens } from '@/constants/appTokens';

type Props = {
  title?: string;
  body?: string;
  onRetry?: () => void;
  testID?: string;
};

export const LOAD_FAILED_TITLE = "Couldn't load this right now";
export const LOAD_FAILED_BODY =
  'Check your connection and try again. This is not the same as having nothing saved yet.';

export function LoadFailedState({
  title = LOAD_FAILED_TITLE,
  body = LOAD_FAILED_BODY,
  onRetry,
  testID = 'load-failed-state',
}: Props) {
  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {onRetry ? (
        <Pressable
          style={styles.cta}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry loading"
          testID={`${testID}-retry`}>
          <Text style={styles.ctaLabel}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 32,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: AppTokens.color.ink,
    marginBottom: 8,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: AppTokens.color.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  cta: {
    borderWidth: 1.5,
    borderColor: AppTokens.color.ink,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  ctaLabel: { fontSize: 15, fontWeight: '600', color: AppTokens.color.ink },
});
