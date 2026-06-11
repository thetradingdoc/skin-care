import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RoutineStepsHero } from '@/components/RoutineStepsHero';
import { BarrierScoreRing, GraphUnavailableBanner, RoutineStepRow } from '@/components/conflict';
import { SessionImage } from '@/components/SessionImage';
import { PrimaryButton, SecondaryButton } from '@/components/billing-ui';
import { ConflictTokens } from '@/constants/conflictTokens';
import { JournalTokens } from '@/constants/journalTokens';
import { TimelineTokens } from '@/constants/timelineTokens';
import { SCAN_HREF, PROGRESS_HREF, BIO_CALIBRATION_HREF } from '@/constants/routes';
import { fetchBioProfile, fetchEvaluateLineup } from '@/lib/conflict-api';
import type { BioProfile, EvaluateResult } from '@/lib/conflict-types';
import { verdictTagColor, overallColor } from '@/lib/conflict-helpers';
import { patientGet } from '@/lib/patient-api';
import type { SkinReportPayload } from '@/lib/routine-capture';
import { localTodayIso, resolveRoutineDayMode, weekdayLabel, type RoutineDayMode } from '@/lib/routine-day-mode';
import {
  celebrateBannerCopy,
  todayScreenTitle,
} from '@/lib/routine-copy';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { getNeedsFirstPhoto } from '@/lib/onboarding-storage';
import { getStoredEmail } from '@/lib/patient-session';

type PhaseItem = {
  product_name?: string;
  usage_time?: string;
  goal?: string;
};

