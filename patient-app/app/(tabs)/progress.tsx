/**
 * Progress — Steps 29–30 (mock frames 29–30).
 * Medical history from patient_record_facts only (P5.08–P5.11).
 * Calendar twin: same store via `/api/patient/records/calendar`.
 * No invented improvement %.
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

import { ProgressEmptyState } from '@/components/progress/ProgressEmptyState';
import { ProgressKellyStack } from '@/components/progress/ProgressKellyStack';
import { LoadFailedState } from '@/components/LoadFailedState';
import { SessionImage } from '@/components/SessionImage';
import { ALERTS_HREF, calendarHref, EXPORT_HREF, MARK_COMPARE_HREF, MARK_PICKER_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { setCalendarIntent } from '@/lib/calendar-intent';
import { fetchFactsCalendar } from '@/lib/facts-calendar-api';
import {
  pickMediaUrlFromDay,
  rollingStartIso,
  type FactsCalendarDay,
} from '@/lib/facts-calendar';
import { fetchMarksList, type MarkListItem } from '@/lib/marks-api';
import { patientGet } from '@/lib/patient-api';
import {
  fetchProgressAggregates,
  progressShowsBillModule,
  progressShowsSkinModule,
  streakFromFactDays,
  type ProgressAggregatesPayload,
} from '@/lib/progress-aggregates-api';
import {
  fetchProgressKellyMessage,
  type ProgressKellyPayload,
} from '@/lib/progress-kelly-api';
import { formatBillMoney } from '@/lib/format-bill-money';
import { trackPortalEvent } from '@/lib/trackPortalEvent';
import { localTodayIso } from '@/lib/routine-day-mode';

/** Unique Progress Kelly marks — mark_id is compare_group_id. */
function uniqueMarkOptions(marks: MarkListItem[]): { markId: string; label: string }[] {
  const seen = new Set<string>();
  const out: { markId: string; label: string }[] = [];
  for (const m of marks) {
    const markId = String(m.compare_group_id || m.id || '').trim();
    if (!markId || seen.has(markId)) continue;
    seen.add(markId);
    const label = String(m.body_location || m.note || 'Mark').trim() || 'Mark';
    out.push({ markId, label });
  }
  return out;
}

const HONESTY_COPY =
  'Photos and counts from your own records — no invented improvement %.';

type PlanCard = {
  name: string;
  subtitle: string;
};

