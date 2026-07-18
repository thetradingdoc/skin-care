/**
 * P7.15 — Progress empty T9b.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppTokens } from '@/constants/appTokens';

export const PROGRESS_EMPTY_TITLE = 'Nothing to show yet';
export const PROGRESS_EMPTY_BODY = 'log your first thing and this fills in';

export function ProgressEmptyState() {
  return (
    <View style={styles.wrap} testID="progress-empty-t9b">
      <Text style={styles.title}>{PROGRESS_EMPTY_TITLE}</Text>
      <Text style={styles.body}>{PROGRESS_EMPTY_BODY}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 32, alignItems: 'center', paddingHorizontal: 16 },
  title: { fontSize: 18, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 8 },
  body: { fontSize: 15, color: AppTokens.color.muted, textAlign: 'center' },
});
