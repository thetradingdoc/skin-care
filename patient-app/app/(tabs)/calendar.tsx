/**
 * P7.26–30 — Calendar tab: month / list / legend / empty T2b / day detail.
 * Data: P5.10 `/api/patient/records/calendar` only.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { AppTokens } from '@/constants/appTokens';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import {
  currentMonthKey,
  monthLabel,
  shiftMonth,
  type FactsCalendarDay,
} from '@/lib/facts-calendar';
import { fetchFactsCalendar } from '@/lib/facts-calendar-api';

type Mode = 'month' | 'list';

export default function CalendarScreen() {
  const { ready, checking } = useRequirePatientSession();
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [mode, setMode] = useState<Mode>('month');
  const [days, setDays] = useState<FactsCalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchFactsCalendar({ month: monthKey });
      setDays(payload.days);
    } catch {
      setDays([]);
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const daysByIso = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const isEmpty = !loading && days.length === 0;
  const selectedDay = selectedIso ? daysByIso.get(selectedIso) || null : null;

  if (checking || !ready) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator style={{ marginTop: 48 }} color={AppTokens.color.fabBg} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']} testID="calendar-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Calendar</Text>
        <View style={styles.modeRow} testID="calendar-mode-toggle">
          <Pressable
            onPress={() => setMode('month')}
            style={[styles.modeChip, mode === 'month' && styles.modeChipOn]}
            testID="calendar-mode-month">
            <Text style={styles.modeText}>month</Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('list')}
            style={[styles.modeChip, mode === 'list' && styles.modeChipOn]}
            testID="calendar-mode-list">
            <Text style={styles.modeText}>list</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.monthNav}>
        <Pressable onPress={() => setMonthKey((m) => shiftMonth(m, -1))} testID="calendar-prev-month">
          <Text style={styles.nav}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel} testID="calendar-month-label">
          {monthLabel(monthKey)}
        </Text>
        <Pressable onPress={() => setMonthKey((m) => shiftMonth(m, 1))} testID="calendar-next-month">
          <Text style={styles.nav}>›</Text>
        </Pressable>
      </View>

      <FactsCalendarLegend />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
        {loading && days.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={AppTokens.color.fabBg} />
        ) : isEmpty ? (
          <FactsCalendarEmpty />
        ) : mode === 'month' ? (
          <FactsCalendarMonth
            monthKey={monthKey}
            daysByIso={daysByIso}
            selectedIso={selectedIso}
            onSelectDay={setSelectedIso}
          />
        ) : (
          <FactsCalendarList days={days} onOpenDay={setSelectedIso} />
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
                day={selectedDay}
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
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 22, fontWeight: '700', color: AppTokens.color.ink },
  modeRow: { flexDirection: 'row', gap: 6 },
  modeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: AppTokens.color.cream,
  },
  modeChipOn: { backgroundColor: AppTokens.color.infoBlue },
  modeText: { fontSize: 13, fontWeight: '600', color: AppTokens.color.ink },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  monthLabel: { fontSize: 16, fontWeight: '600', color: AppTokens.color.ink },
  nav: { fontSize: 28, color: AppTokens.color.fabBg, paddingHorizontal: 8 },
  content: { paddingHorizontal: 12, paddingBottom: 100 },
  modalBg: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
