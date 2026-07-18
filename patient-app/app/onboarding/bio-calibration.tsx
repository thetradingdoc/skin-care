import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConsumerPrimaryButton } from '@/components/billing-ui';
import { AppTokens } from '@/constants/appTokens';
import { ConflictTokens } from '@/constants/conflictTokens';
import { JournalTokens } from '@/constants/journalTokens';
import { PROGRESS_HREF } from '@/constants/routes';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { fetchBioProfile, saveBioProfile } from '@/lib/conflict-api';

const CONDITIONS: { id: string; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { id: 'acne', label: 'Acne', icon: 'face' },
  { id: 'rosacea', label: 'Rosacea', icon: 'whatshot' },
  { id: 'hyperpigmentation', label: 'Hyperpigmentation', icon: 'blur-on' },
  { id: 'dark_marks', label: 'Dark marks', icon: 'brightness-3' },
  { id: 'eczema', label: 'Eczema', icon: 'grain' },
  { id: 'sensitive', label: 'Sensitive skin', icon: 'sentiment-dissatisfied' },
  { id: 'barrier_compromised', label: 'Barrier damage', icon: 'shield' },
  { id: 'inflamed', label: 'Inflamed skin', icon: 'local-fire-department' },
  { id: 'dehydrated', label: 'Dehydrated', icon: 'water-drop' },
];

const PRESCRIPTIONS: { id: string; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { id: 'tretinoin', label: 'Tretinoin', icon: 'medication' },
  { id: 'isotretinoin', label: 'Isotretinoin', icon: 'medication' },
  { id: 'adapalene', label: 'Adapalene', icon: 'science' },
];

export default function BioCalibrationScreen() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [conditions, setConditions] = useState<string[]>([]);
  const [prescriptions, setPrescriptions] = useState<string[]>([]);
  const [noneRx, setNoneRx] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchBioProfile()
      .then((profile) => {
        if (!profile) return;
        if (Array.isArray(profile.conditions) && profile.conditions.length) {
          setConditions(profile.conditions);
        }
        if (Array.isArray(profile.prescriptions)) {
          if (profile.prescriptions.length === 0 && profile.profile_complete) {
            setNoneRx(true);
            setPrescriptions([]);
          } else if (profile.prescriptions.length) {
            setPrescriptions(profile.prescriptions);
            setNoneRx(false);
          }
        }
      })
      .catch(() => {});
  }, []);

  const toggle = (list: string[], id: string, setter: (v: string[]) => void) => {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const next = () => {
    if (step === 0 && !conditions.length) {
      setError('Select at least one skin concern.');
      return;
    }
    setError(null);
    setStep((s) => Math.min(2, s + 1));
  };

  const save = async () => {
    if (!conditions.length) {
      setError('Select at least one skin concern.');
      setStep(0);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveBioProfile({
        conditions,
        prescriptions: noneRx ? [] : prescriptions,
        profile_complete: true,
      });
      router.replace(PROGRESS_HREF);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save profile');
    } finally {
      setBusy(false);
    }
  };

  if (checking || !ready) {
    return <SafeAreaView style={styles.root} />;
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>
        <Text style={styles.title}>Calibrate your skin profile</Text>
        <Text style={styles.subtitle}>
          We use this to personalize ingredient conflict checks — not a diagnosis.
        </Text>

        {step === 0 ? (
          <>
            <Text style={styles.section}>Skin concerns</Text>
            <View style={styles.grid}>
              {CONDITIONS.map((c) => {
                const on = conditions.includes(c.id);
                return (
                  <Pressable
                    key={c.id}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => toggle(conditions, c.id, setConditions)}>
                    <MaterialIcons name={c.icon} size={20} color={on ? ConflictTokens.fabBg : '#6B7280'} />
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={styles.section}>Prescription actives</Text>
            <View style={styles.grid}>
              {PRESCRIPTIONS.map((p) => {
                const on = prescriptions.includes(p.id);
                return (
                  <Pressable
                    key={p.id}
                    style={[styles.chip, on && styles.chipOn, noneRx && styles.chipDisabled]}
                    onPress={() => {
                      setNoneRx(false);
                      toggle(prescriptions, p.id, setPrescriptions);
                    }}>
                    <MaterialIcons name={p.icon} size={20} color={on ? ConflictTokens.fabBg : '#6B7280'} />
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{p.label}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                style={[styles.chip, noneRx && styles.chipOn]}
                onPress={() => {
                  setNoneRx(true);
                  setPrescriptions([]);
                }}>
                <MaterialIcons name="block" size={20} color={noneRx ? ConflictTokens.fabBg : '#6B7280'} />
                <Text style={[styles.chipText, noneRx && styles.chipTextOn]}>None</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {step === 2 ? (
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Ready to save</Text>
            <Text style={styles.confirmBody}>
              {conditions.length} concern{conditions.length === 1 ? '' : 's'} selected
              {noneRx ? ' · no prescription actives' : prescriptions.length ? ` · ${prescriptions.length} Rx active(s)` : ''}
            </Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {step < 2 ? (
          <ConsumerPrimaryButton label="Continue" onPress={next} />
        ) : (
          <ConsumerPrimaryButton label={busy ? 'Saving…' : 'Save profile'} onPress={() => void save()} />
        )}
        {step > 0 ? (
          <Pressable onPress={() => setStep((s) => s - 1)}>
            <Text style={styles.back}>Back</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  content: { padding: JournalTokens.spacing.lg, gap: 12 },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D1D5DB' },
  dotActive: { backgroundColor: ConflictTokens.fabBg, width: 20 },
  title: { fontFamily: JournalTokens.font.display, fontSize: 26, color: JournalTokens.color.ink },
  subtitle: { color: JournalTokens.color.muted, lineHeight: 22, marginBottom: 8 },
  section: { fontSize: 14, fontWeight: '700', color: '#374151', marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    width: '48%',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipOn: { borderColor: ConflictTokens.fabBg, backgroundColor: '#F3F4F6' },
  chipDisabled: { opacity: 0.45 },
  chipText: { fontSize: 14, fontWeight: '600', color: '#374151', flex: 1 },
  chipTextOn: { color: ConflictTokens.fabBg },
  confirmCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    gap: 6,
  },
  confirmTitle: { fontSize: 16, fontWeight: '700' },
  confirmBody: { color: JournalTokens.color.muted, lineHeight: 20 },
  back: { textAlign: 'center', color: JournalTokens.color.muted, marginTop: 8 },
  error: { color: '#B91C1C' },
});