export default function TodayScreen() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; photo?: string; celebrate?: string }>();
  const selectedDate =
    typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : localTodayIso();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasTemplate, setHasTemplate] = useState(false);
  const [completionScore, setCompletionScore] = useState<number | null>(null);
  const [phaseItems, setPhaseItems] = useState<PhaseItem[]>([]);
  const [programWeek, setProgramWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(12);
  const [phaseLabel, setPhaseLabel] = useState<string | null>(null);
  const [phaseExpect, setPhaseExpect] = useState<string | null>(null);
  const [phaseFocus, setPhaseFocus] = useState<string | null>(null);
  const [phaseNotes, setPhaseNotes] = useState<string | null>(null);
  const [phaseNotesOpen, setPhaseNotesOpen] = useState(false);
  const [redFlags, setRedFlags] = useState<string[]>([]);
  const [assistantSummary, setAssistantSummary] = useState<string | null>(null);
  const [frozenSkinReport, setFrozenSkinReport] = useState<SkinReportPayload | null>(null);
  const [dayMode, setDayMode] = useState<RoutineDayMode>('today');
  const [allowsPhoto, setAllowsPhoto] = useState(true);
  const [layeringWarning, setLayeringWarning] = useState<string | null>(null);
  const [evaluate, setEvaluate] = useState<EvaluateResult | null>(null);
  const [bioProfile, setBioProfile] = useState<BioProfile | null>(null);
  const [skinAgeDelta, setSkinAgeDelta] = useState<number | null>(null);
  const [yesterdayVerdict, setYesterdayVerdict] = useState<string | null>(null);
  const [showCelebrate, setShowCelebrate] = useState(params.celebrate === '1');
  const [needsFirstPhoto, setNeedsFirstPhoto] = useState(false);
  const [streakDays, setStreakDays] = useState(0);
  const [greetingName, setGreetingName] = useState('there');
  const [photoThumbs, setPhotoThumbs] = useState<{ date: string; logged: boolean }[]>([]);
  const [todayThumbnailUrl, setTodayThumbnailUrl] = useState<string | null>(null);
  const photoTriggeredRef = useRef(false);

  const clientDayMode = resolveRoutineDayMode(selectedDate);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const todayIso = localTodayIso();
      const thumbStart = new Date(`${todayIso}T12:00:00.000Z`);
      thumbStart.setUTCDate(thumbStart.getUTCDate() - 4);
      const thumbStartIso = thumbStart.toISOString().slice(0, 10);

      const [templateRes, dailyRes, phaseRes, progressRes, calRes] = await Promise.all([
        patientGet('/api/patient/routine/template'),
        patientGet(`/api/patient/routine/daily?date=${selectedDate}`),
        patientGet(`/api/patient/routine/phase?date=${selectedDate}`).catch(() => null),
        patientGet('/api/patient/home/progress-summary').catch(() => null),
        patientGet(
          `/api/patient/journal/calendar-range?start=${thumbStartIso}&end=${todayIso}&include_empty_days=1`,
        ).catch(() => ({ days: [] })),
      ]);
      setStreakDays(Number(progressRes?.summary?.streak_days) || 0);
      const metrics = progressRes?.improvement_metrics;
      if (metrics?.skin_age_delta != null) {
        setSkinAgeDelta(Number(metrics.skin_age_delta));
      } else if (metrics?.skin_age_years != null) {
        setSkinAgeDelta(Number(metrics.skin_age_years));
      } else {
        setSkinAgeDelta(null);
      }
      const email = (await getStoredEmail()) || '';
      const nick = email.split('@')[0]?.split(/[._]/)[0];
      if (nick) setGreetingName(nick.charAt(0).toUpperCase() + nick.slice(1));
      const calDays = Array.isArray(calRes?.days) ? calRes.days : [];
      const todayCal = calDays.find((d: { date: string }) => d.date === todayIso);
      setTodayThumbnailUrl(
        todayCal?.thumbnail_url && typeof todayCal.thumbnail_url === 'string' ? todayCal.thumbnail_url : null,
      );
      setPhotoThumbs(
        calDays.slice(-5).map((d: { date: string; completion_score?: number; has_media?: boolean }) => ({
          date: d.date,
          logged: (d.completion_score || 0) >= 100 || Boolean(d.has_media),
        })),
      );
      setHasTemplate(Boolean(templateRes?.has_template));
      const score = dailyRes?.daily_entry?.completion_score;
      const scoreNum = Number.isFinite(Number(score)) ? Number(score) : null;
      setCompletionScore(scoreNum);

      const apiMode = (dailyRes?.day_mode || phaseRes?.day_mode || clientDayMode.mode) as RoutineDayMode;
      setDayMode(apiMode);
      setAllowsPhoto(
        Boolean(dailyRes?.allows_photo ?? phaseRes?.allows_photo ?? clientDayMode.allows_photo)
      );

      const parsedReport = dailyRes?.daily_entry?.skin_report_parsed as SkinReportPayload | null;
      setFrozenSkinReport(parsedReport || null);
      if (parsedReport?.assistant_summary && apiMode === 'historical') {
        setAssistantSummary(parsedReport.assistant_summary);
        if (parsedReport.program_week) setProgramWeek(Number(parsedReport.program_week));
        if (parsedReport.phase_label) setPhaseLabel(parsedReport.phase_label);
      } else {
        setAssistantSummary(null);
      }

      if (phaseRes?.has_template && phaseRes?.phase) {
        if (apiMode !== 'historical' || !parsedReport?.assistant_summary) {
          setProgramWeek(Number(phaseRes.phase.program_week) || 1);
          setPhaseLabel(phaseRes.phase.label || null);
          setPhaseExpect(phaseRes.phase.expect || null);
          setPhaseFocus(phaseRes.phase.focus || null);
        }
        setPhaseNotes(phaseRes.phase.notes || null);
        setTotalWeeks(Number(phaseRes.phase.total_weeks) || 12);
        setRedFlags(Array.isArray(phaseRes.phase.red_flags) ? phaseRes.phase.red_flags : []);
        const steps =
          apiMode === 'historical' && Array.isArray(parsedReport?.frozen_steps) && parsedReport.frozen_steps.length
            ? parsedReport.frozen_steps
            : Array.isArray(phaseRes.items)
              ? phaseRes.items
              : [];
        setPhaseItems(steps);
      } else {
        const fallback = Array.isArray(templateRes?.template?.items) ? templateRes.template.items : [];
        setPhaseItems(
          apiMode === 'historical' && Array.isArray(parsedReport?.frozen_steps) && parsedReport.frozen_steps.length
            ? parsedReport.frozen_steps
            : fallback
        );
        if (apiMode !== 'historical') {
          setPhaseExpect(null);
          setPhaseFocus(null);
        }
        setPhaseNotes(null);
        setRedFlags([]);
      }
      if (templateRes?.has_template) {
        try {
          const [evalRes, bio] = await Promise.all([
            fetchEvaluateLineup(),
            fetchBioProfile().catch(() => null),
          ]);
          setEvaluate(evalRes);
          setBioProfile(bio);
          if (evalRes?.graph_unavailable) {
            setLayeringWarning(null);
          } else {
            const conflicts = Array.isArray(evalRes?.conflicts) ? evalRes.conflicts : [];
            if (conflicts.length) {
              setLayeringWarning(conflicts[0]?.notes || 'Check layering before combining actives.');
            } else if (evalRes?.overall && evalRes.overall !== 'safe') {
              setLayeringWarning('Your routine may need spacing between actives.');
            } else {
              setLayeringWarning(null);
            }
          }
        } catch {
          setLayeringWarning(null);
        }
      }
      const calYesterday = calDays.length >= 2 ? calDays[calDays.length - 2] : null;
      if (calYesterday?.verdict_overall) {
        setYesterdayVerdict(String(calYesterday.verdict_overall));
      } else {
        setYesterdayVerdict(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to load today.');
      setHasTemplate(false);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, clientDayMode.mode]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCapture = useCallback(() => {
    if (!allowsPhoto) return;
    router.push({
      pathname: '/routine/capture',
      params: { date: selectedDate },
    });
  }, [allowsPhoto, router, selectedDate]);

  const pickFromLibrary = useCallback(async () => {
    if (!allowsPhoto) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library access is required.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (picked.canceled || !picked.assets?.[0]?.uri) return;
    router.push({
      pathname: '/routine/capture',
      params: { date: selectedDate, libraryUri: picked.assets[0].uri },
    });
  }, [allowsPhoto, router, selectedDate]);

  const loggedForDay = completionScore != null && completionScore >= 100;

  useEffect(() => {
    void getNeedsFirstPhoto().then(setNeedsFirstPhoto);
  }, []);

  useEffect(() => {
    if (loggedForDay) setNeedsFirstPhoto(false);
  }, [loggedForDay]);

  useEffect(() => {
    if (params.photo !== '1' || photoTriggeredRef.current || loading || !hasTemplate || !allowsPhoto) return;
    photoTriggeredRef.current = true;
    openCapture();
  }, [params.photo, loading, hasTemplate, allowsPhoto, openCapture]);

  useEffect(() => {
    if (params.celebrate === '1') setShowCelebrate(true);
  }, [params.celebrate]);

  const weekKicker = hasTemplate
    ? `Week ${programWeek} of ${totalWeeks}${phaseLabel ? ` · ${phaseLabel}` : ''}`
    : null;
  const phaseSnippet = phaseExpect || phaseFocus || null;
  const showStepsHero = hasTemplate && phaseItems.length > 0 && dayMode !== 'historical';
  const showDayOneEmpty = hasTemplate && dayMode === 'today' && !loggedForDay && programWeek <= 1;

  if (checking || !ready) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <ActivityIndicator color={JournalTokens.color.accent} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <Modal visible={needsFirstPhoto && hasTemplate && !loggedForDay} animationType="slide" transparent>
        <View style={styles.overlayBackdrop}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>Day 1 — log today&apos;s photo</Text>
            <Text style={styles.overlayBody}>
              Your daily check-in is one progress photo. Same time tomorrow keeps your track consistent.
            </Text>
            <PrimaryButton label="Take progress photo" onPress={openCapture} />
          </View>
        </View>
      </Modal>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
        {hasTemplate && dayMode === 'today' ? (
          <View style={styles.todayHeader}>
            <View>
              <Text allowFontScaling style={styles.greeting}>
                Good morning, {greetingName}
              </Text>
              <Text allowFontScaling style={styles.daySub}>
                Day {Math.max(1, (programWeek - 1) * 7 + 1)} · Week {programWeek} of {totalWeeks}
              </Text>
            </View>
            {streakDays > 0 ? (
              <View style={styles.streakPill}>
                <Text style={styles.streakText}>🔥 {streakDays} day streak</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <>
            <Text allowFontScaling style={styles.title}>
              {todayScreenTitle(dayMode)}
            </Text>
            <Text allowFontScaling style={styles.subtitle}>
              {selectedDate}
            </Text>
          </>
        )}

        {showCelebrate && loggedForDay ? (
          <View style={styles.celebrateBanner}>
            <Text style={styles.celebrateText}>{celebrateBannerCopy()}</Text>
            <Pressable onPress={() => router.push(PROGRESS_HREF)}>
              <Text style={styles.celebrateLink}>Open Progress</Text>
            </Pressable>
          </View>
        ) : null}

        {dayMode === 'historical' ? (
          <View style={styles.historyBanner}>
            <Text style={styles.historyBannerText}>Viewing history — this day is read-only.</Text>
          </View>
        ) : null}
        {dayMode === 'backfill' ? (
          <View style={styles.backfillBanner}>
            <Text style={styles.backfillBannerText}>
              Logging for {weekdayLabel(selectedDate)} — add your progress photo for this day.
            </Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {hasTemplate && bioProfile && !bioProfile.profile_complete && dayMode === 'today' ? (
          <Pressable
            style={styles.bioBanner}
            onPress={() => router.push(BIO_CALIBRATION_HREF)}
            accessibilityRole="button">
            <Text style={styles.bioBannerTitle}>Complete your skin profile</Text>
            <Text style={styles.bioBannerBody}>
              Partial verdict only until you add conditions and prescriptions.
            </Text>
          </Pressable>
        ) : null}

        {hasTemplate && evaluate && dayMode === 'today' ? (
          <>
            <BarrierScoreRing
              bfi={evaluate.barrier_friction_index ?? 0}
              subtitle={evaluate.barrier_label ? `Barrier: ${evaluate.barrier_label}` : undefined}
            />
            {evaluate.hero_title ? (
              <Text style={styles.heroTitle}>{evaluate.hero_title}</Text>
            ) : null}
            {evaluate.hero_subtitle ? (
              <Text style={styles.heroSubtitle}>{evaluate.hero_subtitle}</Text>
            ) : null}
            <View style={styles.metricRow}>
              <Pressable
                style={[
                  styles.metricChip,
                  { borderColor: overallColor(evaluate.overall) },
                ]}
                onPress={() => router.push(SCAN_HREF)}
                accessibilityRole="button"
                accessibilityLabel="Conflicts">
                <Text style={[styles.metricChipValue, { color: overallColor(evaluate.overall) }]}>
                  {evaluate.conflicts?.length ?? 0}
                </Text>
                <Text style={styles.metricChipLabel}>Conflicts</Text>
              </Pressable>
              <View style={[styles.metricChip, streakDays > 0 && { borderColor: ConflictTokens.barrierOk }]}>
                <Text style={[styles.metricChipValue, streakDays > 0 && { color: ConflictTokens.barrierOk }]}>
                  {streakDays}
                </Text>
                <Text style={styles.metricChipLabel}>Day streak</Text>
              </View>
              <View
                style={[
                  styles.metricChip,
                  skinAgeDelta != null && {
                    borderColor: skinAgeDelta <= 0 ? ConflictTokens.barrierGreat : ConflictTokens.barrierWarn,
                  },
                ]}>
                <Text
                  style={[
                    styles.metricChipValue,
                    skinAgeDelta != null && {
                      color: skinAgeDelta <= 0 ? ConflictTokens.barrierGreat : ConflictTokens.barrierWarn,
                    },
                  ]}>
                  {skinAgeDelta != null ? `${skinAgeDelta > 0 ? '+' : ''}${skinAgeDelta}` : '—'}
                </Text>
                <Text style={styles.metricChipLabel}>Skin age Δ</Text>
              </View>
            </View>
          </>
        ) : null}

        {!hasTemplate && !error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Choose your routine</Text>
            <Text style={styles.emptyBody}>
              Pick a guided program. Your daily check-in is one progress photo — we track change over time.
            </Text>
            <PrimaryButton label="Choose a routine" onPress={() => router.push('/routine/pick')} />
          </View>
        ) : null}

        {hasTemplate && weekKicker && dayMode !== 'today' ? (
          <Text style={styles.weekKicker}>{weekKicker}</Text>
        ) : null}

        {hasTemplate && evaluate?.graph_unavailable && dayMode === 'today' ? (
          <GraphUnavailableBanner />
        ) : null}

        {hasTemplate && allowsPhoto && dayMode === 'today' ? (
          <View style={styles.photoCard}>
            {todayThumbnailUrl ? (
              <SessionImage
                uri={todayThumbnailUrl}
                style={styles.photoCardImage}
                contentFit="cover"
                fallback={<Text style={styles.photoCardIcon}>{loggedForDay ? '✓' : '📷'}</Text>}
              />
            ) : null}
            {yesterdayVerdict && !loggedForDay ? (
              <View
                style={[
                  styles.verdictTag,
                  { backgroundColor: verdictTagColor(yesterdayVerdict as 'safe' | 'caution' | 'avoid') },
                ]}>
                <Text style={styles.verdictTagText}>Yesterday: {yesterdayVerdict}</Text>
              </View>
            ) : null}
            {streakDays > 0 ? (
              <View style={styles.photoStreakPill}>
                <Text style={styles.photoStreakText}>🔥 {streakDays} day streak</Text>
              </View>
            ) : null}
            {!todayThumbnailUrl ? (
              <Text style={styles.photoCardIcon}>{loggedForDay ? '✓' : '📷'}</Text>
            ) : null}
            <Text style={styles.photoCardTitle}>
              {loggedForDay ? "Today's photo logged" : 'Progress photo preview'}
            </Text>
            <Text style={styles.photoCardSub}>
              {loggedForDay ? 'Streak saved for today' : 'Same angle daily · tracks barrier + skin age'}
            </Text>
          </View>
        ) : null}

        {showStepsHero && evaluate ? (
          <View style={styles.stepsSection}>
            <Text style={styles.stepsLabel}>Today&apos;s routine</Text>
            {(evaluate.routine_step_states?.length ? evaluate.routine_step_states : phaseItems.map((item, i) => ({
              label: item.product_name || item.usage_time || `Step ${i + 1}`,
              sub: item.usage_time ? String(item.usage_time).toUpperCase() : item.goal,
              state: 'todo' as const,
            }))).map((step, i) => (
              <RoutineStepRow
                key={`${step.label}-${i}`}
                label={step.label}
                sub={step.sub}
                state={step.state === 'warn' || step.state === 'skip' ? 'warn' : step.state === 'done' ? 'done' : 'todo'}
              />
            ))}
          </View>
        ) : null}

        {showStepsHero && !evaluate ? <RoutineStepsHero steps={phaseItems} alwaysExpanded /> : null}

        {hasTemplate && dayMode === 'today' && phaseLabel ? (
          <View style={styles.phaseProgressCard}>
            <Text style={styles.phaseProgressTitle}>{phaseLabel}</Text>
            <Text style={styles.phaseProgressSub}>
              Week {programWeek} of {totalWeeks}
            </Text>
            <View style={styles.phaseProgressTrack}>
              <View
                style={[
                  styles.phaseProgressFill,
                  { width: `${Math.min(100, Math.round((programWeek / Math.max(totalWeeks, 1)) * 100))}%` },
                ]}
              />
            </View>
          </View>
        ) : null}

        {hasTemplate && allowsPhoto && dayMode !== 'today' ? (
          <View style={styles.photoActions}>
            {loggedForDay ? (
              <Text style={styles.loggedDone}>{`Logged for ${selectedDate} ✓`}</Text>
            ) : (
              <>
                <PrimaryButton
                  label="Log progress photo"
                  onPress={openCapture}
                />
                <View style={{ height: 10 }} />
                <SecondaryButton label="Upload from library" onPress={() => void pickFromLibrary()} />
              </>
            )}
          </View>
        ) : null}

        {hasTemplate && photoThumbs.length > 0 && dayMode === 'today' ? (
          <View style={styles.thumbSection}>
            <View style={styles.thumbHeader}>
              <Text style={styles.thumbLabel}>Photo history</Text>
              <Pressable
                onPress={() => router.push(PROGRESS_HREF)}
                accessibilityRole="button"
                accessibilityLabel="See all photo history">
                <Text style={styles.thumbLink}>See all</Text>
              </Pressable>
            </View>
            <View style={styles.thumbRow}>
              {photoThumbs.map((t) => {
                const isToday = t.date === localTodayIso();
                return (
                  <View
                    key={t.date}
                    style={[styles.thumb, t.logged && styles.thumbLogged, isToday && styles.thumbToday]}>
                    <Text style={styles.thumbEmoji}>{t.logged ? '📷' : isToday ? '📸' : '·'}</Text>
                    <Text style={styles.thumbDay}>{isToday ? 'Today' : t.date.slice(8)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {hasTemplate && phaseSnippet && !loggedForDay && dayMode !== 'historical' ? (
          <View style={styles.anticipateCard}>
            <Text style={styles.anticipateTitle}>What to expect</Text>
            <Text style={styles.anticipateBody}>{phaseSnippet}</Text>
          </View>
        ) : null}

        {layeringWarning && showStepsHero && !evaluate?.graph_unavailable ? (
          <View style={styles.layerCard}>
            <Text style={styles.layerTitle}>Layering note</Text>
            <Text style={styles.layerBody}>{layeringWarning}</Text>
          </View>
        ) : null}

        {hasTemplate && (phaseNotes || assistantSummary) && dayMode === 'historical' ? (
          <View style={styles.phaseCard}>
            {assistantSummary ? <Text style={styles.phaseBody}>{assistantSummary}</Text> : null}
          </View>
        ) : null}

        {hasTemplate && phaseNotes && dayMode !== 'historical' ? (
          <View style={styles.phaseCard}>
            <Pressable
              onPress={() => setPhaseNotesOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={phaseNotesOpen ? 'Hide phase details' : 'More about this phase'}
              accessibilityState={{ expanded: phaseNotesOpen }}>
              <Text style={styles.phaseExpand}>
                {phaseNotesOpen ? 'Hide phase details' : 'More about this phase'}
              </Text>
            </Pressable>
            {phaseNotesOpen && phaseNotes ? <Text style={styles.phaseNotes}>{phaseNotes}</Text> : null}
          </View>
        ) : null}

        {hasTemplate && redFlags.length > 0 && dayMode !== 'historical' ? (
          <View style={styles.redCard}>
            <Text style={styles.redTitle}>When to seek help</Text>
            {redFlags.slice(0, 3).map((f) => (
              <Text key={f} style={styles.redBody}>
                • {f}
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={styles.disclaimer}>
          Not a diagnosis. See a dermatologist if your symptoms worsen or you are unsure.
        </Text>
      </ScrollView>
      {hasTemplate && allowsPhoto && dayMode === 'today' && !loggedForDay ? (
        <Pressable
          style={styles.bottomFab}
          onPress={openCapture}
          accessibilityRole="button"
          accessibilityLabel="Take today's photo">
          <Text style={styles.bottomFabText}>Take today&apos;s photo</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: JournalTokens.color.cream },
  content: { padding: JournalTokens.spacing.lg, gap: JournalTokens.spacing.sm, paddingBottom: 100 },
  title: { fontFamily: JournalTokens.font.display, fontSize: 30, color: JournalTokens.color.ink },
  subtitle: { fontFamily: JournalTokens.font.body, color: JournalTokens.color.muted, marginBottom: JournalTokens.spacing.sm },
  todayHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: JournalTokens.spacing.sm,
  },
  greeting: { fontFamily: JournalTokens.font.display, fontSize: 22, color: JournalTokens.color.ink },
  daySub: { color: JournalTokens.color.muted, fontSize: 12, marginTop: 2 },
  streakPill: {
    backgroundColor: '#faeeda',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  streakText: { fontSize: 12, fontWeight: '700', color: '#633806' },
  bioBanner: {
    backgroundColor: ConflictTokens.cardAmber,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  bioBannerTitle: { fontWeight: '700', color: ConflictTokens.cardAmberText, marginBottom: 4 },
  bioBannerBody: { fontSize: 13, color: '#4B5563', lineHeight: 18 },
  metricRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  metricChip: {
    flex: 1,
    backgroundColor: JournalTokens.color.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: JournalTokens.color.line,
    padding: 12,
    alignItems: 'center',
  },
  metricChipValue: { fontSize: 20, fontWeight: '800', color: JournalTokens.color.ink },
  metricChipLabel: { fontSize: 11, color: JournalTokens.color.muted, marginTop: 2 },
  stepsSection: { marginTop: 8, marginBottom: 8 },
  stepsLabel: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 8 },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: JournalTokens.color.ink,
    textAlign: 'center',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: JournalTokens.color.muted,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20,
  },
  photoCard: {
    backgroundColor: ConflictTokens.photoBg,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 8,
    minHeight: 140,
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  photoCardImage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    opacity: 0.35,
  },
  photoStreakPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  photoStreakText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  photoCardIcon: { fontSize: 32, marginBottom: 8 },
  photoCardTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  photoCardSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4, textAlign: 'center' },
  bottomFab: {
    position: 'absolute',
    bottom: 24,
    left: JournalTokens.spacing.lg,
    right: JournalTokens.spacing.lg,
    backgroundColor: ConflictTokens.fabBg,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  bottomFabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  verdictTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  verdictTagText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  phaseProgressCard: {
    backgroundColor: JournalTokens.color.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: JournalTokens.color.line,
    padding: 14,
    marginBottom: 8,
    gap: 6,
  },
  phaseProgressTitle: {
    fontFamily: JournalTokens.font.body,
    fontWeight: '700',
    fontSize: 15,
    color: JournalTokens.color.ink,
  },
  phaseProgressSub: { fontSize: 12, color: JournalTokens.color.muted },
  phaseProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: JournalTokens.color.line,
    overflow: 'hidden',
    marginTop: 4,
  },
  phaseProgressFill: {
    height: '100%',
    backgroundColor: JournalTokens.color.brandAccent,
    borderRadius: 3,
  },
  checkinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: JournalTokens.color.brandAccent,
    borderRadius: 18,
    padding: 16,
    marginBottom: 8,
  },
  checkinCardDone: { opacity: 0.85 },
  checkinCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#eef4ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkinIcon: { fontSize: 22 },
  checkinCopy: { flex: 1 },
  checkinTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  checkinSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  checkinArrow: { color: 'rgba(255,255,255,0.75)', fontSize: 22 },
  thumbSection: { marginTop: 4, marginBottom: 8 },
  thumbHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  thumbLabel: { fontSize: 12, color: JournalTokens.color.muted },
  thumbLink: { fontSize: 12, color: JournalTokens.color.brandAccent, fontWeight: '700' },
  thumbRow: { flexDirection: 'row', gap: 6 },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: JournalTokens.color.card,
    borderWidth: 1,
    borderColor: JournalTokens.color.line,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.45,
  },
  thumbLogged: { backgroundColor: '#eef4ff', opacity: 1 },
  thumbToday: { borderColor: JournalTokens.color.brandAccent, borderWidth: 2, opacity: 1 },
  thumbEmoji: { fontSize: 18 },
  thumbDay: { position: 'absolute', bottom: 3, fontSize: 9, color: JournalTokens.color.muted },
  weekKicker: { fontWeight: '700', color: JournalTokens.color.ink, fontSize: 15, marginBottom: 4 },
  celebrateBanner: {
    backgroundColor: TimelineTokens.badgeGreenBg,
    borderRadius: JournalTokens.radius.md,
    padding: JournalTokens.spacing.md,
    marginBottom: 4,
    gap: 6,
  },
  celebrateText: { color: JournalTokens.color.ink, fontWeight: '600', fontSize: 14 },
  celebrateLink: { color: JournalTokens.color.accent, fontWeight: '700', fontSize: 14 },
  historyBanner: {
    backgroundColor: TimelineTokens.historyBannerBg,
    borderRadius: JournalTokens.radius.md,
    padding: JournalTokens.spacing.sm,
  },
  historyBannerText: { color: TimelineTokens.historyBannerFg, fontSize: 13, fontWeight: '600' },
  backfillBanner: {
    backgroundColor: TimelineTokens.backfillBannerBg,
    borderRadius: JournalTokens.radius.md,
    padding: JournalTokens.spacing.sm,
  },
  backfillBannerText: { color: TimelineTokens.backfillBannerFg, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  photoActions: { marginTop: 4, marginBottom: 8, gap: 6 },
  photoHint: { color: JournalTokens.color.muted, fontSize: 14, textAlign: 'center', marginBottom: 4 },
  dayOneHint: {
    color: JournalTokens.color.terracotta,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  overlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  overlayCard: {
    backgroundColor: JournalTokens.color.card,
    borderTopLeftRadius: JournalTokens.radius.lg,
    borderTopRightRadius: JournalTokens.radius.lg,
    padding: JournalTokens.spacing.lg,
    gap: 12,
  },
  overlayTitle: { fontSize: 20, fontWeight: '700', color: JournalTokens.color.ink },
  overlayBody: { color: JournalTokens.color.muted, lineHeight: 22, marginBottom: 4 },
  loggedDone: {
    color: JournalTokens.color.success,
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 14,
  },
  anticipateCard: {
    backgroundColor: JournalTokens.color.card,
    borderRadius: JournalTokens.radius.md,
    borderWidth: 1,
    borderColor: JournalTokens.color.line,
    padding: JournalTokens.spacing.md,
    gap: 6,
  },
  anticipateTitle: { fontWeight: '700', color: JournalTokens.color.ink, fontSize: 14 },
  anticipateBody: { color: JournalTokens.color.muted, lineHeight: 20, fontSize: 14 },
  emptyCard: {
    backgroundColor: JournalTokens.color.card,
    borderRadius: JournalTokens.radius.md,
    borderWidth: 1,
    borderColor: JournalTokens.color.line,
    padding: JournalTokens.spacing.md,
    gap: 10,
  },
  emptyTitle: { fontWeight: '700', color: JournalTokens.color.ink, fontSize: 17 },
  emptyBody: { color: JournalTokens.color.muted, lineHeight: 20, fontFamily: JournalTokens.font.body },
  phaseCard: {
    backgroundColor: JournalTokens.color.card,
    borderRadius: JournalTokens.radius.md,
    borderWidth: 1,
    borderColor: JournalTokens.color.line,
    padding: JournalTokens.spacing.md,
    gap: 8,
  },
  phaseBody: { color: JournalTokens.color.muted, lineHeight: 22, fontFamily: JournalTokens.font.body, fontSize: 15 },
  phaseExpand: { color: JournalTokens.color.accent, fontWeight: '600', fontSize: 13 },
  phaseNotes: { color: JournalTokens.color.muted, fontSize: 13, lineHeight: 20 },
  redCard: {
    backgroundColor: '#fef2f2',
    borderRadius: JournalTokens.radius.md,
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: JournalTokens.spacing.md,
  },
  redTitle: { fontWeight: '700', color: '#991b1b', marginBottom: 4 },
  redBody: { color: '#991b1b', fontSize: 13 },
  error: { color: '#b91c1c', fontSize: 13 },
  layerCard: {
    backgroundColor: '#fff7ed',
    borderRadius: JournalTokens.radius.md,
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: 12,
    gap: 4,
  },
  layerTitle: { fontWeight: '700', color: '#9a3412', fontSize: 13 },
  layerBody: { color: '#9a3412', fontSize: 12, lineHeight: 18 },
  disclaimer: {
    color: JournalTokens.color.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 8,
  },
});
