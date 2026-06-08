import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/billing-ui';
import { JournalTokens } from '@/constants/journalTokens';
import {
  getConfirmedAge,
  getFaceRead,
  setConfirmedAge,
} from '@/lib/onboarding-storage';
import { ONBOARDING_CONCERNS_HREF } from '@/constants/routes';

export default function OnboardingRevealScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [editingAge, setEditingAge] = useState(false);
  const [ageInput, setAgeInput] = useState('');
  const [confirmedAge, setConfirmedAgeState] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      const [fr, confirmed] = await Promise.all([getFaceRead(), getConfirmedAge()]);
      if (!fr?.apparent_age_estimate) {
        router.replace(ONBOARDING_CONCERNS_HREF);
        return;
      }
      setEstimate(fr.apparent_age_estimate);
      setConfirmedAgeState(confirmed);
      if (confirmed) setAgeInput(String(confirmed));
      setLoading(false);
    })();
  }, [router]);

  const continueNext = useCallback(() => {
    router.push(ONBOARDING_CONCERNS_HREF);
  }, [router]);

  const saveAge = useCallback(async () => {
    const n = Number(ageInput);
    if (!Number.isFinite(n) || n < 13 || n > 99) return;
    await setConfirmedAge(n);
    setConfirmedAgeState(n);
    setEditingAge(false);
  }, [ageInput]);

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={JournalTokens.color.accent} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  const displayAge = estimate ?? 30;
  const delta =
    confirmedAge != null && estimate != null ? confirmedAge - estimate : null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <Text style={styles.kicker}>Your skin age estimate</Text>
        <Text style={styles.number}>{displayAge}</Text>
        <Text style={styles.unit}>years</Text>

        {delta != null ? (
          <Text style={styles.compare}>
            {delta === 0
              ? 'Matches your real age'
              : delta > 0
                ? `${delta} years above your real age`
                : `${Math.abs(delta)} years below your real age`}
          </Text>
        ) : null}

        {editingAge ? (
          <View style={styles.ageEdit}>
            <Text style={styles.label}>Your real age (optional)</Text>
            <TextInput
              value={ageInput}
              onChangeText={setAgeInput}
              keyboardType="number-pad"
              placeholder="32"
              style={styles.input}
            />
            <PrimaryButton label="Save" onPress={() => void saveAge()} />
          </View>
        ) : (
          <Pressable onPress={() => setEditingAge(true)} style={styles.linkBtn}>
            <Text style={styles.link}>
              {confirmedAge ? `Real age: ${confirmedAge} · Edit` : 'Add your real age for comparison'}
            </Text>
          </Pressable>
        )}

        <Text style={styles.body}>
          This is a wellness estimate from your photo — not a diagnosis. Track daily to see change over time.
        </Text>

        <PrimaryButton label="Continue" onPress={continueNext} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: JournalTokens.color.cream },
  content: {
    flex: 1,
    padding: JournalTokens.spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  kicker: { color: JournalTokens.color.muted, fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  number: {
    fontSize: 88,
    fontWeight: '700',
    color: JournalTokens.color.ink,
    fontFamily: JournalTokens.font.display,
    lineHeight: 96,
  },
  unit: { fontSize: 18, color: JournalTokens.color.muted, marginBottom: 12 },
  compare: { color: JournalTokens.color.terracotta, fontWeight: '600', fontSize: 15, marginBottom: 8 },
  body: { color: JournalTokens.color.muted, textAlign: 'center', lineHeight: 22, marginVertical: 16, paddingHorizontal: 12 },
  label: { fontWeight: '600', color: JournalTokens.color.ink, alignSelf: 'flex-start' },
  input: {
    borderWidth: 1,
    borderColor: JournalTokens.color.line,
    borderRadius: JournalTokens.radius.md,
    padding: 14,
    fontSize: 16,
    backgroundColor: JournalTokens.color.card,
    width: '100%',
  },
  ageEdit: { width: '100%', gap: 10, marginBottom: 8 },
  linkBtn: { paddingVertical: 8 },
  link: { color: JournalTokens.color.accent, fontWeight: '600', fontSize: 14 },
});