export default function ProgressScreen() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [aggregates, setAggregates] = useState<ProgressAggregatesPayload | null>(null);
  const [calendarDays, setCalendarDays] = useState<FactsCalendarDay[]>([]);
  const [marks, setMarks] = useState<MarkListItem[]>([]);
  const [planCard, setPlanCard] = useState<PlanCard | null>(null);
  const [selectedMarkId, setSelectedMarkId] = useState<string | null>(null);
  const [kellyEpoch, setKellyEpoch] = useState(0);
  const [kellyLoading, setKellyLoading] = useState(false);
  const [kellyPayload, setKellyPayload] = useState<ProgressKellyPayload | null>(null);
  /** Mark id kellyPayload was fetched for — guards against A→B commit-cycle flash. */
  const [kellyPayloadMarkId, setKellyPayloadMarkId] = useState<string | null>(null);
  const [kellyDismissed, setKellyDismissed] = useState(false);

  useEffect(() => {
    if (ready) trackPortalEvent('progress_viewed');
  }, [ready]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const today = localTodayIso();
      const start = rollingStartIso(180, today);
      const windowStart = rollingStartIso(30, today);
      const results = await Promise.allSettled([
        fetchProgressAggregates({ window_start: windowStart, window_end: today }),
        fetchFactsCalendar({ start, end: today }),
        fetchMarksList(),
        patientGet('/api/patient/routine/template'),
        patientGet('/api/patient/billing/subscription'),
      ]);
      const agg = results[0].status === 'fulfilled' ? results[0].value : null;
      const cal =
        results[1].status === 'fulfilled'
          ? results[1].value
          : ({ days: [] as FactsCalendarDay[] } as { days: FactsCalendarDay[] });
      const markList =
        results[2].status === 'fulfilled' ? results[2].value.marks : ([] as MarkListItem[]);
      setAggregates(agg);
      setCalendarDays(Array.isArray(cal?.days) ? cal.days : []);
      setMarks(markList);

      const templateRes = results[3].status === 'fulfilled' ? results[3].value : null;
      const subRes = results[4].status === 'fulfilled' ? results[4].value : null;
      const tpl = templateRes?.template;
      if (templateRes?.has_template && tpl?.name) {
        const week = Number(tpl.program_week) > 0 ? Number(tpl.program_week) : 1;
        const tierRaw = String(subRes?.subscription?.tier || '').toLowerCase();
        const tierLabel =
          tierRaw === 'care_program'
            ? 'Care Program'
            : tierRaw === 'plus'
              ? 'Plus'
              : 'Habits';
        setPlanCard({
          name: /plan$/i.test(String(tpl.name).trim())
            ? `${String(tpl.name).trim()} active`
            : `${String(tpl.name).trim()} plan active`,
          subtitle: `${tierLabel} · week ${week} of habits`,
        });
      } else {
        setPlanCard(null);
      }

      setLoadFailed(
        results[0].status === 'rejected' &&
          results[1].status === 'rejected' &&
          results[2].status === 'rejected',
      );
    } catch {
      setAggregates(null);
      setCalendarDays([]);
      setMarks([]);
      setPlanCard(null);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      void load().then(() => setKellyEpoch((e) => e + 1));
    }, [ready, load]),
  );

  const markOptions = useMemo(() => uniqueMarkOptions(marks), [marks]);

  useEffect(() => {
    if (markOptions.length === 0) {
      setSelectedMarkId(null);
      return;
    }
    if (!selectedMarkId || !markOptions.some((o) => o.markId === selectedMarkId)) {
      setSelectedMarkId(markOptions[0].markId);
    }
  }, [markOptions, selectedMarkId]);

  useEffect(() => {
    if (!ready || !selectedMarkId) {
      setKellyPayload(null);
      setKellyPayloadMarkId(null);
      setKellyLoading(false);
      return;
    }
    let cancelled = false;
    const forMark = selectedMarkId;
    setKellyLoading(true);
    setKellyPayload(null);
    setKellyPayloadMarkId(null);
    setKellyDismissed(false);
    void (async () => {
      try {
        const payload = await fetchProgressKellyMessage(forMark);
        if (cancelled) return;
        setKellyPayload(payload);
        setKellyPayloadMarkId(forMark);
      } catch {
        if (cancelled) return;
        // Network / 4xx: hide slot — do not keep a prior mark's message.
        setKellyPayload({
          client_action: 'suppress',
          status: 'nothing_new',
          message: null,
        });
        setKellyPayloadMarkId(forMark);
      } finally {
        if (!cancelled) setKellyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, selectedMarkId, kellyEpoch]);

  const todayIso = localTodayIso();
  const factDates = useMemo(() => calendarDays.map((d) => d.date), [calendarDays]);
  const streak = useMemo(() => streakFromFactDays(factDates, todayIso), [factDates, todayIso]);
  const totalLoggedDays = calendarDays.length;
  const timelineDays = useMemo(() => {
    const sorted = [...calendarDays].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.slice(-8).reverse();
  }, [calendarDays]);
  const hasAnyFacts =
    Boolean(aggregates?.skin || aggregates?.bill || aggregates?.rx || aggregates?.mark) ||
    calendarDays.length > 0 ||
    marks.length > 0;
  const showCompareCta = marks.length >= 1;
  const compareGroupId = selectedMarkId || (marks[0] ? marks[0].compare_group_id || marks[0].id : null);

  if (checking || !ready) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={V4DesignTokens.color.red} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.root}
      edges={['top', 'left', 'right']}
      testID="progress-screen">
      <View style={styles.flex} testID="proof-screen">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void load()}
            tintColor={V4DesignTokens.color.red}
          />
        }>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title} testID="progress-title">
              Progress
            </Text>
            <Text style={styles.subtitle} testID="progress-tagline">
              Your records. One timeline.
            </Text>
          </View>
          <View style={styles.headerLinks}>
            <Pressable
              onPress={() => router.push(ALERTS_HREF)}
              accessibilityRole="button"
              accessibilityLabel="Open alerts"
              testID="progress-alerts-entry">
              <Text style={styles.alertsLink}>Alerts</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(EXPORT_HREF)}
              accessibilityRole="button"
              accessibilityLabel="Export for dermatologist"
              testID="progress-export-entry">
              <Text style={styles.alertsLink}>Export</Text>
            </Pressable>
          </View>
        </View>

        {loadFailed && !loading ? (
          <LoadFailedState testID="progress-load-failed" onRetry={() => void load()} />
        ) : null}

        {!loading && !loadFailed && !hasAnyFacts ? (
          <ProgressEmptyState onTrackMark={() => router.push(MARK_PICKER_HREF)} />
        ) : null}

        {!loading && !loadFailed && hasAnyFacts && planCard ? (
          <View style={styles.planCard} testID="progress-plan-card">
            <Text style={styles.planIcon}>✦</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.planTitle}>{planCard.name}</Text>
              <Text style={styles.planSub}>{planCard.subtitle}</Text>
            </View>
          </View>
        ) : null}

        {!loading && !loadFailed && hasAnyFacts && streak === 0 ? (
          <View style={styles.streakCard} testID="proof-streak-zero">
            <Text style={styles.streakLbl}>Current streak</Text>
            <Text style={styles.streakNum}>
              0 <Text style={styles.streakUnit}>days</Text>
            </Text>
            <Text style={styles.streakSub}>
              {totalLoggedDays} day{totalLoggedDays === 1 ? '' : 's'} with records logged
            </Text>
          </View>
        ) : null}

        {!loading && !loadFailed && hasAnyFacts && streak > 0 ? (
          <View style={styles.streakCard} testID="proof-streak">
            <Text style={styles.streakLbl}>Current streak</Text>
            <Text style={styles.streakNum} testID="progress-streak-num">
              {streak} <Text style={styles.streakUnit}>days</Text>
            </Text>
            <Text style={styles.streakSub} testID="progress-streak-sub">
              {totalLoggedDays} day{totalLoggedDays === 1 ? '' : 's'} with records logged
            </Text>
          </View>
        ) : null}

        {!loading && !loadFailed && hasAnyFacts ? (
          <Text style={styles.honesty} testID="progress-honesty">
            {HONESTY_COPY}
          </Text>
        ) : null}

        {!loading && !loadFailed && markOptions.length > 0 ? (
          <View style={styles.kellyBlock} testID="progress-kelly-block">
            {markOptions.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.markPills}
                testID="progress-kelly-mark-switcher">
                {markOptions.map((opt) => {
                  const selected = opt.markId === selectedMarkId;
                  return (
                    <Pressable
                      key={opt.markId}
                      onPress={() => setSelectedMarkId(opt.markId)}
                      style={[styles.markPill, selected && styles.markPillSelected]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Select mark ${opt.label}`}
                      testID={`progress-kelly-mark-${opt.markId}`}>
                      <Text
                        style={[styles.markPillText, selected && styles.markPillTextSelected]}
                        numberOfLines={1}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => router.push(MARK_PICKER_HREF)}
                  style={styles.markPill}
                  accessibilityRole="button"
                  accessibilityLabel="Track a new mark"
                  testID="progress-kelly-mark-new">
                  <Text style={styles.markPillText}>+ New</Text>
                </Pressable>
              </ScrollView>
            ) : null}
            {selectedMarkId && markOptions.length > 0 ? (
              <Pressable
                style={styles.teaserCard}
                testID="progress-compare-teaser"
                onPress={() =>
                  router.push({
                    pathname: MARK_COMPARE_HREF,
                    params: { compareGroupId: selectedMarkId },
                  } as never)
                }
                accessibilityRole="button"
                accessibilityLabel="Open mark compare">
                <Text style={styles.teaserHead}>
                  {markOptions.find((o) => o.markId === selectedMarkId)?.label || 'Mark'} · baseline →
                  latest
                </Text>
                <View style={styles.teaserImgs}>
                  <View style={styles.teaserSlot}>
                    <Text style={styles.teaserSlotLbl}>day 0</Text>
                  </View>
                  <View style={styles.teaserSlot}>
                    <Text style={styles.teaserSlotLbl}>latest</Text>
                  </View>
                </View>
              </Pressable>
            ) : null}
            {!kellyDismissed ? (
              <ProgressKellyStack
                loading={kellyLoading}
                payload={kellyPayload}
                payloadMarkId={kellyPayloadMarkId}
                selectedMarkId={selectedMarkId}
                onCompare={
                  selectedMarkId
                    ? () =>
                        router.push({
                          pathname: MARK_COMPARE_HREF,
                          params: { compareGroupId: selectedMarkId },
                        } as never)
                    : undefined
                }
                onDismiss={() => setKellyDismissed(true)}
              />
            ) : null}
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

        {aggregates?.shelf_in_window || aggregates?.media_in_window ? (
          <View style={styles.moduleCard} testID="progress-window-counts">
            {aggregates.shelf_in_window ? (
              <Text style={styles.moduleLine} testID="progress-shelf-in-window">
                Shelf activity: {aggregates.shelf_in_window.product_count} product
                {aggregates.shelf_in_window.product_count === 1 ? '' : 's'}
              </Text>
            ) : null}
            {aggregates.media_in_window ? (
              <Text style={styles.moduleLine} testID="progress-media-in-window">
                Photos logged: {aggregates.media_in_window.fact_count}
              </Text>
            ) : null}
            <Text style={styles.moduleSub}>Counts only — no before/after improvement claims.</Text>
          </View>
        ) : null}

        {progressShowsSkinModule(aggregates) ? (
          <View style={styles.moduleCard} testID="progress-module-skin">
            <Text style={styles.moduleLine}>
              {aggregates!.skin!.fact_count} logged · calmer {aggregates!.skin!.calmer_day_count} ·
              worse {aggregates!.skin!.worse_day_count} · same {aggregates!.skin!.same_day_count}
            </Text>
            <Text style={styles.moduleSub}>
              Counts from your records — no invented improvement %.
            </Text>
          </View>
        ) : null}

        {progressShowsBillModule(aggregates) ? (
          <View style={styles.moduleCard} testID="progress-module-bill">
            <Text style={styles.moduleLine}>
              {aggregates!.bill!.fact_count} bill
              {aggregates!.bill!.fact_count === 1 ? '' : 's'} ·{' '}
              {formatBillMoney(aggregates!.bill!.total_amount_cents, aggregates!.bill!.currency)}
            </Text>
          </View>
        ) : null}

        {aggregates?.rx ? (
          <View style={styles.moduleCard} testID="progress-module-rx">
            <Text style={styles.moduleLine}>
              {aggregates.rx.fact_count} prescription
              {aggregates.rx.fact_count === 1 ? '' : 's'}
              {aggregates.rx.reminder_opt_in_count
                ? ` · ${aggregates.rx.reminder_opt_in_count} with reminders`
                : ''}
            </Text>
          </View>
        ) : null}

        {timelineDays.length > 0 ? (
          <>
            <Text style={styles.sectionLbl} testID="progress-timeline-label">
              LAST {timelineDays.length} DAYS
            </Text>
            <View style={styles.thumbGrid} testID="progress-facts-timeline">
              {timelineDays.map((d, idx) => {
                const isToday = d.date === todayIso;
                const mediaUrl = pickMediaUrlFromDay(d);
                const daysAgo = Math.round(
                  (new Date(`${todayIso}T12:00:00`).getTime() -
                    new Date(`${d.date}T12:00:00`).getTime()) /
                    86400000,
                );
                const dayLabel = isToday
                  ? 'Today'
                  : daysAgo === 1
                    ? 'Yest'
                    : daysAgo > 1
                      ? `${daysAgo}d`
                      : d.date.slice(5);
                return (
                  <Pressable
                    key={d.date}
                    onPress={() => {
                      setCalendarIntent({ tag: 'skin', view: 'list', date: d.date });
                      router.navigate(calendarHref());
                    }}
                    style={styles.thumbCol}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${dayLabel} records`}
                    testID={`progress-timeline-day-${idx}`}>
                    <View style={[styles.thumb, isToday && styles.thumbToday]}>
                      {mediaUrl ? (
                        <SessionImage
                          uri={mediaUrl}
                          style={styles.thumbImage}
                          contentFit="cover"
                          fallback={<Text style={styles.thumbTags}>{d.tags.join(' · ') || '·'}</Text>}
                        />
                      ) : (
                        <Text style={styles.thumbTags}>{d.tags.join(' · ') || '·'}</Text>
                      )}
                      <Text style={styles.thumbOverlay}>{dayLabel}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {!loading && !loadFailed && hasAnyFacts && marks.length > 0 ? (
          <View style={styles.marksBlock} testID="progress-marks-list">
            {marks.map((m) => (
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
                  <Text style={styles.markTitle}>{m.body_location || m.note || 'Mark'}</Text>
                  <Text style={styles.markSub}>{m.date || 'undated'}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.ground },
  flex: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 100 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerText: { flex: 1, paddingRight: 12 },
  headerLinks: { alignItems: 'flex-end', gap: 8 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 26,
    color: V4DesignTokens.color.black,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
  },
  alertsLink: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 13,
    color: V4DesignTokens.color.red,
    marginTop: 6,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F6F6F6',
    borderRadius: 14,
    padding: 14,
  },
  planIcon: { fontSize: 18, color: V4DesignTokens.color.red },
  planTitle: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 14,
    color: V4DesignTokens.color.black,
  },
  planSub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    color: V4DesignTokens.color.muted,
    marginTop: 2,
  },
  streakCard: {
    backgroundColor: V4DesignTokens.color.black,
    borderRadius: 16,
    padding: 16,
  },
  streakLbl: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  streakNum: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 42,
    color: V4DesignTokens.color.white,
    lineHeight: 46,
  },
  streakUnit: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
  },
  streakSub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 4,
  },
  honesty: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    color: V4DesignTokens.color.muted,
    lineHeight: 18,
  },
  kellyBlock: { gap: 10 },
  teaserCard: {
    backgroundColor: V4DesignTokens.color.white,
    borderWidth: 1.5,
    borderColor: V4DesignTokens.color.line,
    borderRadius: 16,
    padding: 13,
  },
  teaserHead: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 11,
    color: V4DesignTokens.color.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  teaserImgs: { flexDirection: 'row', gap: 8 },
  teaserSlot: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: V4DesignTokens.color.ground,
    borderWidth: 1.5,
    borderColor: V4DesignTokens.color.line,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 6,
  },
  teaserSlotLbl: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 10.5,
    color: V4DesignTokens.color.wine,
  },
  markPills: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  markPill: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#F6F6F6',
    borderWidth: 1,
    borderColor: 'transparent',
    maxWidth: 180,
  },
  markPillSelected: {
    backgroundColor: V4DesignTokens.color.black,
  },
  markPillText: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
  },
  markPillTextSelected: {
    color: V4DesignTokens.color.white,
  },
  compareCta: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  compareCtaText: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 14,
    color: V4DesignTokens.color.red,
  },
  moduleCard: {
    backgroundColor: '#F6F6F6',
    borderRadius: 14,
    padding: 14,
  },
  moduleLine: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 14,
    color: V4DesignTokens.color.black,
  },
  moduleSub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    color: V4DesignTokens.color.muted,
    marginTop: 6,
  },
  sectionLbl: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.05 * 16,
    color: V4DesignTokens.color.muted,
    marginBottom: 2,
  },
  thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbCol: { width: '22%' },
  thumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#e4c9c9',
    justifyContent: 'flex-end',
  },
  thumbToday: { borderWidth: 2, borderColor: V4DesignTokens.color.red },
  thumbImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  thumbTags: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 9,
    color: V4DesignTokens.color.white,
    textAlign: 'center',
    padding: 6,
  },
  thumbOverlay: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 10,
    color: V4DesignTokens.color.white,
    padding: 6,
    backgroundColor: 'rgba(11,11,12,0.35)',
  },
  marksBlock: { gap: 8, marginTop: 4 },
  markRow: {
    backgroundColor: '#F6F6F6',
    borderRadius: 12,
    padding: 14,
  },
  markTitle: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 15,
    color: V4DesignTokens.color.black,
  },
  markSub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    color: V4DesignTokens.color.muted,
    marginTop: 2,
  },
});
