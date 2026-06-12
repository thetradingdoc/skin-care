import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JournalCalendarTab } from '@/components/journal/JournalCalendarTab';
import { JournalDocumentsTab } from '@/components/journal/JournalDocumentsTab';
import { JournalListTab } from '@/components/journal/JournalListTab';
import { JournalPhotosTab } from '@/components/journal/JournalPhotosTab';
import { ErrorCard, LoadingCard, OfflineBanner, useToast } from '@/components/billing-feedback';
import {
  SUBVIEWS,
  type Subview,
  type CalendarDay,
  type PhaseChip,
  type BillingEvent,
  type BillingDoc,
  groupEventsByServiceDate,
  monthKeysFromSources,
  computeStats,
  rollingJournalRange,
  todayIsoLocal,
  formatUsd,
} from '@/components/journal/journalTypes';
import { styles } from '@/components/journal/journalStyles';
import { BillingLifecycleStatus, BillingV1 } from '@/constants/billingV1';
import { JournalTokens } from '@/constants/journalTokens';
import { TimelineTokens } from '@/constants/timelineTokens';
import { findPriorMediaDate } from '@/lib/routine-compare';
import { patientGet, patientPatch } from '@/lib/patient-api';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';

export default function JournalScreen() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const { showToast } = useToast();
  const [activeView, setActiveView] = useState<Subview>('Photos');
  const [showCalendarBills, setShowCalendarBills] = useState(false);
  const [rows, setRows] = useState<CalendarDay[]>([]);
  const [events, setEvents] = useState<BillingEvent[]>([]);
  const [documents, setDocuments] = useState<BillingDoc[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [daySheetIso, setDaySheetIso] = useState<string | null>(null);
  const [routineSheetIso, setRoutineSheetIso] = useState<string | null>(null);
  const [docDetail, setDocDetail] = useState<BillingDoc | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [templateStartDate, setTemplateStartDate] = useState<string | null>(null);
  const [phaseChips, setPhaseChips] = useState<PhaseChip[]>([]);
  const [scrollToIso, setScrollToIso] = useState<string | null>(null);

  const loadRange = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      setError(null);
      setOffline(false);
      try {
        const { start, end } = rollingJournalRange(180);
        const [calendarData, eventsData, docsData] = await Promise.all([
          patientGet(
            `/api/patient/journal/calendar-range?start=${start}&end=${end}&timezone=UTC&include_empty_days=1`,
          ),
          patientGet('/api/patient/billing/events?limit=200'),
          patientGet('/api/patient/billing/documents?limit=200'),
        ]);
        if (calendarData && calendarData.has_template === false) {
          router.replace('/routine/pick');
          return;
        }
        const nextRows = Array.isArray(calendarData?.days) ? calendarData.days : [];
        const raw = Array.isArray(eventsData?.events) ? (eventsData.events as BillingEvent[]) : [];
        const nextDocs = Array.isArray(docsData?.documents) ? (docsData.documents as BillingDoc[]) : [];
        setRows(nextRows);
        setEvents(raw);
        setDocuments(nextDocs);
        const tplStart = calendarData?.template?.start_date;
        setTemplateStartDate(typeof tplStart === 'string' ? tplStart : null);
        try {
          const phaseRes = await patientGet(`/api/patient/routine/phase?date=${todayIsoLocal()}`);
          const phases = Array.isArray(phaseRes?.phase?.phases) ? phaseRes.phase.phases : [];
          setPhaseChips(
            phases.map((p: PhaseChip) => ({
              key: String(p.key || `${p.week_start}`),
              label: String(p.label || `Week ${p.week_start}`),
              week_start: Number(p.week_start) || 1,
              week_end: Number(p.week_end) || 1,
            })),
          );
        } catch {
          setPhaseChips([]);
        }
        setSelectedEventId((current) => current ?? raw[0]?.id ?? null);
        if (mode === 'refresh') showToast('Timeline refreshed', 'success');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unable to load timeline.';
        setError(msg);
        setOffline(/network request failed|offline|network/i.test(msg));
        setRows([]);
        setEvents([]);
        setDocuments([]);
        showToast('Timeline load failed', 'error');
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [router, showToast],
  );

  useEffect(() => {
    void loadRange();
  }, [loadRange]);

  const billingByDay = useMemo(() => groupEventsByServiceDate(events), [events]);
  const stats = useMemo(() => computeStats(events), [events]);
  const photoDays = useMemo(
    () =>
      rows
        .filter((r) => r.has_media && r.thumbnail_url)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [rows],
  );

  const monthGroups = useMemo(() => {
    const keys = monthKeysFromSources(rows, events);
    const map = new Map<string, CalendarDay[]>();
    rows.forEach((r) => {
      const key = String(r.date || '').slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(r);
    });
    keys.forEach((k) => {
      if (!map.has(k)) map.set(k, []);
    });
    return map;
  }, [rows, events]);

  const duplicateIds = useMemo(() => {
    const keyCount = new Map<string, number>();
    events.forEach((event) => {
      const key = `${event.provider_name || ''}::${event.service_date || ''}::${event.amount_cents || 0}`;
      keyCount.set(key, (keyCount.get(key) || 0) + 1);
    });
    const ids = new Set<string>();
    events.forEach((event) => {
      const key = `${event.provider_name || ''}::${event.service_date || ''}::${event.amount_cents || 0}`;
      if ((keyCount.get(key) || 0) > 1) ids.add(event.id);
    });
    return ids;
  }, [events]);

  const filteredEvents = useMemo(() => {
    const scoped = statusFilter === 'all' ? events : events.filter((e) => e.status === statusFilter);
    return scoped.sort((a, b) => String(b.service_date || '').localeCompare(String(a.service_date || '')));
  }, [events, statusFilter]);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) || null,
    [events, selectedEventId],
  );

  const persistStatus = useCallback(
    async (next: BillingLifecycleStatus | string) => {
      if (!selectedEvent) return;
      setStatusSaving(true);
      try {
        await patientPatch(`/api/patient/billing/events/${selectedEvent.id}`, { status: next });
        setEvents((prev) => prev.map((e) => (e.id === selectedEvent.id ? { ...e, status: next } : e)));
        showToast(`Status saved: ${next}`, 'success');
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : 'Could not save status', 'error');
      } finally {
        setStatusSaving(false);
      }
    },
    [selectedEvent, showToast],
  );

  const sheetDayEvents = daySheetIso ? billingByDay.get(daySheetIso) || [] : [];
  const sheetRoutineRow = daySheetIso ? rows.find((r) => r.date === daySheetIso) : undefined;
  const routineSheetRow = routineSheetIso ? rows.find((r) => r.date === routineSheetIso) : undefined;

  if (checking || !ready) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <ActivityIndicator color={JournalTokens.color.accent} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadRange('refresh')} />
        }>
        <View style={styles.headerBlock}>
          <Text allowFontScaling style={styles.title}>
            Timeline
          </Text>
          <Text allowFontScaling style={styles.subtitle}>
            Your progress photos and routine journey.
          </Text>
        </View>

        {offline ? <OfflineBanner message={BillingV1.copy.offline} /> : null}
        {loading ? <LoadingCard label="Loading timeline..." /> : null}

        <View style={styles.segmentShell} accessibilityRole="tablist" accessibilityLabel="Timeline views">
          {SUBVIEWS.map((label, idx) => (
            <Pressable
              key={label}
              accessibilityRole="tab"
              accessibilityHint={`Show ${label} on the timeline`}
              accessibilityState={{ selected: activeView === label }}
              onPress={() => setActiveView(label)}
              style={[
                styles.segmentCell,
                idx === SUBVIEWS.length - 1 && styles.segmentCellLast,
                activeView === label && styles.segmentCellActive,
              ]}>
              <Text allowFontScaling style={[styles.segmentText, activeView === label && styles.segmentTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeView !== 'Photos' ? (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text
                style={[
                  styles.statVal,
                  stats.billsDue > 0 ? { color: TimelineTokens.amountOwe } : { color: JournalTokens.color.ink },
                ]}>
                {stats.billsDue}
              </Text>
              <Text style={styles.statLbl}>Bills due</Text>
            </View>
            <View style={styles.statCard}>
              <Text
                style={[
                  styles.statVal,
                  stats.owedMonth > 0 ? { color: TimelineTokens.amountPending } : { color: JournalTokens.color.ink },
                ]}>
                {formatUsd(stats.owedMonth)}
              </Text>
              <Text style={styles.statLbl}>Owed this month</Text>
            </View>
            <View style={styles.statCard}>
              <Text
                style={[
                  styles.statVal,
                  stats.paidMonth > 0 ? { color: TimelineTokens.amountPaid } : { color: JournalTokens.color.ink },
                ]}>
                {formatUsd(stats.paidMonth)}
              </Text>
              <Text style={styles.statLbl}>Paid this month</Text>
            </View>
          </View>
        ) : null}

        {error ? (
          <ErrorCard title="Unable to load timeline" message={error} onRetry={() => void loadRange('refresh')} />
        ) : null}

        {activeView === 'Photos' ? (
          <JournalPhotosTab photoDays={photoDays} onOpenRoutineSheet={setRoutineSheetIso} />
        ) : null}
        {activeView === 'Calendar' ? (
          <JournalCalendarTab
            rows={rows}
            monthGroups={monthGroups}
            billingByDay={billingByDay}
            filteredEvents={filteredEvents}
            phaseChips={phaseChips}
            templateStartDate={templateStartDate}
            showCalendarBills={showCalendarBills}
            scrollToIso={scrollToIso}
            onToggleCalendarBills={() => setShowCalendarBills((v) => !v)}
            onScrollToIso={setScrollToIso}
            onOpenDaySheet={setDaySheetIso}
            onOpenRoutineSheet={setRoutineSheetIso}
            onActiveViewChange={setActiveView}
            onSelectEvent={setSelectedEventId}
          />
        ) : null}
        {activeView === 'List' ? (
          <JournalListTab
            filteredEvents={filteredEvents}
            selectedEvent={selectedEvent}
            selectedEventId={selectedEventId}
            statusFilter={statusFilter}
            duplicateIds={duplicateIds}
            statusSaving={statusSaving}
            onStatusFilterChange={setStatusFilter}
            onSelectEvent={setSelectedEventId}
            onPersistStatus={(next) => void persistStatus(next)}
          />
        ) : null}
        {activeView === 'Documents' ? (
          <JournalDocumentsTab rows={rows} documents={documents} onOpenDocDetail={setDocDetail} />
        ) : null}
      </ScrollView>

      <Modal visible={!!daySheetIso} animationType="slide" transparent onRequestClose={() => setDaySheetIso(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDaySheetIso(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{daySheetIso}</Text>
            {sheetDayEvents.length ? (
              <>
                <Text style={styles.modalSection}>Billing</Text>
                {sheetDayEvents.map((ev) => (
                  <View key={ev.id} style={styles.modalRow}>
                    <Text style={styles.modalEvTitle}>{ev.title}</Text>
                    <Text style={styles.modalEvMeta}>
                      {ev.provider_name || '—'} · ${(Number(ev.amount_cents || 0) / 100).toFixed(2)} · {ev.status}
                    </Text>
                  </View>
                ))}
              </>
            ) : (
              <Text style={styles.modalEmpty}>No bills on this date.</Text>
            )}
            {sheetRoutineRow?.is_routine_day || sheetRoutineRow?.has_entry ? (
              <>
                <Text style={styles.modalSection}>Routine</Text>
                <Pressable
                  style={styles.modalLink}
                  onPress={() => {
                    setDaySheetIso(null);
                    router.push({ pathname: '/(tabs)/home', params: { date: daySheetIso || '' } });
                  }}>
                  <Text style={styles.modalLinkText}>Open routine for this day →</Text>
                </Pressable>
              </>
            ) : null}
            <Pressable style={styles.modalClose} onPress={() => setDaySheetIso(null)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!routineSheetIso}
        animationType="slide"
        transparent
        onRequestClose={() => setRoutineSheetIso(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setRoutineSheetIso(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{routineSheetIso}</Text>
            {routineSheetRow?.thumbnail_url ? (
              <Image source={{ uri: routineSheetRow.thumbnail_url }} style={styles.routineSheetImage} />
            ) : null}
            {routineSheetRow?.milestone_label ? (
              <Text style={styles.modalEvMeta}>{routineSheetRow.milestone_label}</Text>
            ) : null}
            {routineSheetRow?.phase_expect_snippet ? (
              <Text style={styles.modalBody}>{routineSheetRow.phase_expect_snippet}</Text>
            ) : null}
            {routineSheetRow?.top_symptom ? (
              <Text style={styles.modalEvMeta}>Symptom: {routineSheetRow.top_symptom}</Text>
            ) : null}
            <Pressable
              style={styles.modalLink}
              onPress={() => {
                setRoutineSheetIso(null);
                router.push({ pathname: '/(tabs)/home', params: { date: routineSheetIso || '' } });
              }}>
              <Text style={styles.modalLinkText}>Open full day →</Text>
            </Pressable>
            {routineSheetRow?.has_media ? (
              <Pressable
                style={styles.modalLink}
                onPress={() => {
                  const prior = findPriorMediaDate(rows, routineSheetIso || '');
                  if (!prior) return;
                  setRoutineSheetIso(null);
                  router.push({ pathname: '/compare', params: { dateA: routineSheetIso || '', dateB: prior } });
                }}>
                <Text style={styles.modalLinkText}>Compare to previous photo →</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.modalClose} onPress={() => setRoutineSheetIso(null)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!docDetail} transparent animationType="fade" onRequestClose={() => setDocDetail(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDocDetail(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{docDetail?.file_name || 'Document'}</Text>
            <Text style={styles.modalEvMeta}>
              Uploaded {docDetail ? new Date(docDetail.created_at).toLocaleString() : ''}
            </Text>
            {docDetail?.parse_status ? (
              <Text style={styles.modalEvMeta}>Parse: {docDetail.parse_status}</Text>
            ) : null}
            <Pressable style={styles.modalClose} onPress={() => setDocDetail(null)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
