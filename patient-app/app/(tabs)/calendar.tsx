/**
 * P7.26–30 / Steps 23–25 — Calendar tab: month / list / legend / empty / day detail.
 * Data: P5.10 `/api/patient/records/calendar` only.
 * Progress "See all" uses calendar-intent (no route search params).
 */
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
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

import { FactsCalendarDayDetail } from '@/components/facts-calendar/FactsCalendarDayDetail';
import { FactsCalendarEmpty } from '@/components/facts-calendar/FactsCalendarEmpty';
import { FactsCalendarLegend } from '@/components/facts-calendar/FactsCalendarLegend';
import { FactsCalendarList } from '@/components/facts-calendar/FactsCalendarList';
import { FactsCalendarMonth } from '@/components/facts-calendar/FactsCalendarMonth';
import { LoadFailedState } from '@/components/LoadFailedState';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { takeCalendarIntent, type CalendarIntent } from '@/lib/calendar-intent';
import { legendForTag, type FactsCalendarTag } from '@/lib/calendar-legend';
import {
  currentMonthKey,
  filterDaysByTag,
  monthLabel,
  rollingStartIso,
  shiftMonth,
  type FactsCalendarDay,
} from '@/lib/facts-calendar';
import { fetchFactsCalendar } from '@/lib/facts-calendar-api';
import { localTodayIso } from '@/lib/routine-day-mode';

type ViewMode = 'month' | 'list';

const PROGRESS_CALENDAR_WINDOW_DAYS = 180;

export const CALENDAR_TAGLINE = 'Every record, one history.';

export function monthHonestyFooter(daysLogged: number): string {
  const n = Math.max(0, Math.floor(daysLogged));
  const dayWord = n === 1 ? 'day' : 'days';
  return `${n} ${dayWord} logged this month — no streak invented on missed days.`;
}

