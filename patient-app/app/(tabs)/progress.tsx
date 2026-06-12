import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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
import { EmptyStateCard, SectionLabel, SpotRowCard } from '@/components/v3';
import { SessionImage } from '@/components/SessionImage';
import { AppTokens } from '@/constants/appTokens';
import { HOME_HREF, spotHref, TRACK_HREF } from '@/constants/routes';
import { listSpots, spotStatusLabel, type Spot } from '@/lib/spot-store';
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
  const [spots, setSpots] = useState<Spot[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = localTodayIso();
      const start = new Date(`${today}T12:00:00.000Z`);
      start.setUTCDate(start.getUTCDate() - 7);
      const startIso = start.toISOString().slice(0, 10);

      const [progRes, insightRes, calRes, histRes, spotList] = await Promise.all([
        patientGet('/api/patient/home/progress-summary'),
        fetchBarrierInsight().catch(() => null),
        patientGet(
          `/api/patient/journal/calendar-range?start=${startIso}&end=${today}&include_empty_days=1`,
        ).catch(() => ({ days: [] })),
        fetchVerdictHistory(8).catch(() => []),
        listSpots(),
      ]);
      setSpots(spotList);

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
        <ActivityIndicator color={AppTokens.color.accent} style={{ marginTop: 48 }} />
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
        <View style={styles.headerRow}>
          <Text style={styles.title}>Your progress</Text>
          {streak > 0 ? <Text style={styles.headerMeta}>{streak} days</Text> : null}
        </View>

        {streak > 0 ? (
          <View style={styles.streakRow}>
            <Text style={styles.streakNumber}>{streak}</Text>
            <View style={styles.streakCopy}>
              <Text style={styles.streakTitle}>Day streak</Text>
              {percentileCopy ? <Text style={styles.streakSub}>{percentileCopy}</Text> : null}
            </View>
            <MaterialIcons name="local-fire-department" size={22} color={AppTokens.color.barrierOk} />
          </View>
        ) : (
          <EmptyStateCard
            title="Start your photo streak"
            body="Take a daily progress photo on Home or log a spot on Track to build your progress story."
            ctaLabel="Take today's photo"
            onCta={() => router.push(`${HOME_HREF}?photo=1` as typeof HOME_HREF)}
          />
        )}

        <SectionLabel>Barrier score — last 8 days</SectionLabel>
        <BarrierGrid8 days={history} />

        {insight?.message ? (
          <View style={styles.dipCard}>
            <Text style={styles.dipTitle}>{insight.title || 'What caused the dip'}</Text>
            {insight.drop_points != null ? (
              <Text style={styles.dipPoints}>Barrier dropped {insight.drop_points} points</Text>
            ) : null}
            <Text style={styles.dipBody}>{insight.message}</Text>
            {insight.pattern_count != null && insight.pattern_count > 1 ? (
              <Text style={styles.dipPattern}>Seen {insight.pattern_count} times</Text>
            ) : null}
          </View>
        ) : null}

        <SectionLabel>Skin improvements</SectionLabel>
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

        {days.length > 0 ? (
          <>
            <SectionLabel>{`${days.length}-day photo timeline`}</SectionLabel>
            <View style={styles.thumbGrid}>
              {days.map((d, idx) => {
                const logged = (d.completion_score || 0) >= 100 || d.has_media;
                const isToday = d.date === localTodayIso();
                const tagColor = d.verdict_overall
                  ? verdictTagColor(d.verdict_overall as 'safe' | 'caution' | 'avoid')
                  : null;
                const dayLabel = isToday ? 'Today' : idx === 0 ? 'Day 1' : d.date.slice(8);
                return (
                  <View key={d.date} style={styles.thumbCol}>
                    <Pressable
                      onPress={() =>
                        router.push(`${HOME_HREF}?date=${d.date}` as typeof HOME_HREF)
                      }
                      style={[
                        styles.thumb,
                        logged ? styles.thumbLogged : styles.thumbEmpty,
                        isToday && styles.thumbToday,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${dayLabel}`}>
                      {tagColor && logged ? (
                        <View style={[styles.thumbTag, { backgroundColor: tagColor }]}>
                          <Text style={styles.thumbTagText}>{dayLabel}</Text>
                        </View>
                      ) : null}
                      {d.thumbnail_url ? (
                        <SessionImage uri={d.thumbnail_url} style={styles.thumbImage} contentFit="cover" />
                      ) : logged ? (
                        <MaterialIcons name="photo-camera" size={18} color="rgba(255,255,255,0.45)" />
                      ) : null}
                    </Pressable>
                    <Text style={styles.thumbDayLabel}>{dayLabel}</Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        <SectionLabel>Spot tracking</SectionLabel>
        {spots.length === 0 ? (
          <EmptyStateCard
            title="No spots tracked yet"
            body="Photograph a mole or mark on the Track tab. We'll help you watch it over time."
            ctaLabel="Track a spot"
            onCta={() => router.push(TRACK_HREF)}
          />
        ) : (
          spots.map((spot) => (
            <SpotRowCard
              key={spot.id}
              spot={spot}
              statusLabel={spotStatusLabel(spot)}
              onPress={() => router.push(spotHref(spot.id))}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  content: { padding: AppTokens.spacing.lg, gap: 10, paddingBottom: 100 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: { fontSize: 14, fontWeight: '600', color: AppTokens.color.ink },
  headerMeta: { fontSize: 11, color: AppTokens.color.muted },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: AppTokens.color.cream,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  streakNumber: { fontSize: 20, fontWeight: '600', color: AppTokens.color.ink },
  streakCopy: { flex: 1 },
  streakTitle: { fontSize: 12, fontWeight: '600', color: AppTokens.color.ink },
  streakSub: { fontSize: 10, color: AppTokens.color.muted, marginTop: 2 },
  emptyMetrics: { fontSize: 13, color: AppTokens.color.muted, marginBottom: 8 },
  dipCard: {
    backgroundColor: AppTokens.color.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    padding: 14,
    marginTop: 8,
  },
  dipTitle: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  dipPoints: { fontSize: 11, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 4 },
  dipBody: { fontSize: 11, color: AppTokens.color.muted, lineHeight: 17 },
  dipPattern: { fontSize: 10, color: AppTokens.color.muted, marginTop: 6, fontStyle: 'italic' },
  thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  thumbCol: { width: '22%', alignItems: 'center' },
  thumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  thumbLogged: { backgroundColor: AppTokens.color.photoBg },
  thumbEmpty: { backgroundColor: AppTokens.color.cream },
  thumbToday: { borderWidth: 2, borderColor: AppTokens.color.ink },
  thumbTag: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    zIndex: 2,
  },
  thumbTagText: { color: '#fff', fontSize: 8, fontWeight: '600' },
  thumbImage: { ...StyleSheet.absoluteFillObject, borderRadius: 8 },
  thumbDayLabel: { fontSize: 9, color: AppTokens.color.muted, marginTop: 2, textAlign: 'center' },
});
