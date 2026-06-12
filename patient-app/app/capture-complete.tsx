import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConsumerPrimaryButton, ConsumerSecondaryButton } from '@/components/billing-ui';
import { AppTokens } from '@/constants/appTokens';
import { PROGRESS_HREF } from '@/constants/routes';

export default function CaptureCompleteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string | string[] }>();
  const kind = Array.isArray(params.kind) ? params.kind[0] : params.kind;

  const subtitle =
    kind === 'manual_payment'
      ? 'Payment recorded.'
      : kind === 'manual_bill'
        ? 'Bill recorded.'
        : 'Your document is saved.';

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ title: 'Saved' }} />
      <View style={styles.block}>
        <Text allowFontScaling style={styles.title}>
          You&apos;re all set
        </Text>
        <Text allowFontScaling style={styles.sub}>
          {subtitle}
        </Text>
        <ConsumerPrimaryButton label="View progress" onPress={() => router.replace(PROGRESS_HREF)} />
        <View style={{ height: 12 }} />
        <ConsumerSecondaryButton label="Close" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  block: { flex: 1, padding: AppTokens.spacing.lg, justifyContent: 'center', gap: AppTokens.spacing.md },
  title: {
    fontFamily: AppTokens.font.display,
    fontSize: 28,
    color: AppTokens.color.ink,
  },
  sub: {
    fontFamily: AppTokens.font.body,
    color: AppTokens.color.muted,
    lineHeight: 22,
    marginBottom: AppTokens.spacing.md,
  },
});
