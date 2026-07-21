/**
 * Exact byte-duplicate warning on confirm (not a hard block).
 * "Looks right" remains the one-tap override to save the second fact.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppTokens } from '@/constants/appTokens';
import {
  exactDuplicateWarningCopy,
  type PossibleDuplicateInfo,
} from '@/lib/exact-duplicate-warning';

export type { PossibleDuplicateInfo };
export { exactDuplicateWarningCopy };

export function ExactDuplicateWarning({
  possibleDuplicate,
}: {
  possibleDuplicate?: PossibleDuplicateInfo | null;
}) {
  const copy = exactDuplicateWarningCopy(possibleDuplicate);
  if (!copy) return null;
  return (
    <View style={styles.wrap} testID="exact-duplicate-warning">
      <Text style={styles.text}>{copy}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(180, 120, 40, 0.12)',
    borderRadius: 8,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: AppTokens.color.ink,
  },
});
