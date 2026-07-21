/**
 * PIH v2 — Meet Kelly beat (design ID: o4). Snapshot-coach framing — no memory claim.
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ONBOARDING_PLAN_PREVIEW_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';

export const MEET_KELLY_QUOTE = "I'll be checking in on you";
export const MEET_KELLY_BODY =
  'Kelly lives on your Progress tab. Each note is based on today’s confirmed records — not a chat history.';

export default function MeetKellyScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.root} testID="screen-meet-kelly" edges={['top', 'bottom']}>
      <View style={styles.body}>
        <Text style={styles.quote}>"{MEET_KELLY_QUOTE}"</Text>
        <Text style={styles.attrib}>— Kelly</Text>
        <Text style={styles.sub}>{MEET_KELLY_BODY}</Text>
      </View>
      <View style={styles.footer}>
        <Pressable
          style={styles.cta}
          testID="meet-kelly-continue"
          onPress={() => router.push(ONBOARDING_PLAN_PREVIEW_HREF)}>
          <Text style={styles.ctaLabel}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.ground },
  body: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center', gap: 10 },
  quote: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 20,
    color: V4DesignTokens.color.wine,
    textAlign: 'center',
  },
  attrib: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 12,
    color: V4DesignTokens.color.green,
  },
  sub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
    marginTop: 8,
  },
  footer: { padding: 22 },
  cta: {
    backgroundColor: V4DesignTokens.color.white,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: V4DesignTokens.color.line,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 15,
    color: V4DesignTokens.color.wine,
  },
});
