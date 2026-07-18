/**
 * Progress / Proof — medical history from patient_record_facts only (P5.08–P5.11).
 * Calendar twin: same store via `/api/patient/records/calendar`.
 * Does not call journal/spots summary endpoints.
 */
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

import { PhotoStreakHero } from '@/components/progress/PhotoStreakHero';
import { ProgressAlertsModule } from '@/components/progress/ProgressAlertsModule';
import { ProgressEmptyState } from '@/components/progress/ProgressEmptyState';
import { EmptyStateCard, SectionLabel } from '@/components/v3';
import { AppFontFamilies } from '@/components/ui/AppFontsProvider';
import { AppTokens } from '@/constants/appTokens';
import { CAPTURE_2A_HREF, MARK_COMPARE_HREF, MARK_PICKER_HREF, TRACK_HREF } from '@/constants/routes';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { fetchFactsCalendar } from '@/lib/facts-calendar-api';
import type { FactsCalendarDay } from '@/lib/facts-calendar';
import { fetchMarksList, type MarkListItem } from '@/lib/marks-api';
import {
  fetchProgressAggregates,
  progressShowsBillModule,
  progressShowsSkinModule,
  streakFromFactDays,
  type ProgressAggregatesPayload,
} from '@/lib/progress-aggregates-api';
import { formatBillMoney } from '@/lib/format-bill-money';
import { trackPortalEvent } from '@/lib/trackPortalEvent';
import { localTodayIso } from '@/lib/routine-day-mode';

function rollingStartIso(days: number, todayIso: string): string {
  const dt = new Date(`${todayIso}T12:00:00.000Z`);
  dt.setUTCDate(dt.getUTCDate() - (days - 1));
  return dt.toISOString().slice(0, 10);
}

