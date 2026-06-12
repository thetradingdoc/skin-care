import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { AppTokens } from '@/constants/appTokens';

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    fontFamily: AppTokens.font.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: AppTokens.color.muted,
    paddingTop: 10,
    paddingBottom: 4,
  },
});
