/**
 * P7.18 — Reveal 5b-skin (pending confirm, not asserted finding).
 * Headline comes from policy-gated ai_suggestion in the draft — not hardcoded copy.
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
import { aiSuggestionText } from '@/lib/use-capture-confirm';
import { peekPendingCaptureDraft } from '@/lib/pending-capture-draft';

export const SKIN_REVEAL_SUPPORT =
  "this is your day 1 — nothing to compare yet. we'll track it from here.";
export const SKIN_REVEAL_YES = "Yes, that's right";
export const SKIN_REVEAL_FIX = 'Not quite — let me fix it';

export default function Reveal5bSkinScreen() {
  const router = useRouter();
  const [headline, setHeadline] = useState('Does this match what you see?');

  useEffect(() => {
    void peekPendingCaptureDraft().then((p) => {
      if (!p?.draft) return;
      const area = String(p.draft.body_area || '').trim();
      const suggestion = aiSuggestionText(p.draft);
      if (suggestion) {
        const withArea = area
          ? `${suggestion.replace(/\.$/, '')} on your ${area} — does that match what you see?`
          : `${suggestion.replace(/\.$/, '')} — does that match what you see?`;
        setHeadline(withArea);
      } else if (area) {
        setHeadline(`We noticed something on your ${area} — does that match what you see?`);
      }
    });
  }, []);

  return (
    <CaptureRevealChrome testID="reveal-5b-skin">
      <View>
        <Text style={styles.headline} testID="reveal-5b-skin-headline">
          {headline}
        </Text>
        <Text style={styles.support} testID="reveal-5b-skin-support">
          {SKIN_REVEAL_SUPPORT}
        </Text>
      </View>
      <View>
        <RevealPrimaryButton
          label={SKIN_REVEAL_YES}
          testID="reveal-5b-skin-yes"
          onPress={() => router.replace(thesisHrefForTag('skin'))}
        />
        <RevealSecondaryButton
          label={SKIN_REVEAL_FIX}
          testID="reveal-5b-skin-fix"
          onPress={() => router.back()}
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
  support: {
    fontSize: 16,
    lineHeight: 24,
    color: AppTokens.color.muted,
  },
});
