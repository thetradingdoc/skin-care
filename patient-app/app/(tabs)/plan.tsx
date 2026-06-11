import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RoutineStepsHero } from '@/components/RoutineStepsHero';
import { JournalTokens } from '@/constants/journalTokens';
import { SCAN_HREF } from '@/constants/routes';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { fetchEvaluateLineup } from '@/lib/conflict-api';
import type { EvaluateResult } from '@/lib/conflict-types';
import { bfiColor } from '@/lib/conflict-helpers';
import { patientGet } from '@/lib/patient-api';
import { localTodayIso } from '@/lib/routine-day-mode';

type PhaseItem = {
  product_name?: string;
  usage_time?: string;
  goal?: string;
};

export default function PlanScreen() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [phaseLabel, setPhaseLabel] = useState<string | null>(null);
  const [phaseExpect, setPhaseExpect] = useState<string | null>(null);
  const [programWeek, setProgramWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(12);
  const [items, setItems] = useState<PhaseItem[]>([]);
  const [evaluate, setEvaluate] = useState<EvaluateResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = localTodayIso();
      const [phaseRes, evalRes] = await Promise.all([
        patientGet(`/api/patient/routine/phase?date=${today}`),
        fetchEvaluateLineup().catch(() => null),
      ]);
      if (phaseRes?.phase) {
        setProgramWeek(Number(phaseRes.phase.program_week) || 1);
        setPhaseLabel(phaseRes.phase.label || null);
        setPhaseExpect(phaseRes.phase.expect || phaseRes.phase.focus || null);
        setTotalWeeks(Number(phaseRes.phase.total_weeks) || 12);
      }
      setItems(Array.isArray(phaseRes?.items) ? phaseRes.items : []);
      setEvaluate(evalRes);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  if (checking || !ready) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={JournalTokens.color.accent} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  const bfi = evaluate?.barrier_friction_index ?? null;
  const conflicts = evaluate?.conflicts?.length ?? 0;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
        <Text style={styles.title}>Your plan</Text>
        <Text style={styles.subtitle}>
          Week {programWeek} of {totalWeeks}
          {phaseLabel ? ` · ${phaseLabel}` : ''}
        </Text>

        {evaluate ? (
          <Pressable style={styles.conflictHeader} onPress={() => router.push(SCAN_HREF)}>
            <View>
              <Text style={styles.conflictTitle}>Routine compatibility</Text>
              <Text style={styles.conflictSub}>
                {conflicts} conflict{conflicts === 1 ? '' : 's'} · BFI{' '}
                {bfi != null ? (
                  <Text style={{ color: bfiColor(bfi), fontWeight: '700' }}>{Math.round(bfi)}</Text>
                ) : (
                  '—'
                )}
              </Text>
            </View>
            <Text style={styles.conflictLink}>Scan →</Text>
          </Pressable>
        ) : null}

        {phaseExpect ? <Text style={styles.expect}>{phaseExpect}</Text> : null}
        {items.length ? <RoutineStepsHero steps={items} alwaysExpanded /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: JournalTokens.color.cream },
  content: { padding: JournalTokens.spacing.lg, gap: 10 },
  title: { fontFamily: JournalTokens.font.display, fontSize: 28, color: JournalTokens.color.ink },
  subtitle: { color: JournalTokens.color.muted },
  conflictHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: JournalTokens.color.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: JournalTokens.color.line,
    padding: 14,
    marginVertical: 8,
  },
  conflictTitle: { fontWeight: '700', fontSize: 14 },
  conflictSub: { fontSize: 13, color: JournalTokens.color.muted, marginTop: 2 },
  conflictLink: { color: JournalTokens.color.brandAccent, fontWeight: '700' },
  expect: { color: JournalTokens.color.muted, lineHeight: 20, marginBottom: 8 },
});