export default function CalendarScreen() {
  const { ready, checking } = useRequirePatientSession();

  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filterTag, setFilterTag] = useState<FactsCalendarTag | null>(null);
  const [days, setDays] = useState<FactsCalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const filterTagRef = useRef(filterTag);
  const monthKeyRef = useRef(monthKey);
  filterTagRef.current = filterTag;
  monthKeyRef.current = monthKey;

  const applyIntent = useCallback((intent: CalendarIntent | null) => {
    if (!intent) return;
    if (intent.tag) setFilterTag(intent.tag);
    if (intent.view === 'list' || intent.view === 'month') setViewMode(intent.view);
    if (intent.date && /^\d{4}-\d{2}-\d{2}$/.test(intent.date)) {
      setSelectedIso(intent.date);
      setMonthKey(intent.date.slice(0, 7));
    }
  }, []);

  const load = useCallback(async (tag: FactsCalendarTag | null, month: string) => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const payload = tag
        ? await fetchFactsCalendar({
            start: rollingStartIso(PROGRESS_CALENDAR_WINDOW_DAYS, localTodayIso()),
            end: localTodayIso(),
          })
        : await fetchFactsCalendar({ month });
      setDays(Array.isArray(payload.days) ? payload.days : []);
    } catch {
      setDays([]);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      const intent = takeCalendarIntent();
      if (intent) {
        applyIntent(intent);
        const month =
          intent.date && /^\d{4}-\d{2}-\d{2}$/.test(intent.date)
            ? intent.date.slice(0, 7)
            : monthKeyRef.current;
        void load(intent.tag ?? null, month);
        return;
      }
      void load(filterTagRef.current, monthKeyRef.current);
    }, [ready, applyIntent, load]),
  );

  const visibleDays = useMemo(
    () => (filterTag ? filterDaysByTag(days, filterTag) : days),
    [days, filterTag],
  );

  const monthDays = useMemo(() => {
    if (filterTag) return visibleDays.filter((d) => d.date.startsWith(monthKey));
    return visibleDays;
  }, [visibleDays, filterTag, monthKey]);

  const daysByIso = useMemo(() => new Map(monthDays.map((d) => [d.date, d])), [monthDays]);
  const listDays = filterTag ? visibleDays : monthDays;
  const isEmpty =
    !loading &&
    ((viewMode === 'list' && listDays.length === 0) ||
      (viewMode === 'month' && monthDays.length === 0));

  const selectedDayForDetail = useMemo(() => {
    if (!selectedIso) return null;
    if (filterTag) {
      const filtered = filterDaysByTag(days, filterTag).find((d) => d.date === selectedIso);
      if (filtered) return filtered;
    }
    return days.find((d) => d.date === selectedIso) || null;
  }, [selectedIso, days, filterTag]);

  const clearFilter = useCallback(() => {
    setFilterTag(null);
    setViewMode('list');
    setSelectedIso(null);
    void load(null, monthKey);
  }, [load, monthKey]);

  if (checking || !ready) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator style={{ marginTop: 48 }} color={V4DesignTokens.color.red} />
      </SafeAreaView>
    );
  }

  const filterLabel = filterTag ? legendForTag(filterTag).label : null;
  const daysLoggedCount = monthDays.filter((d) => (d.facts || []).length > 0).length;

  return (
    <SafeAreaView style={styles.root} edges={['top']} testID="calendar-screen">
      <View style={styles.header}>
        <View style={styles.modeRow} testID="calendar-mode-toggle">
          <Pressable
            onPress={() => setViewMode('list')}
            style={[styles.modeChip, viewMode === 'list' && styles.modeChipOn]}
            testID="calendar-mode-list">
            <Text style={[styles.modeText, viewMode === 'list' && styles.modeTextOn]}>List</Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('month')}
            style={[styles.modeChip, viewMode === 'month' && styles.modeChipOn]}
            testID="calendar-mode-month">
            <Text style={[styles.modeText, viewMode === 'month' && styles.modeTextOn]}>Month</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.title} testID="calendar-title">
        {viewMode === 'month' ? monthLabel(monthKey) : 'Calendar'}
      </Text>
      {viewMode === 'list' ? (
        <Text style={styles.tagline} testID="calendar-tagline">
          {CALENDAR_TAGLINE}
        </Text>
      ) : null}

      {filterTag ? (
        <View style={styles.filterRow} testID="calendar-tag-filter">
          <Text style={styles.filterText}>Showing {filterLabel} records</Text>
          <Pressable
            onPress={clearFilter}
            accessibilityRole="button"
            accessibilityLabel="Clear tag filter"
            testID="calendar-clear-tag-filter">
            <Text style={styles.filterClear}>Clear</Text>
          </Pressable>
        </View>
      ) : null}

      {viewMode === 'month' ? (
        <View style={styles.monthNav}>
          <Pressable
            onPress={() => {
              const next = shiftMonth(monthKey, -1);
              setMonthKey(next);
              if (!filterTag) void load(null, next);
            }}
            testID="calendar-prev-month">
            <Text style={styles.nav}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel} testID="calendar-month-label">
            {monthLabel(monthKey)}
          </Text>
          <Pressable
            onPress={() => {
              const next = shiftMonth(monthKey, 1);
              setMonthKey(next);
              if (!filterTag) void load(null, next);
            }}
            testID="calendar-next-month">
            <Text style={styles.nav}>›</Text>
          </Pressable>
        </View>
      ) : null}

      <FactsCalendarLegend />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void load(filterTag, monthKey)}
            tintColor={V4DesignTokens.color.red}
          />
        }>
        {loading && days.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={V4DesignTokens.color.red} />
        ) : loadFailed ? (
          <LoadFailedState
            testID="calendar-load-failed"
            title="Couldn't load your calendar"
            body="Check your connection and try again. This is not the same as having nothing saved yet."
            onRetry={() => void load(filterTag, monthKey)}
          />
        ) : isEmpty ? (
          <FactsCalendarEmpty />
        ) : viewMode === 'month' ? (
          <>
            <FactsCalendarMonth
              monthKey={monthKey}
              daysByIso={daysByIso}
              selectedIso={selectedIso}
              onSelectDay={setSelectedIso}
            />
            <Text style={styles.honesty} testID="calendar-month-honesty">
              {monthHonestyFooter(daysLoggedCount)}
            </Text>
          </>
        ) : (
          <FactsCalendarList days={listDays} onOpenDay={setSelectedIso} />
        )}
      </ScrollView>

      <Modal
        visible={Boolean(selectedIso)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedIso(null)}>
        <Pressable style={styles.modalBg} onPress={() => setSelectedIso(null)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            {selectedIso ? (
              <FactsCalendarDayDetail
                iso={selectedIso}
                day={selectedDayForDetail}
                onClose={() => setSelectedIso(null)}
              />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 22,
    color: V4DesignTokens.color.black,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  tagline: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
  },
  modeRow: { flexDirection: 'row', gap: 6 },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: V4DesignTokens.color.line,
    backgroundColor: V4DesignTokens.color.white,
  },
  modeChipOn: {
    backgroundColor: V4DesignTokens.color.black,
    borderColor: V4DesignTokens.color.black,
  },
  modeText: {
    fontFamily: V4DesignTokens.font.bodyMedium,
    fontSize: 13,
    color: V4DesignTokens.color.black,
  },
  modeTextOn: { color: V4DesignTokens.color.white },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  filterText: {
    fontSize: 13,
    color: V4DesignTokens.color.muted,
    fontFamily: V4DesignTokens.font.bodyMedium,
  },
  filterClear: {
    fontSize: 13,
    color: V4DesignTokens.color.redDeep,
    fontFamily: V4DesignTokens.font.bodyBold,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  monthLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.black,
  },
  nav: {
    fontSize: 28,
    color: V4DesignTokens.color.red,
    paddingHorizontal: 8,
  },
  content: { paddingHorizontal: 12, paddingBottom: 100 },
  honesty: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
    marginTop: 18,
    paddingHorizontal: 4,
    lineHeight: 19,
  },
  modalBg: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
