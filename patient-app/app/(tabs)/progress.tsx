import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JournalTokens } from '@/constants/journalTokens';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { patientGet } from '@/lib/patient-api';
import { localTodayIso } from '@/lib/routine-day-mode';

type Summary = {
  streak_days?: number;
  baseline_skin_age?: number | null;
  latest_skin_age?: number | null;
  goal_skin_age?: number | null;
  skin_age_trend?: { estimate: number; created_at: string; source: string }[];
  program_week?: number | null;
  total_weeks?: number | null;
  phase_label?: string | null;
};

type CalendarDay = {
  date: string;
  has_media?: boolean;
  completion_score?: number;
};

export default function ProgressScreen() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [concernLabel, setConcernLabel] = useState<string | null>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [days, setDays] = useState<CalendarDay[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = localTodayIso();
      const start = new Date(`${today}T12:00:00.000Z`);
      start.setUTCDate(start.getUTCDate() - 7);
      const startIso = start.toISOString().slice(0, 10);

      const [progRes, insightRes, calRes] = await Promise.all([
        patientGet('/api/patient/home/progress-summary'),
        patientGet('/api/patient/home/weekly-insight').catch(() => ({ insight: null })),
        patientGet(
          `/api/patient/journal/calendar-range?start=${startIso}&end=${today}&include_empty_days=1`,
        ).catch(() => ({ days: [] })),
      ]);

      setSummary(progRes?.summary || null);
      setConcernLabel(progRes?.template?.concern_id?.replace(/_/g, ' ') || null);
      setInsight(insightRes?.insight || null);
      const calDays: CalendarDay[] = Array.isArray(calRes?.days) ? calRes.days : [];
      setDays(calDays.slice(-8));
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

  const week = summary?.program_week || 1;
  const total = summary?.total_weeks || 12;
  const baseline = summary?.baseline_skin_age;
  const latest = summary?.latest_skin_age ?? baseline;
  const goal = summary?.goal_skin_age;
  const trend = summary?.skin_age_trend || [];
  const ageDelta =
    baseline != null && latest != null && latest !== baseline ? latest - baseline : null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
        <Text style={styles.title}>Your progress</Text>
        <Text style={styles.subtitle}>
          Week {week} of {total}
          {concernLabel ? ` · ${concernLabel}` : ''}
        </Text>

        <View style={styles.metricRow}>
          <View style={[styles.metricCard, styles.metricCardBlue]}>
            <Text style={styles.metricLabel}>Skin age</Text>
            <Text style={styles.metricValue}>
              {baseline != null ? baseline : '—'}
              {latest != null && baseline != null && latest !== baseline ? (
                <Text style={styles.metricGoal}> → {latest}</Text>
              ) : goal != null && baseline != null && goal !== baseline ? (
                <Text style={styles.metricGoal}> → {goal}</Text>
              ) : null}
            </Text>
            <Text style={styles.metricHint}>
              {ageDelta != null
                ? `${ageDelta > 0 ? '+' : ''}${ageDelta} since baseline`
                : 'Goal'}
            </Text>
          </View>
          <View style={[styles.metricCard, styles.metricCardGreen]}>
            <Text style={[styles.metricLabel, styles.metricLabelGreen]}>Streak</Text>
            <Text style={[styles.metricValue, styles.metricValueGreen]}>
              {summary?.streak_days ?? 0}
              <Text style={styles.metricUnit}> days</Text>
            </Text>
            <Text style={[styles.metricHint, styles.metricLabelGreen]}>Keep it up</Text>
          </View>
        </View>

        {trend.length > 1 ? (
          <View style={styles.trendCard}>
            <Text style={styles.trendTitle}>Skin age trend</Text>
            <Text style={styles.trendBody}>
              {trend.map((t) => Math.round(t.estimate)).join(' → ')}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>{days.length}-day photo timeline</Text>
        <View style={styles.thumbGrid}>
          {days.map((d) => {
            const logged = (d.completion_score || 0) >= 100 || d.has_media;
            const isToday = d.date === localTodayIso();
            return (
              <Pressable
                key={d.date}
                onPress={() => router.push({ pathname: '/(tabs)/timeline', params: { date: d.date } })}
                style={[styles.thumb, logged && styles.thumbLogged, isToday && styles.thumbToday]}>
                <Text style={styles.thumbIcon}>{logged ? '📷' : isToday ? '📸' : '·'}</Text>
              </Pressable>
            );
          })}
        </View>

        {insight ? (
          <View style={styles.insightCard}>
            <Text style={styles.insightTitle}>AI insight</Text>
            <Text style={styles.insightBody}>{insight}</Text>
          </View>
        ) : null}

        <Pressable onPress={() => router.push('/(tabs)/timeline')} style={styles.linkWrap}>
          <Text style={styles.link}>Open full timeline →</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: JournalTokens.color.cream },
  content: { padding: JournalTokens.spacing.lg, gap: 10 },
  title: { fontFamily: JournalTokens.font.display, fontSize: 28, color: JournalTokens.color.ink },
  subtitle: { color: JournalTokens.color.muted, marginBottom: 8 },
  metricRow: { flexDirection: 'row', gap: 8 },
  metricCard: { flex: 1, borderRadius: 12, padding: 12 },
  metricCardBlue: { backgroundColor: '#eef4ff' },
  metricCardGreen: { backgroundColor: '#eaf3de' },
  metricLabel: { fontSize: 11, color: JournalTokens.color.brandAccent, marginBottom: 4 },
  metricLabelGreen: { color: '#0f6e56' },
  metricValue: {
    fontFamily: JournalTokens.font.display,
    fontSize: 22,
    fontWeight: '700',
    color: JournalTokens.color.ink,
  },
  metricValueGreen: { color: '#085041' },
  metricGoal: { fontSize: 14, color: JournalTokens.color.brandAccent },
  metricUnit: { fontSize: 14, fontWeight: '400' },
  metricHint: { fontSize: 11, color: JournalTokens.color.brandAccent, marginTop: 2 },
  sectionLabel: { fontSize: 12, color: JournalTokens.color.muted, marginTop: 8 },
  thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  thumb: {
    width: '22%',
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: JournalTokens.color.card,
    borderWidth: 1,
    borderColor: JournalTokens.color.line,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  thumbLogged: { backgroundColor: '#eef4ff', opacity: 1 },
  thumbToday: { borderColor: JournalTokens.color.brandAccent, borderWidth: 2, opacity: 1 },
  thumbIcon: { fontSize: 18 },
  trendCard: {
    backgroundColor: '#f8f4ff',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  trendTitle: { fontSize: 12, fontWeight: '700', color: JournalTokens.color.ink, marginBottom: 4 },
  trendBody: { fontSize: 14, color: JournalTokens.color.brandAccent, fontWeight: '600' },
  insightCard: {
    backgroundColor: JournalTokens.color.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: JournalTokens.color.line,
    padding: 12,
    marginTop: 4,
  },
  insightTitle: { fontSize: 12, fontWeight: '700', color: JournalTokens.color.ink, marginBottom: 6 },
  insightBody: { fontSize: 13, color: JournalTokens.color.muted, lineHeight: 20 },
  linkWrap: { marginTop: 8 },
  link: { color: JournalTokens.color.brandAccent, fontWeight: '700', fontSize: 14 },
});
