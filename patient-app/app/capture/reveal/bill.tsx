/**
 * P7.19 — Reveal 5b-bill — from confirmed draft.
 */
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CaptureRevealChrome, RevealPrimaryButton } from '@/components/capture/CaptureRevealChrome';
import { AppTokens } from '@/constants/appTokens';
import { thesisHrefForTag } from '@/constants/routes';
import { formatBillMoney } from '@/lib/format-bill-money';
import { peekPendingCaptureDraft } from '@/lib/pending-capture-draft';

export const BILL_REVEAL_CONTINUE = 'Continue';

export default function Reveal5bBillScreen() {
  const router = useRouter();
  const [headline, setHeadline] = useState('Saved to your calendar');
  const [support, setSupport] = useState('');

  useEffect(() => {
    void peekPendingCaptureDraft().then((p) => {
      if (!p?.draft) return;
      const currency = String(p.draft.currency || 'USD');
      const amountCents = String(p.draft.amount_cents ?? '');
      const amountLabel = amountCents ? formatBillMoney(amountCents, currency) : '—';
      const provider = String(p.draft.provider || 'your provider');
      const date = String(p.draft.date || 'today');
      setHeadline(`Saved — ${amountLabel} to ${provider}`);
      setSupport(`logged to your calendar for ${date}`);
    });
  }, []);

  return (
    <CaptureRevealChrome testID="reveal-5b-bill">
      <View>
        <Text style={styles.headline} testID="reveal-5b-bill-headline">
          {headline}
        </Text>
        <Text style={styles.support} testID="reveal-5b-bill-support">
          {support}
        </Text>
      </View>
      <RevealPrimaryButton
        label={BILL_REVEAL_CONTINUE}
        testID="reveal-5b-bill-continue"
        onPress={() => router.replace(thesisHrefForTag('bill'))}
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
  support: { fontSize: 16, lineHeight: 24, color: AppTokens.color.muted },
});
