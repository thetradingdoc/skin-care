import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { BillingBadge } from '@/components/billing-ui';
import type { BillingEvent, CalendarDay, PhaseChip, Subview } from '@/components/journal/journalTypes';
import {
  amountColorForStatus,
  billingMarkerGlyph,
  billingStatusA11y,
  billingVisualForCell,
  dotColorForDay,
  formatUsd,
  isoAddDays,
  programWeekDayLabel,
  todayIsoLocal,
} from '@/components/journal/journalTypes';
import { styles } from '@/components/journal/journalStyles';
import { TimelineTokens } from '@/constants/timelineTokens';
import { findPriorMediaDate } from '@/lib/routine-compare';

type Props = {
  rows: CalendarDay[];
  monthGroups: Map<string, CalendarDay[]>;
  billingByDay: Map<string, BillingEvent[]>;
  filteredEvents: BillingEvent[];
  phaseChips: PhaseChip[];
  templateStartDate: string | null;
  showCalendarBills: boolean;
  scrollToIso: string | null;
  onToggleCalendarBills: () => void;
  onScrollToIso: (iso: string) => void;
  onOpenDaySheet: (iso: string) => void;
  onOpenRoutineSheet: (iso: string) => void;
  onActiveViewChange: (view: Subview) => void;
  onSelectEvent: (id: string) => void;
};

function classifyRoutine(d?: CalendarDay) {
  if (!d) return 'off';
  if (d.has_media) return 'media';
  if (d.has_entry) return 'logged';
  if (d.is_routine_day) return 'due';
  return 'off';
}

