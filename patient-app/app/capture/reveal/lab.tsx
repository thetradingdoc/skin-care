/**
 * P7.22 — Reveal 5b-lab — from draft.
 */
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CaptureRevealChrome, RevealPrimaryButton } from '@/components/capture/CaptureRevealChrome';
import { AppTokens } from '@/constants/appTokens';
import { thesisHrefForTag } from '@/constants/routes';
import { peekPendingCaptureDraft } from '@/lib/pending-capture-draft';

export const LAB_REVEAL_CONTINUE = 'Continue';
export const LAB_REVEAL_LANGUAGE_NOTE =
  'we save it as written. translation is coming — for now, results are kept as written.';

export default function Reveal5bLabScreen() {
  const router = useRouter();
  const [headline, setHeadline] = useState('Lab result saved');
  const [support, setSupport] = useState(LAB_REVEAL_LANGUAGE_NOTE);

  useEffect(() => {
    void peekPendingCaptureDraft().then((p) => {
      if (!p?.draft) return;
      const provider = String(p.draft.provider || 'your lab').trim();
      const test = String(p.draft.title || p.draft.test || 'lab result').trim();
      const language = String(p.draft.source_language || p.draft.display_language || '').trim();
      setHeadline(`${test} from ${provider}`);
      setSupport(
        language
          ? `Document language: ${language}. ${LAB_REVEAL_LANGUAGE_NOTE}`
          : LAB_REVEAL_LANGUAGE_NOTE,
      );
    });
  }, []);

  return (
    <CaptureRevealChrome testID="reveal-5b-lab">
      <View>
        <Text style={styles.headline} testID="reveal-5b-lab-headline">
          {headline}
        </Text>
        <Text style={styles.support} testID="reveal-5b-lab-support">
          {support}
        </Text>
      </View>
      <RevealPrimaryButton
        label={LAB_REVEAL_CONTINUE}
        testID="reveal-5b-lab-continue"
        onPress={() => router.replace(thesisHrefForTag('lab'))}
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
