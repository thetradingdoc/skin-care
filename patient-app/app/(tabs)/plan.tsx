import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RoutineStepsHero } from '@/components/RoutineStepsHero';
import { JournalTokens } from '@/constants/journalTokens';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { patientGet } from '@/lib/patient-api';
import { localTodayIso } from '@/lib/routine-day-mode';

type PhaseItem = {
  product_name?: string;
  usage_time?: string;
  goal?: string;
};

export default function PlanScreen() {
  const { ready, checking } = useRequirePatientSession();
  const [loading, setLoading] = useState(true);
  const [phaseLabel, setPhaseLabel] = useState<string | null>(null);
  const [phaseExpect, setPhaseExpect] = useState<string | null>(null);
  const [programWeek, setProgramWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(12);
  const [items, setItems] = useState<PhaseItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = localTodayIso();
      const phaseRes = await patientGet(`/api/patient/routine/phase?date=${today}`);
      if (phaseRes?.phase) {
        setProgramWeek(Number(phaseRes.phase.program_week) || 1);
        setPhaseLabel(phaseRes.phase.label || null);
        setPhaseExpect(phaseRes.phase.expect || phaseRes.phase.focus || null);
        setTotalWeeks(Number(phaseRes.phase.total_weeks) || 12);
      }
      setItems(Array.isArray(phaseRes?.items) ? phaseRes.items : []);
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
  expect: { color: JournalTokens.color.muted, lineHeight: 20, marginBottom: 8 },
});
