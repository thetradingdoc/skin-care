/**
 * TOUCH-040/041/102 — Screen 8 Severity sheet.
 */
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppTokens } from '@/constants/appTokens';
import { CHECK_HREF } from '@/constants/routes';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { getAdvancedSeverityEnabled } from '@/lib/advanced-severity-pref';
import { patchJournalDailyEntry, postJournalDailyPhoto } from '@/lib/journal-api';
import { patientGet, patientPatch } from '@/lib/patient-api';
import { localTodayIso } from '@/lib/routine-day-mode';
import { scoreToLevel, SEVERITY_LEVELS, type CalmFlag, type SeverityLevel } from '@/lib/severity-ranks';

export default function SeverityScreen() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const params = useLocalSearchParams<{ uri?: string; date?: string }>();
  const entryDate =
    typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : localTodayIso();
  const photoUri = typeof params.uri === 'string' ? params.uri : null;

  const [dry, setDry] = useState<SeverityLevel | null>(null);
  const [breakout, setBreakout] = useState<SeverityLevel | null>(null);
  const [calm, setCalm] = useState<CalmFlag | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [dryScore, setDryScore] = useState(5);
  const [breakScore, setBreakScore] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    void (async () => {
      const adv = await getAdvancedSeverityEnabled();
      setAdvanced(adv);
      try {
        const y = await patientGet('/api/patient/journal/severity/yesterday');
        if (y?.severity) {
          if (y.severity.dryness_level) setDry(y.severity.dryness_level);
          if (y.severity.breakout_level) setBreakout(y.severity.breakout_level);
          if (y.severity.calm_flag) setCalm(y.severity.calm_flag);
          if (adv && y.severity.dryness_score) setDryScore(Number(y.severity.dryness_score));
          if (adv && y.severity.breakout_score) setBreakScore(Number(y.severity.breakout_score));
          setPrefilled(true);
        }
      } catch {
        /* no yesterday */
      }
    })();
  }, []);

  const onDone = async () => {
    const dryness_level = advanced ? scoreToLevel(dryScore) || dry : dry;
    const breakout_level = advanced ? scoreToLevel(breakScore) || breakout : breakout;
    if (!dryness_level || !breakout_level || !calm) {
      setError('Pick dry, breakout-y, and calm.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (photoUri) {
        await postJournalDailyPhoto({ photoUri, entryDate });
      }
      await patientPatch('/api/patient/journal/daily-entry', {
        entry_date: entryDate,
        dryness_level,
        breakout_level,
        calm_flag: calm,
        dryness_score: advanced ? dryScore : null,
        breakout_score: advanced ? breakScore : null,
        advanced_severity: advanced,
        source: 'check_camera',
      });
      router.replace(CHECK_HREF);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  if (checking || !ready) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={AppTokens.color.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Severity', headerShown: false }} />
      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.title} testID="severity-title">
          How&apos;s it feeling?
        </Text>
        {prefilled ? <Text style={styles.hint}>Prefilling yesterday&apos;s picks</Text> : null}
        {photoUri ? <Image source={{ uri: photoUri }} style={styles.thumb} /> : null}

        {advanced ? (
          <>
            <AxisScore label="dry" value={dryScore} onChange={setDryScore} />
            <AxisScore label="breakout-y" value={breakScore} onChange={setBreakScore} />
          </>
        ) : (
          <>
            <AxisChips label="dry" value={dry} onChange={setDry} />
            <AxisChips label="breakout-y" value={breakout} onChange={setBreakout} />
          </>
        )}

        <Text style={styles.axisLabel}>calm</Text>
        <View style={styles.row}>
          {(['yes', 'no'] as CalmFlag[]).map((c) => (
            <Pressable
              key={c}
              style={[styles.chip, calm === c ? styles.chipOn : null]}
              onPress={() => setCalm(c)}
              testID={`calm-${c}`}>
              <Text style={[styles.chipText, calm === c ? styles.chipTextOn : null]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={styles.cta}
          disabled={busy}
          onPress={() => void onDone()}
          testID="severity-done">
          <Text style={styles.ctaText}>{busy ? 'Saving…' : 'Done'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function AxisChips({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SeverityLevel | null;
  onChange: (v: SeverityLevel) => void;
}) {
  return (
    <View style={styles.axis}>
      <Text style={styles.axisLabel}>{label}</Text>
      <View style={styles.row}>
        {SEVERITY_LEVELS.map((l) => (
          <Pressable
            key={l}
            style={[styles.chip, value === l ? styles.chipOn : null]}
            onPress={() => onChange(l)}
            testID={`${label}-${l}`}>
            <Text style={[styles.chipText, value === l ? styles.chipTextOn : null]}>
              {l === 'a_lot' ? 'a lot' : l}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function AxisScore({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={styles.axis}>
      <Text style={styles.axisLabel}>
        {label} · {value}/10
      </Text>
      <View style={styles.row}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <Pressable
            key={n}
            style={[styles.scoreChip, value === n ? styles.chipOn : null]}
            onPress={() => onChange(n)}
            testID={`${label}-score-${n}`}>
            <Text style={[styles.chipText, value === n ? styles.chipTextOn : null]}>{n}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  inner: { padding: AppTokens.spacing.lg, gap: 14 },
  title: {
    fontFamily: AppTokens.font.display,
    fontSize: 26,
    color: AppTokens.color.ink,
  },
  hint: { fontSize: 12, color: AppTokens.color.muted },
  thumb: { width: '100%', height: 160, borderRadius: 12, backgroundColor: '#e9e5dd' },
  axis: { gap: 8 },
  axisLabel: {
    fontFamily: AppTokens.font.body,
    fontSize: 14,
    color: AppTokens.color.ink,
    fontWeight: '600',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppTokens.color.line,
    borderRadius: AppTokens.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scoreChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppTokens.color.line,
    borderRadius: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: AppTokens.color.fabBg, borderColor: AppTokens.color.fabBg },
  chipText: { fontSize: 13, color: AppTokens.color.ink },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  error: { color: AppTokens.color.danger },
  cta: {
    marginTop: 12,
    backgroundColor: AppTokens.color.fabBg,
    borderRadius: AppTokens.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
