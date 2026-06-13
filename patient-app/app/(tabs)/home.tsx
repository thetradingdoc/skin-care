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

import { BarrierScoreRing, GraphUnavailableBanner, RoutineStepRow } from '@/components/conflict';
import { SessionImage } from '@/components/SessionImage';
import { ConsumerPrimaryButton, SecondaryButton } from '@/components/billing-ui';
import { AppTokens } from '@/constants/appTokens';
import { ConflictTokens } from '@/constants/conflictTokens';
import { JournalTokens } from '@/constants/journalTokens';
import { TimelineTokens } from '@/constants/timelineTokens';
import {
  ConditionChipRow,
  JournalLogCta,
  JournalLoggedCard,
  JournalNoteField,
  TriggerInsightCard,
} from '@/components/journal/JournalHomeBlocks';
import { JournalRecentPhotos } from '@/components/journal/JournalRecentPhotos';
import { AppFontFamilies } from '@/components/ui/AppFontsProvider';
import { DailyPhotoCta, MetricChipRow, NextActionCard, SectionLabel } from '@/components/v3';
import { HOME_HREF, SCAN_HREF, PROGRESS_HREF, BIO_CALIBRATION_HREF } from '@/constants/routes';
import {
  fetchTriggerInsights,
  patchJournalDailyEntry,
  type JournalConditionTag,
  type TriggerInsight,
} from '@/lib/journal-api';
import { hasRoutineMode, hasWatchMode } from '@/lib/journey-mode-storage';
import { fetchBioProfile, fetchEvaluateLineup, fetchNextActions, type NextAction } from '@/lib/conflict-api';
import type { BioProfile, EvaluateResult } from '@/lib/conflict-types';
import { verdictTagColor, overallColor } from '@/lib/conflict-helpers';
import { patientGet } from '@/lib/patient-api';
import { trackPortalEvent } from '@/lib/trackPortalEvent';
import type { SkinReportPayload } from '@/lib/routine-capture';
import { localTodayIso, resolveRoutineDayMode, weekdayLabel, type RoutineDayMode } from '@/lib/routine-day-mode';
import { buildGroupedRoutineSteps } from '@/lib/routine-steps-display';
import {
  celebrateBannerCopy,
  todayScreenTitle,
} from '@/lib/routine-copy';
import { useToast } from '@/components/billing-feedback';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { getNeedsFirstPhoto } from '@/lib/onboarding-storage';
import { getStoredEmail } from '@/lib/patient-session';
import { setPendingCaptureUri } from '@/lib/pending-capture-uri';
import { mimeTypeFromImagePickerAsset } from '@/lib/upload-uri';

type PhaseItem = {
  product_name?: string;
  usage_time?: string;
  goal?: string;
};

function friendlyLoadError(raw: unknown): string | null {
  const msg = raw instanceof Error ? raw.message : String(raw || '');
  if (/no such table|SQLITE|ECONNREFUSED/i.test(msg)) {
    return null;
  }
  return 'We had trouble loading your routine. Pull to refresh.';
}

