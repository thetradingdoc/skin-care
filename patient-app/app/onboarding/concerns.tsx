import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConsumerPrimaryButton } from '@/components/billing-ui';
import { AppTokens } from '@/constants/appTokens';
import { JournalTokens } from '@/constants/journalTokens';
import { patientPostPublic, publicGet } from '@/lib/patient-api';
import {
  getFaceRead,
  setMatchJson,
  setOnboardingConcernId,
} from '@/lib/onboarding-storage';
import { ONBOARDING_SIGNUP_HREF } from '@/constants/routes';

type ConcernRow = { id: string; label: string };

const MAX_SELECTED = 2;
const DEFAULT_CONCERN = 'anti_aging';

export default function OnboardingConcernsScreen() {
  const router = useRouter();
  const [concerns, setConcerns] = useState<ConcernRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await publicGet('/api/public/routines/concerns');
        const list: ConcernRow[] = Array.isArray(data?.concerns) ? data.concerns : [];
        setConcerns(list);
        if (list.length) setSelected([list[0].id]);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Could not load concerns.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SELECTED) return [...prev.slice(1), id];
      return [...prev, id];
    });
  }, []);

  const continueNext = useCallback(async () => {
    setBusy(true);
    setError(null);
    const primary = selected[0] || DEFAULT_CONCERN;
    const secondary = selected.slice(1);
    try {
      await setOnboardingConcernId(primary);
      const faceRead = await getFaceRead();
      try {
        const match = await patientPostPublic('/api/public/funnel/match', {
          user_goal: 'track_program',
          face_read: faceRead,
          concern_chip: primary,
          concern_chips: selected.length ? selected : [DEFAULT_CONCERN],
          secondary_concern_ids: secondary,
        });
        await setMatchJson(match?.match || match || null);
      } catch {
        await setMatchJson(null);
      }
      router.push(ONBOARDING_SIGNUP_HREF);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }, [router, selected]);

  const skip = useCallback(async () => {
    await setOnboardingConcernId(DEFAULT_CONCERN);
    router.push(ONBOARDING_SIGNUP_HREF);
  }, [router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={JournalTokens.color.accent} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>What should we focus on?</Text>
        <Text style={styles.subtitle}>Pick up to two. We&apos;ll personalize your 12-week track.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.chips}>
          {concerns.map((c) => {
            const active = selected.includes(c.id);
            return (
              <Pressable
                key={c.id}
                onPress={() => toggle(c.id)}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityRole="button"
                accessibilityLabel={c.label}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <ConsumerPrimaryButton
          label={busy ? 'Saving…' : 'Continue'}
          onPress={() => void continueNext()}
        />
        <Pressable
          onPress={() => void skip()}
          style={styles.skipBtn}
          accessibilityRole="button"
          accessibilityLabel="Not sure — skip">
          <Text style={styles.skipText}>Not sure — skip</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  content: { padding: JournalTokens.spacing.lg, gap: 14 },
  title: { fontSize: 26, fontWeight: '700', color: JournalTokens.color.ink, fontFamily: JournalTokens.font.display },
  subtitle: { color: JournalTokens.color.muted, lineHeight: 22, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 8 },
  chip: {
    borderWidth: 1,
    borderColor: JournalTokens.color.line,
    borderRadius: JournalTokens.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: JournalTokens.color.card,
  },
  chipActive: {
    borderColor: JournalTokens.color.accent,
    backgroundColor: '#e0f7fa',
  },
  chipText: { color: JournalTokens.color.ink, fontWeight: '600', fontSize: 14 },
  chipTextActive: { color: JournalTokens.color.ink },
  error: { color: JournalTokens.color.danger, fontSize: 14 },
  skipBtn: { alignItems: 'center', paddingVertical: 12 },
  skipText: { color: JournalTokens.color.muted, fontWeight: '600', fontSize: 14 },
});
