import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ConsumerPrimaryButton } from '@/components/billing-ui';
import { AppTokens } from '@/constants/appTokens';

type Props = {
  title: string;
  body: string;
  ctaLabel?: string;
  onCta?: () => void;
};

export function EmptyStateCard({ title, body, ctaLabel, onCta }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {ctaLabel && onCta ? <ConsumerPrimaryButton label={ctaLabel} onPress={onCta} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppTokens.color.card,
    borderRadius: AppTokens.radius.md,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    padding: AppTokens.spacing.lg,
    gap: 8,
  },
  title: { fontFamily: AppTokens.font.display, fontSize: 20, color: AppTokens.color.ink },
  body: { fontSize: 14, color: AppTokens.color.muted, lineHeight: 20 },
});
