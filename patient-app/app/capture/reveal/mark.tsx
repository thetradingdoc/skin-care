/**
 * P7.21 — Reveal 5b-mark (own screen — not shared with other).
 * v10 5b-other showed mark copy; plan requires a dedicated mark reveal.
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  CaptureRevealChrome,
  RevealPrimaryButton,
} from '@/components/capture/CaptureRevealChrome';
import { AppTokens } from '@/constants/appTokens';
import { thesisHrefForTag } from '@/constants/routes';

export const MARK_REVEAL_HEADLINE = 'Logged as "mark"';
export const MARK_REVEAL_SUPPORT =
  "saved to your calendar — we'll help you compare it over time";
export const MARK_REVEAL_CONTINUE = 'Continue';

export default function Reveal5bMarkScreen() {
  const router = useRouter();

  return (
    <CaptureRevealChrome testID="reveal-5b-mark">
      <View>
        <Text style={styles.headline} testID="reveal-5b-mark-headline">
          {MARK_REVEAL_HEADLINE}
        </Text>
        <Text style={styles.support} testID="reveal-5b-mark-support">
          {MARK_REVEAL_SUPPORT}
        </Text>
      </View>
      <RevealPrimaryButton
        label={MARK_REVEAL_CONTINUE}
        testID="reveal-5b-mark-continue"
        onPress={() => router.replace(thesisHrefForTag('mark'))}
      />
    </CaptureRevealChrome>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '600',
    color: AppTokens.color.ink,
    marginBottom: 16,
  },
  support: {
    fontSize: 16,
    lineHeight: 24,
    color: AppTokens.color.muted,
  },
});
