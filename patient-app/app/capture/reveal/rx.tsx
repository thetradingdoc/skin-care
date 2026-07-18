/**
 * P7.20 — Reveal 5b-rx — from draft.
 */
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  CaptureRevealChrome,
  RevealPrimaryButton,
  RevealSecondaryButton,
} from '@/components/capture/CaptureRevealChrome';
import { AppTokens } from '@/constants/appTokens';
import { thesisHrefForTag } from '@/constants/routes';
import { peekPendingCaptureDraft } from '@/lib/pending-capture-draft';

export const RX_REVEAL_REMIND = 'Yes, remind me';
export const RX_REVEAL_NO = 'No thanks';

export default function Reveal5bRxScreen() {
  const router = useRouter();
  const [headline, setHeadline] = useState('Your prescription');
  const [support, setSupport] = useState('want a reminder before it runs out?');

  useEffect(() => {
    void peekPendingCaptureDraft().then((p) => {
      if (!p?.draft) return;
      const drug = String(p.draft.drug || 'Your prescription').trim();
      const strength = String(p.draft.strength || '').trim();
      const prescriber = String(p.draft.prescriber || 'your prescriber').trim();
      const expires = String(p.draft.expiry || p.draft.expires || '').trim();
      const drugLine = [drug, strength].filter(Boolean).join(' ');
      setHeadline(`${drugLine} from ${prescriber}`);
      setSupport(
        expires
          ? `expires ${expires} — want a reminder before it runs out?`
          : 'want a reminder before it runs out?',
      );
    });
  }, []);

  return (
    <CaptureRevealChrome testID="reveal-5b-rx">
      <View>
        <Text style={styles.headline} testID="reveal-5b-rx-headline">
          {headline}
        </Text>
        <Text style={styles.support} testID="reveal-5b-rx-support">
          {support}
        </Text>
      </View>
      <View>
        <RevealPrimaryButton
          label={RX_REVEAL_REMIND}
          testID="reveal-5b-rx-remind"
          onPress={() => router.replace(thesisHrefForTag('rx'))}
        />
        <RevealSecondaryButton
          label={RX_REVEAL_NO}
          testID="reveal-5b-rx-no"
          onPress={() => router.replace(thesisHrefForTag('rx'))}
        />
      </View>
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
  support: { fontSize: 16, lineHeight: 24, color: AppTokens.color.muted },
});