export default function ProgressScreen() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [aggregates, setAggregates] = useState<ProgressAggregatesPayload | null>(null);
  const [calendarDays, setCalendarDays] = useState<FactsCalendarDay[]>([]);
  const [marks, setMarks] = useState<MarkListItem[]>([]);

  useEffect(() => {
    if (ready) trackPortalEvent('progress_viewed');
  }, [ready]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = localTodayIso();
      const start = rollingStartIso(180, today);
      const [agg, cal, markList] = await Promise.all([
        fetchProgressAggregates().catch(() => null),
        fetchFactsCalendar({ start, end: today }).catch(() => ({ days: [] as FactsCalendarDay[] })),
        fetchMarksList()
          .then((p) => p.marks)
          .catch(() => [] as MarkListItem[]),
      ]);
      setAggregates(agg);
      setCalendarDays(Array.isArray(cal?.days) ? cal.days : []);
      setMarks(markList);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      void load();
    }, [ready, load]),
  );

  const todayIso = localTodayIso();
  const factDates = useMemo(() => calendarDays.map((d) => d.date), [calendarDays]);
  const streak = useMemo(() => streakFromFactDays(factDates, todayIso), [factDates, todayIso]);
  const totalLoggedDays = calendarDays.length;
  const timelineDays = useMemo(() => calendarDays.slice(-8), [calendarDays]);
  const hasAnyFacts =
    Boolean(aggregates?.skin || aggregates?.bill || aggregates?.rx || aggregates?.mark) ||
    calendarDays.length > 0 ||
    marks.length > 0;
  const showCompareCta = marks.length >= 1;
  const compareGroupId = marks[0] ? marks[0].compare_group_id || marks[0].id : null;

  if (checking || !ready) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={AppTokens.color.brandBlue} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']} testID="proof-screen">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Proof</Text>
            <Text style={styles.subtitle}>Your records. One history.</Text>
          </View>
          <Pressable onPress={() => router.replace(CAPTURE_2A_HREF)} accessibilityRole="button">
            <Text style={styles.seeAll}>Log</Text>
          </Pressable>
        </View>

        <ProgressAlertsModule />

        {!loading && !hasAnyFacts ? <ProgressEmptyState /> : null}

        {!loading && !hasAnyFacts ? (
          <PhotoStreakHero onTakePhoto={() => router.push(CAPTURE_2A_HREF)} />
        ) : streak === 0 && hasAnyFacts ? (
          <View style={styles.streakHero} testID="proof-streak-zero">
            <View>
              <Text style={styles.streakHeroLabel}>Keep going</Text>
              <Text style={styles.streakHeroSubLight}>
                {totalLoggedDays} day{totalLoggedDays === 1 ? '' : 's'} with records — log again
                today to start a streak.
              </Text>
            </View>
          </View>
        ) : streak > 0 ? (
          <View style={styles.streakHero} testID="proof-streak">
            <View>
              <Text style={styles.streakHeroLabel}>Current streak</Text>
              <View style={styles.streakHeroRow}>
                <Text style={styles.streakHeroNum}>{streak}</Text>
                <Text style={styles.streakHeroUnit}>days</Text>
              </View>
              <Text style={styles.streakHeroSub}>
                {totalLoggedDays} day{totalLoggedDays === 1 ? '' : 's'} with records
              </Text>
            </View>
          </View>
        ) : null}

        {showCompareCta && compareGroupId ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: MARK_COMPARE_HREF,
                params: { compareGroupId },
              } as never)
            }
            accessibilityRole="button"
            accessibilityLabel="Compare marks over time"
            style={styles.compareCta}
            testID="proof-compare-cta">
            <Text style={styles.compareCtaText}>Compare marks over time →</Text>
          </Pressable>
        ) : !loading && hasAnyFacts && marks.length === 0 ? (
          <Pressable
            onPress={() => router.push(MARK_PICKER_HREF)}
            accessibilityRole="button"
            accessibilityLabel="Start mark compare"
            style={styles.compareCta}
            testID="proof-compare-cta-start">
            <Text style={styles.compareCtaText}>Track a mark to compare →</Text>
          </Pressable>
        ) : null}

        {progressShowsSkinModule(aggregates) ? (
          <>
            <SectionLabel>Skin</SectionLabel>
            <View style={styles.moduleCard} testID="progress-module-skin">
              <Text style={styles.moduleLine}>
                {aggregates!.skin!.fact_count} logged · calmer {aggregates!.skin!.calmer_day_count} ·
                worse {aggregates!.skin!.worse_day_count} · same {aggregates!.skin!.same_day_count}
              </Text>
              <Text style={styles.moduleSub}>
                Counts from your records — no invented improvement %.
              </Text>
            </View>
          </>
        ) : null}

        {progressShowsBillModule(aggregates) ? (
          <>
            <SectionLabel>Bills</SectionLabel>
            <View style={styles.moduleCard} testID="progress-module-bill">
              <Text style={styles.moduleLine}>
                {aggregates!.bill!.fact_count} bill
                {aggregates!.bill!.fact_count === 1 ? '' : 's'} ·{' '}
                {formatBillMoney(aggregates!.bill!.total_amount_cents, aggregates!.bill!.currency)}
              </Text>
            </View>
          </>
        ) : null}

        {aggregates?.rx ? (
          <>
            <SectionLabel>Prescriptions</SectionLabel>
            <View style={styles.moduleCard} testID="progress-module-rx">
              <Text style={styles.moduleLine}>
                {aggregates.rx.fact_count} prescription
                {aggregates.rx.fact_count === 1 ? '' : 's'}
                {aggregates.rx.reminder_opt_in_count
                  ? ` · ${aggregates.rx.reminder_opt_in_count} with reminders`
                  : ''}
              </Text>
            </View>
          </>
        ) : null}

        {timelineDays.length > 0 ? (
          <>
            <View style={styles.timelineHeader}>
              <SectionLabel>{`${timelineDays.length}-day record timeline`}</SectionLabel>
              <Pressable onPress={() => router.push(CAPTURE_2A_HREF)} accessibilityRole="button">
                <Text style={styles.seeAll}>See all</Text>
              </Pressable>
            </View>
            <View style={styles.thumbGrid} testID="progress-facts-timeline">
              {timelineDays.map((d) => {
                const isToday = d.date === todayIso;
                const dayLabel = (() => {
                  if (isToday) return 'Today';
                  const daysAgo = Math.round(
                    (new Date(`${todayIso}T12:00:00`).getTime() -
                      new Date(`${d.date}T12:00:00`).getTime()) /
                      86400000,
                  );
                  if (daysAgo === 1) return 'Yesterday';
                  if (daysAgo > 1) return `${daysAgo}d ago`;
                  return d.date.slice(5);
                })();
                return (
                  <View key={d.date} style={styles.thumbCol}>
                    <Pressable
                      onPress={() =>
                        router.push(`${CAPTURE_2A_HREF}?date=${d.date}` as typeof CAPTURE_2A_HREF)
                      }
                      style={[styles.thumb, styles.thumbLogged, isToday && styles.thumbToday]}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${dayLabel}`}>
                      <Text style={styles.thumbTags}>{d.tags.join(' · ')}</Text>
                    </Pressable>
                    <Text style={styles.thumbDayLabel}>{dayLabel}</Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        <SectionLabel>Spot tracking</SectionLabel>
        {marks.length === 0 ? (
          <EmptyStateCard
            title="No spots tracked yet"
            body="Photograph a mole or mark on the Track tab. We'll help you watch it over time."
            ctaLabel="Track a spot"
            onCta={() => router.push(TRACK_HREF)}
          />
        ) : (
          marks.map((m) => (
            <Pressable
              key={m.id}
              style={styles.markRow}
              testID={`progress-mark-${m.id}`}
              onPress={() =>
                router.push({
                  pathname: MARK_COMPARE_HREF,
                  params: { compareGroupId: m.compare_group_id || m.id },
                } as never)
              }
              accessibilityRole="button">
              <View style={{ flex: 1 }}>
                <Text style={styles.markTitle}>
                  {m.body_location || m.note || 'Mark'}
                </Text>
                <Text style={styles.markSub}>{m.date || 'undated'}</Text>
              </View>
            </Pressable>
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
  streakHeroUnit: { fontSize: 16, fontWeight: '600', color: AppTokens.color.watchAmberText },
  streakHeroSub: { fontSize: 12, color: AppTokens.color.hint, marginTop: 4 },
  streakHeroSubLight: {
    fontSize: 14,
    color: '#fff',
    marginTop: 4,
    lineHeight: 20,
    maxWidth: 280,
  },
  compareCta: {
    backgroundColor: AppTokens.color.cream,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: AppTokens.color.ink,
  },
  compareCtaText: {
    color: AppTokens.color.ink,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  moduleCard: {
    backgroundColor: AppTokens.color.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    padding: 14,
    marginBottom: 4,
  },
  moduleLine: {
    fontSize: 15,
    color: AppTokens.color.ink,
    fontFamily: AppFontFamilies.bodySemiBold,
  },
  moduleSub: { fontSize: 12, color: AppTokens.color.muted, marginTop: 6 },
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
    padding: 4,
  },
  thumbLogged: { backgroundColor: AppTokens.color.photoBg },
  thumbToday: { borderWidth: 2, borderColor: AppTokens.color.brandBlue },
  thumbTags: { fontSize: 9, color: '#fff', textAlign: 'center', fontWeight: '600' },
  thumbDayLabel: { fontSize: 9, color: AppTokens.color.muted, marginTop: 2, textAlign: 'center' },
  markRow: {
    backgroundColor: AppTokens.color.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    padding: 14,
    marginBottom: 8,
  },
  markTitle: { fontSize: 15, color: AppTokens.color.ink, fontFamily: AppFontFamilies.bodySemiBold },
  markSub: { fontSize: 12, color: AppTokens.color.muted, marginTop: 2 },
});