export function JournalCalendarTab({
  rows,
  monthGroups,
  billingByDay,
  filteredEvents,
  phaseChips,
  templateStartDate,
  showCalendarBills,
  scrollToIso,
  onToggleCalendarBills,
  onScrollToIso,
  onOpenDaySheet,
  onOpenRoutineSheet,
  onActiveViewChange,
  onSelectEvent,
}: Props) {
  const router = useRouter();
  const months = Array.from(monthGroups.keys()).sort();
  const today = todayIsoLocal();
  const inlinePreview = filteredEvents.slice(0, 4);
  const routineInlinePreview =
    inlinePreview.length > 0
      ? []
      : rows
          .filter(
            (r) =>
              r.is_routine_day &&
              (r.has_media || r.photo_prompt || r.milestone_label || r.phase_expect_snippet),
          )
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 4);

  return (
    <View style={styles.calPanel}>
      <Pressable
        style={styles.billsToggle}
        onPress={onToggleCalendarBills}
        accessibilityRole="switch"
        accessibilityState={{ checked: showCalendarBills }}>
        <Text style={styles.billsToggleText}>
          {showCalendarBills ? 'Hide bills on calendar' : 'Show bills on calendar'}
        </Text>
      </Pressable>
      <View style={styles.roadmapLegend} accessibilityLabel="Timeline phase legend">
        <Text style={styles.roadmapLegendText}>Intro</Text>
        <View style={[styles.roadmapSwatch, { backgroundColor: TimelineTokens.horizonBg }]} />
        <Text style={styles.roadmapLegendText}>Purge window</Text>
        <View style={[styles.roadmapSwatch, { backgroundColor: TimelineTokens.purgeBg }]} />
      </View>
      {phaseChips.length > 0 && templateStartDate ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.phaseJumpBar}>
          {phaseChips.map((chip) => (
            <Pressable
              key={chip.key}
              style={styles.phaseChip}
              accessibilityRole="button"
              accessibilityLabel={`Jump to ${chip.label}`}
              onPress={() => {
                const target = isoAddDays(templateStartDate, (chip.week_start - 1) * 7);
                onScrollToIso(target);
                router.push({ pathname: '/(tabs)/today', params: { date: target } });
              }}>
              <Text style={styles.phaseChipText} numberOfLines={1}>
                {chip.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {months.map((monthKey) => {
        const [y, m] = monthKey.split('-').map(Number);
        const first = new Date(y, (m || 1) - 1, 1);
        const last = new Date(y, (m || 1), 0);
        const lead = first.getDay();
        const cells: React.ReactNode[] = [];
        const byIso = new Map((monthGroups.get(monthKey) || []).map((d) => [d.date, d]));
        for (let i = 0; i < lead; i += 1) {
          cells.push(<View key={`e-${monthKey}-${i}`} style={[styles.day, styles.dayEmpty]} />);
        }
        for (let day = 1; day <= last.getDate(); day += 1) {
          const iso = `${monthKey}-${String(day).padStart(2, '0')}`;
          const row = byIso.get(iso);
          const routineCls = classifyRoutine(row);
          const dayEv = billingByDay.get(iso) || [];
          const billVis = showCalendarBills ? billingVisualForCell(row, dayEv) : null;
          const isToday = iso === today;
          const dotColor = showCalendarBills ? dotColorForDay(isToday, billVis) : null;
          const billingCount = row?.billing_event_count ?? dayEv.length;
          const hasBilling = showCalendarBills && billingCount > 0;
          const a11yBill = billingStatusA11y(billVis);
          const billGlyph = billingMarkerGlyph(billVis);

          cells.push(
            <Pressable
              key={iso}
              style={[
                styles.day,
                billVis === 'due' && {
                  backgroundColor: TimelineTokens.billDueBg,
                  borderColor: TimelineTokens.billDueBorder,
                },
                billVis === 'paid' && {
                  backgroundColor: TimelineTokens.billPaidBg,
                  borderColor: TimelineTokens.billPaidBorder,
                },
                billVis === 'review' && {
                  backgroundColor: TimelineTokens.badgeAmberBg,
                  borderColor: '#EF9F27',
                },
                !billVis && routineCls === 'due' && styles.dayDue,
                !billVis && routineCls === 'logged' && styles.dayLogged,
                !billVis &&
                  routineCls === 'due' &&
                  row?.is_routine_day &&
                  !row?.has_media &&
                  styles.dayHorizon,
                !billVis && row?.phase_band === 'purge' && row?.is_routine_day && !row?.has_media && styles.dayPurge,
                !billVis && row?.phase_band === 'intro' && row?.is_routine_day && !row?.has_media && styles.dayHorizon,
                scrollToIso === iso && { borderWidth: 2, borderColor: TimelineTokens.captureCtaFg },
                isToday && { borderWidth: 1.5, borderColor: TimelineTokens.todayRing },
              ]}
              accessibilityRole="button"
              accessibilityHint={hasBilling && a11yBill ? `${a11yBill}. Opens day details.` : undefined}
              accessibilityLabel={`Day ${iso}${isToday ? ', today' : ''}${hasBilling ? `, ${billingCount} billing ${billingCount === 1 ? 'event' : 'events'}` : ''}${a11yBill ? `, ${a11yBill}` : ''}`}
              onLongPress={() => {
                if (!row?.has_media || billVis) return;
                const prior = findPriorMediaDate(rows, iso);
                if (prior) {
                  router.push({
                    pathname: '/compare',
                    params: { dateA: iso, dateB: prior },
                  });
                }
              }}
              onPress={() => {
                if (hasBilling) onOpenDaySheet(iso);
                else if (row?.has_media || row?.has_entry) onOpenRoutineSheet(iso);
                else if (row?.is_routine_day) onOpenRoutineSheet(iso);
                else onOpenDaySheet(iso);
              }}>
              {billGlyph ? (
                <Text
                  style={[
                    styles.billMarker,
                    billVis === 'due' && { color: TimelineTokens.billDueFg },
                    billVis === 'paid' && { color: TimelineTokens.billPaidFg },
                    billVis === 'review' && { color: '#854F0B' },
                  ]}
                  importantForAccessibility="no"
                  accessibilityElementsHidden>
                  {billGlyph}
                </Text>
              ) : null}
              {routineCls === 'media' && !!row?.thumbnail_url && billVis == null ? (
                <>
                  <Image source={{ uri: row.thumbnail_url }} style={styles.dayImage} />
                  <View style={styles.dayOverlay} />
                  {row?.program_week ? (
                    <View style={styles.weekBadge} accessibilityLabel={`Week ${row.program_week}`}>
                      <Text style={styles.weekBadgeText}>W{row.program_week}</Text>
                    </View>
                  ) : null}
                  {row?.milestone_label ? (
                    <View style={styles.milestoneBadge}>
                      <Text style={styles.milestoneText} numberOfLines={1}>
                        {row.milestone_label}
                      </Text>
                    </View>
                  ) : null}
                  {row?.top_symptom ? (
                    <View style={styles.symptomDot}>
                      <Text style={styles.symptomDotText}>!</Text>
                    </View>
                  ) : null}
                </>
              ) : null}
              {routineCls === 'due' && row?.is_routine_day && !row?.has_media && billVis == null ? (
                <>
                  {programWeekDayLabel(templateStartDate, iso, row?.program_week) ? (
                    <View style={styles.weekDayBadge}>
                      <Text style={styles.weekDayBadgeText}>
                        {programWeekDayLabel(templateStartDate, iso, row?.program_week)}
                      </Text>
                    </View>
                  ) : null}
                  {row?.phase_label ? (
                    <Text style={styles.horizonHint} numberOfLines={2}>
                      {row.phase_expect_snippet || row.phase_label}
                    </Text>
                  ) : null}
                </>
              ) : null}
              <Text
                style={[
                  styles.dayNum,
                  routineCls === 'media' && billVis == null && styles.dayNumMedia,
                  billVis === 'due' && { color: TimelineTokens.billDueFg },
                  billVis === 'paid' && { color: TimelineTokens.billPaidFg },
                ]}>
                {day}
              </Text>
              {row?.photo_prompt && row?.is_routine_day && billVis == null ? (
                <Text style={styles.photoMarker} accessibilityLabel="Progress photo suggested">
                  📷
                </Text>
              ) : null}
              {dotColor ? (
                <View
                  style={[styles.dot, { backgroundColor: dotColor }]}
                  importantForAccessibility="no"
                  accessibilityElementsHidden
                />
              ) : null}
            </Pressable>,
          );
        }
        return (
          <View key={monthKey} style={styles.monthCard}>
            <Text style={styles.monthTitle}>
              {first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </Text>
            <View style={styles.weekRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, idx) => (
                <Text key={`${monthKey}-${w}-${idx}`} style={styles.weekCell}>
                  {w}
                </Text>
              ))}
            </View>
            <View style={styles.grid}>{cells}</View>
            {showCalendarBills ? (
              <View style={styles.legendRow} accessibilityLabel="Calendar legend: bill due and paid day colors">
                <View
                  style={styles.legendItem}
                  accessible
                  accessibilityLabel="Bill due: light blue cell, dot may appear">
                  <View
                    style={[
                      styles.legendSwatch,
                      { backgroundColor: TimelineTokens.billDueBg, borderColor: TimelineTokens.billDueBorder },
                    ]}
                    importantForAccessibility="no"
                  />
                  <Text style={styles.legendText}>Bill due</Text>
                </View>
                <View
                  style={styles.legendItem}
                  accessible
                  accessibilityLabel="Paid: light green cell, dot may appear">
                  <View
                    style={[
                      styles.legendSwatch,
                      { backgroundColor: TimelineTokens.billPaidBg, borderColor: TimelineTokens.billPaidBorder },
                    ]}
                    importantForAccessibility="no"
                  />
                  <Text style={styles.legendText}>Paid</Text>
                </View>
              </View>
            ) : null}
          </View>
        );
      })}

      {routineInlinePreview.length > 0 ? (
        <View style={styles.inlineListWrap}>
          {routineInlinePreview.map((row) => (
            <Pressable
              key={`ril-${row.date}`}
              style={styles.inlineListRow}
              onPress={() => {
                if (row.has_media) {
                  onOpenRoutineSheet(row.date);
                } else {
                  router.push({ pathname: '/(tabs)/today', params: { date: row.date } });
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={`Routine day ${row.date}`}>
              <View style={styles.inlineListLeft}>
                <Text style={styles.inlineListTitle} numberOfLines={2}>
                  {row.milestone_label || row.phase_label || 'Routine day'}
                </Text>
                <Text style={styles.inlineListMeta} numberOfLines={2}>
                  {new Date(`${row.date}T12:00:00`).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                  {row.phase_expect_snippet ? ` · ${row.phase_expect_snippet}` : ''}
                </Text>
              </View>
              <View style={styles.inlineListRight}>
                {row.program_week ? <Text style={styles.inlineRoutineWeek}>W{row.program_week}</Text> : null}
                {row.has_media ? <Text style={styles.inlineRoutinePhoto}>Photo</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {inlinePreview.length > 0 ? (
        <View style={styles.inlineListWrap}>
          {inlinePreview.map((event) => (
            <Pressable
              key={`il-${event.id}`}
              style={styles.inlineListRow}
              onPress={() => {
                onActiveViewChange('List');
                onSelectEvent(event.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${event.title}, status ${event.status}, amount ${formatUsd(Number(event.amount_cents || 0))}`}>
              <View style={styles.inlineListLeft}>
                <Text style={styles.inlineListTitle} numberOfLines={2}>
                  {event.title}
                </Text>
                <Text style={styles.inlineListMeta} numberOfLines={1}>
                  {event.service_date
                    ? new Date(`${event.service_date}T12:00:00`).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'}{' '}
                  · {event.provider_name || '—'}
                </Text>
              </View>
              <View style={styles.inlineListRight}>
                <Text style={[styles.inlineListAmt, amountColorForStatus(event.status)]}>
                  {formatUsd(Number(event.amount_cents || 0))}
                </Text>
                <View style={{ marginTop: 4 }}>
                  <BillingBadge
                    tone={
                      event.status === 'paid'
                        ? 'success'
                        : event.status === 'due'
                          ? 'warning'
                          : event.status === 'disputed'
                            ? 'error'
                            : 'info'
                    }
                    label={String(event.status)}
                  />
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Pressable
        style={styles.captureCta}
        onPress={() => router.push('/scan-entry')}
        accessibilityRole="button"
        accessibilityLabel="Capture a bill or receipt">
        <Ionicons name="camera-outline" size={18} color={TimelineTokens.captureCtaFg} />
        <Text style={styles.captureCtaText}>Capture a bill or receipt</Text>
      </Pressable>
    </View>
  );
}