export default function HomeScreen() {
  const { ready, checking } = useRequirePatientSession();
  const { showToast } = useToast();
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
  const [photoThumbs, setPhotoThumbs] = useState<
    { date: string; logged: boolean; thumbnail_url?: string | null }[]
  >([]);
  const [todayThumbnailUrl, setTodayThumbnailUrl] = useState<string | null>(null);
  const photoTriggeredRef = useRef(false);
  const [watchOnly, setWatchOnly] = useState(false);
  const [journalMode, setJournalMode] = useState(false);
  const [journalTags, setJournalTags] = useState<JournalConditionTag[]>([]);
  const [journalNote, setJournalNote] = useState('');
  const [journalLogged, setJournalLogged] = useState(false);
  const [triggerInsights, setTriggerInsights] = useState<TriggerInsight[]>([]);
  const [savingCheckin, setSavingCheckin] = useState(false);
  const [nextActions, setNextActions] = useState<NextAction[]>([]);

  const clientDayMode = resolveRoutineDayMode(selectedDate);

  const saveJournalCheckin = useCallback(
    async (tags: JournalConditionTag[], note: string) => {
      if (dayMode !== 'today' || savingCheckin) return;
      setSavingCheckin(true);
      try {
        await patchJournalDailyEntry({
          entryDate: selectedDate,
          conditionTags: tags,
          note: note.trim() || null,
        });
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : 'Could not save check-in', 'error');
      } finally {
        setSavingCheckin(false);
      }
    },
    [dayMode, savingCheckin, selectedDate, showToast],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const todayIso = localTodayIso();
      const thumbStart = new Date(`${todayIso}T12:00:00.000Z`);
      thumbStart.setUTCDate(thumbStart.getUTCDate() - 4);
      const thumbStartIso = thumbStart.toISOString().slice(0, 10);

      const [templateRes, dailyRes, phaseRes, progressRes, calRes, nextRes, insightsRes] = await Promise.all([
        patientGet('/api/patient/routine/template'),
        patientGet(`/api/patient/routine/daily?date=${selectedDate}`),
        patientGet(`/api/patient/routine/phase?date=${selectedDate}`).catch(() => null),
        patientGet('/api/patient/home/progress-summary').catch(() => null),
        patientGet(
          `/api/patient/journal/calendar-range?start=${thumbStartIso}&end=${todayIso}&include_empty_days=1`,
        ).catch(() => ({ days: [] })),
        fetchNextActions().catch((e: unknown) => {
          showToast(
            e instanceof Error ? e.message : 'Could not load suggested actions',
            'error',
          );
          return [] as NextAction[];
        }),
        fetchTriggerInsights().catch(() => ({ ready: false, insights: [] })),
      ]);
      setNextActions(nextRes);
      setTriggerInsights(Array.isArray(insightsRes?.insights) ? insightsRes.insights : []);
      if (progressRes) {
        trackPortalEvent('home_summary_viewed');
        trackPortalEvent('home_viewed');
      }
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
      const todayTags = Array.isArray(todayCal?.condition_tags)
        ? (todayCal.condition_tags as JournalConditionTag[])
        : [];
      setJournalTags(todayTags);
      setJournalNote(typeof todayCal?.note === 'string' ? todayCal.note : '');
      const todayHasJournal =
        Boolean(todayCal?.has_media) ||
        todayTags.length > 0 ||
        Boolean(todayCal?.note && String(todayCal.note).trim());
      setJournalLogged(todayHasJournal);
      setTodayThumbnailUrl(
        todayCal?.thumbnail_url && typeof todayCal.thumbnail_url === 'string' ? todayCal.thumbnail_url : null,
      );
      setPhotoThumbs(
        calDays.slice(-5).map((d: { date: string; completion_score?: number; has_media?: boolean; thumbnail_url?: string }) => ({
          date: d.date,
          logged: (d.completion_score || 0) >= 100 || Boolean(d.has_media),
          thumbnail_url: d.thumbnail_url ?? null,
        })),
      );
      const templateActive = Boolean(templateRes?.has_template);
      setHasTemplate(templateActive);
      const [watch, routine] = await Promise.all([hasWatchMode(), hasRoutineMode()]);
      const isJournalFirst = (watch && !routine) || !templateActive;
      setWatchOnly(watch && !routine);
      setJournalMode(isJournalFirst);
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
      setError(friendlyLoadError(e));
      setHasTemplate(false);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, clientDayMode.mode, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCapture = useCallback(() => {
    if (!allowsPhoto) return;
    const capturePath = journalMode && !hasTemplate ? '/journal/capture' : '/routine/capture';
    router.push({ pathname: capturePath, params: { date: selectedDate } } as Parameters<
      typeof router.push
    >[0]);
  }, [allowsPhoto, hasTemplate, journalMode, router, selectedDate]);

  const pickFromLibrary = useCallback(async () => {
    if (!allowsPhoto) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library access is required.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (picked.canceled || !picked.assets?.[0]?.uri) return;
    const asset = picked.assets[0];
    setPendingCaptureUri(asset.uri, mimeTypeFromImagePickerAsset(asset));
    const capturePath = journalMode && !hasTemplate ? '/journal/capture' : '/routine/capture';
    router.push({ pathname: capturePath, params: { date: selectedDate, library: '1' } } as Parameters<
      typeof router.push
    >[0]);
  }, [allowsPhoto, hasTemplate, journalMode, router, selectedDate]);

  const loggedForDay = completionScore != null && completionScore >= 100;

  useEffect(() => {
    void getNeedsFirstPhoto().then(setNeedsFirstPhoto);
  }, []);

  useEffect(() => {
    if (loggedForDay) setNeedsFirstPhoto(false);
  }, [loggedForDay]);

  useEffect(() => {
    if (params.photo !== '1' || photoTriggeredRef.current || loading || !allowsPhoto) return;
    if (!journalMode && !hasTemplate) return;
    photoTriggeredRef.current = true;
    openCapture();
  }, [params.photo, loading, hasTemplate, journalMode, allowsPhoto, openCapture]);

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
      <Modal
        visible={needsFirstPhoto && (hasTemplate || journalMode) && !loggedForDay && !journalLogged}
        animationType="slide"
        transparent>
        <View style={styles.overlayBackdrop}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>Day 1 — log today&apos;s photo</Text>
            <Text style={styles.overlayBody}>
              Your daily check-in is one progress photo. Same time tomorrow keeps your track consistent.
            </Text>
            <ConsumerPrimaryButton label="Take progress photo" onPress={openCapture} />
          </View>
        </View>
      </Modal>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
        {(hasTemplate || journalMode) && dayMode === 'today' ? (
          <View style={styles.todayHeader}>
            <View>
              <Text allowFontScaling style={styles.greeting}>
                Good morning, {greetingName}
              </Text>
              <Text allowFontScaling style={styles.daySub}>
                {hasTemplate
                  ? `Day ${Math.max(1, (programWeek - 1) * 7 + 1)} · Week ${programWeek} of ${totalWeeks}`
                  : `Day ${Math.max(1, streakDays || 1)} · ${selectedDate}`}
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

        {journalMode && dayMode === 'today' ? (
          <>
            {journalLogged && todayThumbnailUrl ? (
              <JournalLoggedCard
                conditionLabel={journalTags[0]?.replace(/_/g, ' ') || null}
                note={journalNote || null}
                thumbnailUrl={todayThumbnailUrl}
              />
            ) : journalLogged ? (
              <JournalLoggedCard
                conditionLabel={journalTags[0]?.replace(/_/g, ' ') || null}
                note={journalNote || null}
              />
            ) : (
              <JournalLogCta onPress={openCapture} />
            )}
            <SectionLabel>How does your skin feel today?</SectionLabel>
            <ConditionChipRow
              selected={journalTags}
              disabled={dayMode !== 'today'}
              onChange={(tags) => {
                setJournalTags(tags);
                void saveJournalCheckin(tags, journalNote);
              }}
            />
            <JournalNoteField
              value={journalNote}
              disabled={dayMode !== 'today'}
              onChange={setJournalNote}
              onBlur={() => void saveJournalCheckin(journalTags, journalNote)}
            />
            {triggerInsights.length > 0 ? (
              <>
                <SectionLabel>Trigger insight</SectionLabel>
                {triggerInsights.map((insight) => (
                  <TriggerInsightCard key={insight.keyword || insight.label} insight={insight} />
                ))}
              </>
            ) : null}
            {photoThumbs.length > 0 ? (
              <JournalRecentPhotos
                thumbs={photoThumbs}
                onSeeAll={() => router.push(PROGRESS_HREF)}
                onOpenDay={(date) =>
                  router.push(`${HOME_HREF}?date=${date}` as typeof HOME_HREF)
                }
              />
            ) : null}
          </>
        ) : null}

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

        {!watchOnly && hasTemplate && nextActions.length > 0 && dayMode === 'today' ? (
          <NextActionCard actions={nextActions} />
        ) : null}

        {!watchOnly && hasTemplate && evaluate && dayMode === 'today' ? (
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
            <MetricChipRow
              chips={[
                {
                  label: 'conflicts',
                  value: String(evaluate.conflicts?.length ?? 0),
                  color: overallColor(evaluate.overall),
                  onPress: () => router.push(SCAN_HREF),
                },
                {
                  label: 'day streak',
                  value: String(streakDays),
                  color: streakDays > 0 ? ConflictTokens.barrierOk : undefined,
                },
                {
                  label: 'skin age',
                  value:
                    skinAgeDelta != null ? `${skinAgeDelta > 0 ? '+' : ''}${skinAgeDelta}` : '—',
                  color:
                    skinAgeDelta != null
                      ? skinAgeDelta <= 0
                        ? ConflictTokens.barrierGreat
                        : ConflictTokens.barrierWarn
                      : undefined,
                },
              ]}
            />
          </>
        ) : null}

        {hasTemplate && weekKicker && dayMode !== 'today' ? (
          <Text style={styles.weekKicker}>{weekKicker}</Text>
        ) : null}

        {hasTemplate && evaluate?.graph_unavailable && dayMode === 'today' ? (
          <GraphUnavailableBanner
            onRetry={() => {
              void (async () => {
                try {
                  const evalRes = await fetchEvaluateLineup();
                  setEvaluate(evalRes);
                } catch (e: unknown) {
                  showToast(e instanceof Error ? e.message : 'Could not reload routine check', 'error');
                }
              })();
            }}
          />
        ) : null}

        {!watchOnly && hasTemplate && allowsPhoto && dayMode === 'today' ? (
          <>
            <SectionLabel>Daily photo</SectionLabel>
            {loggedForDay ? (
              <View style={styles.photoCard}>
                {todayThumbnailUrl ? (
                  <SessionImage
                    uri={todayThumbnailUrl}
                    style={styles.photoCardImage}
                    contentFit="cover"
                    fallback={<Text style={styles.photoCardIcon}>✓</Text>}
                  />
                ) : (
                  <Text style={styles.photoCardIcon}>✓</Text>
                )}
                <Text style={styles.photoCardTitle}>Today&apos;s photo logged</Text>
                <Text style={styles.photoCardSub}>Streak saved for today</Text>
              </View>
            ) : (
              <DailyPhotoCta
                onPress={openCapture}
                streakDays={streakDays}
                verdictLabel={
                  yesterdayVerdict ? `Yesterday: ${yesterdayVerdict}` : undefined
                }
                verdictColor={
                  yesterdayVerdict
                    ? verdictTagColor(yesterdayVerdict as 'safe' | 'caution' | 'avoid')
                    : undefined
                }
              />
            )}
          </>
        ) : null}

        {showStepsHero ? (
          <View style={styles.stepsSection}>
            <SectionLabel>Today&apos;s routine</SectionLabel>
            {(() => {
              const { am, pm, other } = buildGroupedRoutineSteps(
                phaseItems,
                evaluate?.routine_step_states,
              );
              const renderGroup = (label: string, steps: typeof am) =>
                steps.length ? (
                  <View key={label} style={styles.stepGroup}>
                    <Text style={styles.stepGroupLabel}>{label}</Text>
                    {steps.map((step, i) => (
                      <RoutineStepRow
                        key={`${label}-${step.label}-${i}`}
                        label={step.label}
                        sub={step.sub}
                        state={step.state}
                      />
                    ))}
                  </View>
                ) : null;
              return (
                <>
                  {renderGroup('Morning', am)}
                  {renderGroup('Evening', pm)}
                  {renderGroup('Anytime', other)}
                </>
              );
            })()}
          </View>
        ) : null}

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
                <ConsumerPrimaryButton
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  content: { padding: JournalTokens.spacing.lg, gap: JournalTokens.spacing.sm, paddingBottom: 100 },
  title: { fontFamily: JournalTokens.font.display, fontSize: 30, color: JournalTokens.color.ink },
  subtitle: { fontFamily: JournalTokens.font.body, color: JournalTokens.color.muted, marginBottom: JournalTokens.spacing.sm },
  todayHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: JournalTokens.spacing.sm,
  },
  greeting: {
    fontFamily: AppFontFamilies.display,
    fontSize: 36,
    color: JournalTokens.color.ink,
    lineHeight: 40,
  },
  daySub: { color: JournalTokens.color.muted, fontSize: 12, marginTop: 2 },
  streakPill: {
    backgroundColor: AppTokens.color.watchAmber,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E9C46A',
  },
  streakText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppTokens.color.watchAmberText,
    fontFamily: AppFontFamilies.bodySemiBold,
  },
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
  stepsSection: { marginTop: 8, marginBottom: 8, gap: 8 },
  stepGroup: { gap: 6 },
  stepGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: JournalTokens.color.muted,
    marginTop: 4,
  },
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
