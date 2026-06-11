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

import { BarrierGrid8, ImprovementBar } from '@/components/conflict';
import { SessionImage } from '@/components/SessionImage';
import { JournalTokens } from '@/constants/journalTokens';
import { TIMELINE_HREF } from '@/constants/routes';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import {
  fetchBarrierInsight,
  fetchStreakPercentile,
  fetchVerdictHistory,
} from '@/lib/conflict-api';
import type { BarrierInsight, VerdictHistoryDay } from '@/lib/conflict-types';
import { verdictTagColor } from '@/lib/conflict-helpers';
import { patientGet } from '@/lib/patient-api';
import { localTodayIso } from '@/lib/routine-day-mode';

type Summary = {
  streak_days?: number;
  baseline_skin_age?: number | null;
  latest_skin_age?: number | null;
  improvement_metrics?: {
    clarity_pct?: number;
    redness_pct?: number;
    skin_age_delta?: number;
  };
};

type CalendarDay = {
  date: string;
  has_media?: boolean;
  completion_score?: number;
  verdict_overall?: string | null;
  barrier_friction_index?: number | null;
  thumbnail_url?: string | null;
};

export default function ProgressScreen() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [improvementMetrics, setImprovementMetrics] = useState<Summary['improvement_metrics'] | null>(null);
  const [percentileCopy, setPercentileCopy] = useState<string | null>(null);
  const [insight, setInsight] = useState<BarrierInsight>(null);
  const [history, setHistory] = useState<VerdictHistoryDay[]>([]);
  const [days, setDays] = useState<CalendarDay[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = localTodayIso();
      const start = new Date(`${today}T12:00:00.000Z`);
      start.setUTCDate(start.getUTCDate() - 7);
      const startIso = start.toISOString().slice(0, 10);

      const [progRes, insightRes, calRes, histRes] = await Promise.all([
        patientGet('/api/patient/home/progress-summary'),
        fetchBarrierInsight().catch(() => null),
        patientGet(
          `/api/patient/journal/calendar-range?start=${startIso}&end=${today}&include_empty_days=1`,
        ).catch(() => ({ days: [] })),
        fetchVerdictHistory(8).catch(() => []),
      ]);

      setSummary(progRes?.summary || null);
      setImprovementMetrics(progRes?.improvement_metrics || null);
      setInsight(insightRes);
      setHistory(histRes);
      const calDays: CalendarDay[] = Array.isArray(calRes?.days) ? calRes.days : [];
      setDays(calDays.slice(-8));

      const streak = Number(progRes?.summary?.streak_days) || 0;
      if (streak > 0) {
        const pct = await fetchStreakPercentile(streak).catch(() => null);
        if (pct?.copy) setPercentileCopy(pct.copy);
      }
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

  const metrics = improvementMetrics;
  const streak = summary?.streak_days ?? 0;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
        <Text style={styles.title}>Your progress</Text>

        {streak > 0 ? (
          <View style={styles.streakBanner}>
            <Text style={styles.streakValue}>🔥 {streak} day streak</Text>
            {percentileCopy ? <Text style={styles.streakSub}>{percentileCopy}</Text> : null}
          </View>
        ) : null}

        <BarrierGrid8 days={history} />

        {insight?.message ? (
          <View style={styles.dipCard}>
            <Text style={styles.dipTitle}>{insight.title || 'What caused the dip'}</Text>
            <Text style={styles.dipBody}>{insight.message}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Improvement metrics</Text>
        {metrics?.clarity_pct != null ? (
          <ImprovementBar label="Clarity" value={metrics.clarity_pct} positiveIsGood />
        ) : null}
        {metrics?.redness_pct != null ? (
          <ImprovementBar label="Redness" value={metrics.redness_pct} positiveIsGood={false} />
        ) : null}
        {metrics?.skin_age_delta != null ? (
          <ImprovementBar
            label="Skin age"
            value={metrics.skin_age_delta}
            unit=" yrs"
            max={5}
            positiveIsGood={false}
          />
        ) : null}
        {metrics?.clarity_pct == null && metrics?.redness_pct == null && metrics?.skin_age_delta == null ? (
          <Text style={styles.emptyMetrics}>Log progress photos to unlock improvement metrics.</Text>
        ) : null}

        <Text style={styles.sectionLabel}>{days.length}-day photo timeline</Text>
        <View style={styles.thumbGrid}>
          {days.map((d, idx) => {
            const logged = (d.completion_score || 0) >= 100 || d.has_media;
            const isToday = d.date === localTodayIso();
            const tagColor = d.verdict_overall
              ? verdictTagColor(d.verdict_overall as 'safe' | 'caution' | 'avoid')
              : null;
            const dayLabel = isToday ? 'Today' : idx === 0 ? 'Day 1' : d.date.slice(8);
            return (
              <Pressable
                key={d.date}
                onPress={() => router.push({ pathname: '/(tabs)/timeline', params: { date: d.date } })}
                style={[styles.thumb, logged && styles.thumbLogged, isToday && styles.thumbToday]}>
                {tagColor ? <View style={[styles.thumbTag, { backgroundColor: tagColor }]} /> : null}
                {d.thumbnail_url ? (
                  <SessionImage uri={d.thumbnail_url} style={styles.thumbImage} contentFit="cover" />
                ) : (
                  <Text style={styles.thumbIcon}>{logged ? '📷' : isToday ? '📸' : '·'}</Text>
                )}
                <View style={styles.dayChip}>
                  <Text style={styles.dayChipText}>{dayLabel}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => router.push(TIMELINE_HREF)}
          style={styles.linkWrap}
          accessibilityRole="button"
          accessibilityLabel="Open journal timeline">
          <Text style={styles.link}>Open journal timeline →</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: JournalTokens.color.cream },
  content: { padding: JournalTokens.spacing.lg, gap: 10 },
  title: { fontFamily: JournalTokens.font.display, fontSize: 28, color: JournalTokens.color.ink },
  streakBanner: {
    backgroundColor: '#FAEEDA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  streakValue: { fontSize: 18, fontWeight: '800', color: '#633806' },
  streakSub: { fontSize: 13, color: '#633806', marginTop: 4 },
  emptyMetrics: { fontSize: 13, color: JournalTokens.color.muted, marginBottom: 8 },
  dipCard: {
    backgroundColor: JournalTokens.color.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: JournalTokens.color.line,
    padding: 14,
    marginTop: 8,
  },
  dipTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  dipBody: { fontSize: 13, color: JournalTokens.color.muted, lineHeight: 20 },
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
    position: 'relative',
  },
  thumbLogged: { backgroundColor: '#eef4ff', opacity: 1 },
  thumbToday: { borderColor: JournalTokens.color.brandAccent, borderWidth: 2, opacity: 1 },
  thumbTag: { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, zIndex: 2 },
  thumbImage: { ...StyleSheet.absoluteFillObject, borderRadius: 10 },
  thumbIcon: { fontSize: 18 },
  dayChip: {
    position: 'absolute',
    bottom: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  dayChipText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  linkWrap: { marginTop: 8 },
  link: { color: JournalTokens.color.brandAccent, fontWeight: '700', fontSize: 14 },
});
