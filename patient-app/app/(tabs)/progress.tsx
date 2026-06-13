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
import { PhotoStreakHero } from '@/components/progress/PhotoStreakHero';
import { SkinMetricSparkCards } from '@/components/progress/SkinMetricSparkCards';
import { EmptyStateCard, SectionLabel, SpotRowCard } from '@/components/v3';
import { SessionImage } from '@/components/SessionImage';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppFontFamilies } from '@/components/ui/AppFontsProvider';
import { AppTokens } from '@/constants/appTokens';
import { HOME_HREF, spotHref, TRACK_HREF } from '@/constants/routes';
import { listSpots, spotStatusLabel, type Spot } from '@/lib/spot-store';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import {
  fetchBarrierInsight,
  fetchStreakPercentile,
  fetchVerdictHistory,
} from '@/lib/conflict-api';
import { fetchJournalImprovements, fetchTriggerInsights } from '@/lib/journal-api';
import type { BarrierInsight, VerdictHistoryDay } from '@/lib/conflict-types';
import { verdictTagColor } from '@/lib/conflict-helpers';
import { patientGet } from '@/lib/patient-api';
import { trackPortalEvent } from '@/lib/trackPortalEvent';
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
  condition_tags?: string[];
};

const CONDITION_DOT: Record<string, string> = {
  calm: '#1D9E75',
  breaking_out: '#EF9F27',
  dry: '#314DB6',
  oily: '#6B7280',
  irritated: '#E24B4A',
};

function latestBfi(days: VerdictHistoryDay[]): number | null {
  for (let i = days.length - 1; i >= 0; i--) {
    const v = days[i]?.barrier_friction_index;
    if (v != null) return v;
  }
  return null;
}

