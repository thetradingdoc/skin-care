/**
 * P7.18 — Reveal 5b-skin / Step 19 (v4.1). Post-confirm save acknowledgment.
 * WHAT WE SEE comes from policy-gated draft — not hardcoded efficacy claims.
 */
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { thesisHrefForTag, TRACK_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { aiSuggestionText } from '@/lib/use-capture-confirm';
import { peekPendingCaptureDraft } from '@/lib/pending-capture-draft';

export const SKIN_REVEAL_EYEBROW = 'SAVED';
export const SKIN_REVEAL_TITLE = 'Logged.';
export const SKIN_REVEAL_CONTINUE = 'Continue';
export const SKIN_REVEAL_FIX = 'Not quite — let me fix it';
export const SKIN_REVEAL_WHAT_WE_SEE_K = 'WHAT WE SEE';

export default function Reveal5bSkinScreen() {
  const router = useRouter();
  const [tagline, setTagline] = useState('Skin log');
  const [whatWeSee, setWhatWeSee] = useState(
    "We'll line this up with your next capture of the same spot.",
  );

  useEffect(() => {
    void peekPendingCaptureDraft().then((p) => {
      if (!p?.draft) return;
      const area = String(p.draft.body_area || '').trim();
      const date = String(p.draft.date || '').trim();
      const parts = [area ? `${area} mark` : 'Skin log', date].filter(Boolean);
      setTagline(parts.join(' · '));
      const suggestion = aiSuggestionText(p.draft);
      if (suggestion) {
        setWhatWeSee(
          `${suggestion.replace(/\.$/, '')}. We'll line this up with your next capture of the same spot.`,
        );
      } else if (area) {
        setWhatWeSee(
          `Logged for ${area}. We'll line this up with your next capture of the same spot.`,
        );
      }
    });
  }, []);

  return (
    <SafeAreaView style={styles.root} testID="reveal-5b-skin" edges={['top', 'bottom']}>
      <BackNavHeader
        label="Back"
        testID="reveal-skin-back"
        onBack={() => router.replace(TRACK_HREF as never)}
      />
      <View style={styles.main}>
        <Text style={styles.eyebrow} testID="reveal-skin-eyebrow">
          {SKIN_REVEAL_EYEBROW}
        </Text>
        <Text style={styles.title} testID="reveal-5b-skin-headline">
          {SKIN_REVEAL_TITLE}
        </Text>
        <Text style={styles.tagline} testID="reveal-5b-skin-support">
          {tagline}
        </Text>
        <View style={styles.aiCard} testID="reveal-skin-what-we-see">
          <Text style={styles.aiK}>{SKIN_REVEAL_WHAT_WE_SEE_K}</Text>
          <Text style={styles.aiBody}>{whatWeSee}</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Pressable
          style={styles.primary}
          testID="reveal-5b-skin-yes"
          onPress={() => router.replace(thesisHrefForTag('skin'))}
          accessibilityRole="button"
          accessibilityLabel={SKIN_REVEAL_CONTINUE}>
          <Text style={styles.primaryLabel}>{SKIN_REVEAL_CONTINUE}</Text>
        </Pressable>
        <Pressable
          style={styles.secondary}
          testID="reveal-5b-skin-fix"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={SKIN_REVEAL_FIX}>
          <Text style={styles.secondaryLabel}>{SKIN_REVEAL_FIX}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white, paddingHorizontal: 18 },
  main: { flex: 1, paddingTop: 8 },
  eyebrow: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.7,
    color: V4DesignTokens.color.redDeep,
    marginBottom: 6,
  },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 22,
    color: V4DesignTokens.color.black,
    marginBottom: 6,
  },
  tagline: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    marginBottom: 16,
  },
  aiCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V4DesignTokens.color.line,
    padding: 14,
    backgroundColor: V4DesignTokens.color.white,
  },
  aiK: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: V4DesignTokens.color.red,
    marginBottom: 6,
  },
  aiBody: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 15,
    lineHeight: 22,
    color: V4DesignTokens.color.black,
  },
  footer: { paddingBottom: 8 },
  primary: {
    backgroundColor: V4DesignTokens.color.black,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.white,
  },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: {
    fontFamily: V4DesignTokens.font.bodyMedium,
    fontSize: 15,
    color: V4DesignTokens.color.muted,
  },
});
