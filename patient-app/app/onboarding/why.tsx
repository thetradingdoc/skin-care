/**
 * Step 3 — Why are you here (persona picker).
 * Persists concern_id via pending-routine + onboarding storage (pre-auth).
 */
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import {
  CAPTURE_CONSENT_HREF,
} from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { setOnboardingConcernId } from '@/lib/onboarding-storage';
import { setPendingRoutineConcern } from '@/lib/routine-session';

export const WHY_TITLE = 'What are you tracking?';
export const WHY_TAGLINE = "We'll tailor your log and reminders — change anytime in Profile.";

const CAUSE_OPTIONS = ['Acne marks', 'Sun spots', 'Injury or scarring', 'Not sure'] as const;

/** Persona tiles → real concern_id values used by routine template API. */
export const PERSONA_OPTIONS = [
  {
    id: 'hyperpigmentation',
    title: 'Dark marks (post-acne / injury)',
    subtitle: 'Face and body — hyperpigmentation tracking',
  },
  {
    id: 'acne',
    title: 'Active breakouts',
    subtitle: 'Acne tracking',
  },
  {
    id: 'rosacea',
    title: 'Sensitive / reactive skin',
    subtitle: 'Barrier repair, rosacea',
  },
  {
    id: 'general_wellness',
    title: 'General wellness',
    subtitle: 'Just tracking, no specific plan',
  },
] as const;

export default function OnboardingWhyScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<(typeof PERSONA_OPTIONS)[number]['id']>(
    'hyperpigmentation',
  );
  const [cause, setCause] = useState<(typeof CAUSE_OPTIONS)[number]>('Acne marks');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const continueNext = async () => {
    setBusy(true);
    setError(null);
    try {
      await setPendingRoutineConcern(selected);
      await setOnboardingConcernId(selected);
      router.push('/onboarding/meet-kelly' as never);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save your selection.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} testID="screen-onboarding-why" edges={['top', 'bottom']}>
      <BackNavHeader
        label="Back"
        testID="why-back"
        onBack={() => router.replace(CAPTURE_CONSENT_HREF)}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} testID="why-title">
          {WHY_TITLE}
        </Text>
        <Text style={styles.tagline}>{WHY_TAGLINE}</Text>
        {PERSONA_OPTIONS.map((p) => {
          const on = selected === p.id;
          return (
            <Pressable
              key={p.id}
              testID={`persona-${p.id}`}
              onPress={() => setSelected(p.id)}
              style={[styles.tile, on && styles.tileOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}>
              <Text style={styles.tileIc}>✦</Text>
              <View style={styles.tileText}>
                <Text style={styles.tileTitle}>{p.title}</Text>
                <Text style={styles.tileSub}>{p.subtitle}</Text>
              </View>
            </Pressable>
          );
        })}
        {selected === 'hyperpigmentation' ? (
          <View style={styles.causeBlock} testID="why-cause-chips">
            <Text style={styles.causeTitle}>What's the cause? (optional)</Text>
            <Text style={styles.causeSub}>Personalizes notes. Your protocol stays the same either way.</Text>
            <View style={styles.causeChips}>
              {CAUSE_OPTIONS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCause(c)}
                  style={[styles.causeChip, cause === c && styles.causeChipOn]}>
                  <Text style={[styles.causeChipText, cause === c && styles.causeChipTextOn]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        {error ? (
          <Text style={styles.error} testID="why-error">
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={[styles.cta, busy && styles.ctaDisabled]}
          testID="why-continue"
          disabled={busy}
          onPress={() => void continueNext()}>
          <Text style={styles.ctaLabel}>{busy ? 'Saving…' : 'Continue'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white, paddingHorizontal: 18 },
  content: { paddingTop: 8, paddingBottom: 24, gap: 10 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 22,
    color: V4DesignTokens.color.black,
  },
  tagline: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    marginBottom: 8,
  },
  causeBlock: { marginTop: 8, gap: 6 },
  causeTitle: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 14,
    color: V4DesignTokens.color.wine,
  },
  causeSub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    color: V4DesignTokens.color.muted,
    marginBottom: 4,
  },
  causeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  causeChip: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(61,0,11,0.06)',
    borderWidth: 1.5,
    borderColor: V4DesignTokens.color.line,
  },
  causeChipOn: {
    backgroundColor: V4DesignTokens.color.wine,
    borderColor: V4DesignTokens.color.wine,
  },
  causeChipText: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 12,
    color: V4DesignTokens.color.wine,
  },
  causeChipTextOn: { color: V4DesignTokens.color.white },
  tile: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: V4DesignTokens.color.line,
  },
  tileOn: {
    borderColor: V4DesignTokens.color.red,
    backgroundColor: '#FFF5F5',
  },
  tileIc: { fontSize: 16, color: V4DesignTokens.color.red, marginTop: 2 },
  tileText: { flex: 1 },
  tileTitle: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 15,
    color: V4DesignTokens.color.black,
  },
  tileSub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
    marginTop: 2,
  },
  error: { color: V4DesignTokens.color.red, fontSize: 13 },
  footer: { paddingBottom: 16 },
  cta: {
    backgroundColor: V4DesignTokens.color.black,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.6 },
  ctaLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.white,
  },
});