function bfiLabel(score: number): string {
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Fair';
  return 'Poor';
}

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
  const [triggerTags, setTriggerTags] = useState<string[]>([]);
  const [journalMetrics, setJournalMetrics] = useState<{
    redness_pct?: number;
    breakouts_pct?: number;
    texture_pct?: number;
    hydration_pct?: number;
  } | null>(null);

  useEffect(() => {
    if (ready) trackPortalEvent('progress_viewed');
  }, [ready]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = localTodayIso();
      const start = new Date(`${today}T12:00:00.000Z`);
      start.setUTCDate(start.getUTCDate() - 7);
      const startIso = start.toISOString().slice(0, 10);

      const [progRes, insightRes, calRes, histRes, spotList, triggersRes, journalImpRes] =
        await Promise.all([
          patientGet('/api/patient/home/progress-summary'),
          fetchBarrierInsight().catch(() => null),
          patientGet(
            `/api/patient/journal/calendar-range?start=${startIso}&end=${today}&include_empty_days=1`,
          ).catch(() => ({ days: [] })),
          fetchVerdictHistory(8).catch(() => []),
          listSpots(),
          fetchTriggerInsights().catch(() => ({ insights: [] })),
          fetchJournalImprovements().catch(() => ({ ready: false, metrics: null })),
        ]);
      setSpots(spotList);
      setTriggerTags(
        (triggersRes?.insights || []).map((i: { label: string }) => i.label).filter(Boolean),
      );
      setJournalMetrics(journalImpRes?.ready ? journalImpRes.metrics : null);
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
      } else {
        setPercentileCopy(null);
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
        <ActivityIndicator color={AppTokens.color.brandBlue} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  const metrics = improvementMetrics;
  const streak = summary?.streak_days ?? 0;
  const bfi = latestBfi(history);
  const openPhoto = () => router.push(`${HOME_HREF}?photo=1` as typeof HOME_HREF);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Your progress</Text>
            <Text style={styles.subtitle}>Small changes. Real results.</Text>
          </View>
          <Pressable
            style={styles.calendarBtn}
            accessibilityRole="button"
            accessibilityLabel="Open calendar"
            onPress={() => router.push(HOME_HREF)}>
            <AppIcon name="calendar" size={20} color={AppTokens.color.ink} />
          </Pressable>
        </View>

        {streak === 0 ? (
          <PhotoStreakHero onTakePhoto={openPhoto} />
        ) : (
          <View style={styles.streakHero}>
            <View>
              <Text style={styles.streakHeroLabel}>Current streak</Text>
              <View style={styles.streakHeroRow}>
                <Text style={styles.streakHeroNum}>{streak}</Text>
                <Text style={styles.streakHeroUnit}>days</Text>
              </View>
              {percentileCopy ? <Text style={styles.streakHeroSub}>{percentileCopy}</Text> : null}
            </View>
            <AppIcon name="flame" size={28} color="#F59E0B" />
          </View>
        )}

        <SectionLabel>Barrier score — last 8 days</SectionLabel>
        <View style={styles.barrierCard}>
          <View style={styles.barrierCardHeader}>
            <Text style={styles.barrierCardTitle}>Barrier health — last 8 days</Text>
            {bfi != null ? (
              <View style={styles.bfiBadge}>
                <Text style={styles.bfiBadgeText}>
                  {bfiLabel(bfi)} {bfi}/100
                </Text>
              </View>
            ) : null}
          </View>
          <BarrierGrid8 days={history} />
        </View>

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
        {journalMetrics ? (
          <SkinMetricSparkCards metrics={journalMetrics} />
        ) : (
          <>
            {metrics?.redness_pct != null ? (
              <ImprovementBar label="Redness" value={metrics.redness_pct} positiveIsGood={false} />
            ) : null}
            {metrics?.clarity_pct != null ? (
              <ImprovementBar label="Clarity" value={metrics.clarity_pct} positiveIsGood />
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
            {!metrics?.clarity_pct && !metrics?.redness_pct && !metrics?.skin_age_delta ? (
              <Text style={styles.emptyMetrics}>Log more photos to unlock improvement metrics.</Text>
            ) : null}
          </>
        )}

        {triggerTags.length > 0 ? (
          <>
            <SectionLabel>Your triggers</SectionLabel>
            <View style={styles.tagRow}>
              {triggerTags.map((tag) => (
                <View key={tag} style={styles.triggerTag}>
                  <Text style={styles.triggerTagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {days.length > 0 ? (
          <>
            <View style={styles.timelineHeader}>
              <SectionLabel>{`${days.length}-day photo timeline`}</SectionLabel>
              <Pressable onPress={() => router.push(HOME_HREF)} accessibilityRole="button">
                <Text style={styles.seeAll}>See all</Text>
              </Pressable>
            </View>
            <View style={styles.thumbGrid}>
              {days.map((d, idx) => {
                const logged = (d.completion_score || 0) >= 100 || d.has_media;
                const isToday = d.date === localTodayIso();
                const tagColor = d.verdict_overall
                  ? verdictTagColor(d.verdict_overall as 'safe' | 'caution' | 'avoid')
                  : null;
                const conditionDot =
                  d.condition_tags?.[0] && CONDITION_DOT[d.condition_tags[0]]
                    ? CONDITION_DOT[d.condition_tags[0]]
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
                      {conditionDot ? (
                        <View style={[styles.conditionDot, { backgroundColor: conditionDot }]} />
                      ) : null}
                      {tagColor && logged ? (
                        <View style={[styles.thumbTag, { backgroundColor: tagColor }]}>
                          <Text style={styles.thumbTagText}>{dayLabel}</Text>
                        </View>
                      ) : null}
                      {d.thumbnail_url ? (
                        <SessionImage uri={d.thumbnail_url} style={styles.thumbImage} contentFit="cover" />
                      ) : logged ? (
                        <AppIcon name="camera" size={18} color="rgba(255,255,255,0.45)" />
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerText: { flex: 1 },
  title: {
    fontFamily: AppFontFamilies.display,
    fontSize: 26,
    color: AppTokens.color.ink,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: AppFontFamilies.body,
    fontSize: 14,
    color: AppTokens.color.muted,
  },
  calendarBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    backgroundColor: AppTokens.color.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakHero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AppTokens.color.ink,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  streakHeroLabel: {
    fontSize: 10,
    color: AppTokens.color.hint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
    fontFamily: AppFontFamilies.bodySemiBold,
  },
  streakHeroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  streakHeroNum: { fontSize: 42, fontWeight: '700', color: '#fff', lineHeight: 44 },
  streakHeroUnit: { fontSize: 16, fontWeight: '600', color: '#F59E0B' },
  streakHeroSub: { fontSize: 12, color: AppTokens.color.hint, marginTop: 4 },
  barrierCard: {
    backgroundColor: AppTokens.color.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    padding: 14,
    marginBottom: 4,
  },
  barrierCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  barrierCardTitle: {
    fontSize: 13,
    fontFamily: AppFontFamilies.bodySemiBold,
    color: AppTokens.color.ink,
    flex: 1,
  },
  bfiBadge: {
    backgroundColor: '#E6F1FB',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bfiBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: AppTokens.color.brandBlue,
    fontFamily: AppFontFamilies.bodySemiBold,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  triggerTag: {
    backgroundColor: '#FFF3E0',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FBBF24',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  triggerTagText: { fontSize: 12, color: '#92400E' },
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
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -4,
  },
  seeAll: {
    fontSize: 12,
    color: AppTokens.color.brandBlue,
    fontFamily: AppFontFamilies.bodySemiBold,
    marginBottom: 8,
  },
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
  thumbToday: { borderWidth: 2, borderColor: AppTokens.color.brandBlue },
  conditionDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 3,
  },
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
