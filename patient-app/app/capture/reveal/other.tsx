/**
 * P7.23 — Reveal 5b-other (own screen — not shared with mark).
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

export const OTHER_REVEAL_HEADLINE = 'Logged as "other"';
export const OTHER_REVEAL_SUPPORT = 'saved to your calendar';
export const OTHER_REVEAL_CONTINUE = 'Continue';

export default function Reveal5bOtherScreen() {
  const router = useRouter();

  return (
    <CaptureRevealChrome testID="reveal-5b-other">
      <View>
        <Text style={styles.headline} testID="reveal-5b-other-headline">
          {OTHER_REVEAL_HEADLINE}
        </Text>
        <Text style={styles.support} testID="reveal-5b-other-support">
          {OTHER_REVEAL_SUPPORT}
        </Text>
      </View>
      <RevealPrimaryButton
        label={OTHER_REVEAL_CONTINUE}
        testID="reveal-5b-other-continue"
        onPress={() => router.replace(thesisHrefForTag('other'))}
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
