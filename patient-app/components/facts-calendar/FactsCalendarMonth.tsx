import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppTokens } from '@/constants/appTokens';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { legendForTag, normalizeCalendarTag } from '@/lib/calendar-legend';
import type { FactsCalendarDay } from '@/lib/facts-calendar';
import { dayTagDots } from '@/lib/facts-calendar';

type Props = {
  monthKey: string;
  daysByIso: Map<string, FactsCalendarDay>;
  selectedIso: string | null;
  onSelectDay: (iso: string) => void;
};

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** P7.26 — Month grid; multi-type days show ALL tag dots. */
export function FactsCalendarMonth({ monthKey, daysByIso, selectedIso, onSelectDay }: Props) {
  const [y, m] = monthKey.split('-').map(Number);
  const first = new Date(y, (m || 1) - 1, 1);
  const last = new Date(y, m || 1, 0);
  const lead = first.getDay();
  const cells: React.ReactNode[] = [];

  for (let i = 0; i < lead; i += 1) {
    cells.push(<View key={`pad-${i}`} style={styles.cell} />);
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    const iso = `${monthKey}-${String(day).padStart(2, '0')}`;
    const row = daysByIso.get(iso);
    const tags = dayTagDots(row);
    const selected = selectedIso === iso;
    cells.push(
      <Pressable
        key={iso}
        style={[styles.cell, selected && styles.cellSelected]}
        onPress={() => onSelectDay(iso)}
        accessibilityRole="button"
        accessibilityLabel={
          tags.length
            ? `${iso}, ${tags.join(' and ')}${row?.multi_type ? ', multi-type day' : ''}`
            : iso
        }
        testID={`calendar-day-${iso}`}>
        <Text style={[styles.dayNum, selected && styles.dayNumSelected]}>{day}</Text>
        <View style={styles.dots} testID={row?.multi_type ? `calendar-multi-${iso}` : undefined}>
          {tags.map((tag) => {
            const leg = legendForTag(tag);
            return (
              <View
                key={`${iso}-${tag}`}
                style={styles.dotRow}
                testID={`calendar-dot-${iso}-${tag}`}>
                <AppIcon name={leg.icon as never} size={8} color={leg.color} />
                <View style={[styles.dot, { backgroundColor: leg.color }]} />
              </View>
            );
          })}
        </View>
      </Pressable>,
    );
  }

  return (
    <View testID="calendar-month">
      <View style={styles.dowRow}>
        {DOW.map((d, i) => (
          <Text key={`${d}-${i}`} style={styles.dow}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>{cells}</View>
    </View>
  );
}

export function listLabelForFact(tag: string, fact?: { id?: string }): string {
  const n = normalizeCalendarTag(tag);
  if (n === 'skin') return 'Skin';
  if (n === 'bill') return 'Bill';
  if (n === 'rx') return 'Rx';
  if (n === 'mark') return 'Mark';
  if (n === 'lab') return 'Lab';
  return 'Other';
}

const styles = StyleSheet.create({
  dowRow: { flexDirection: 'row', marginBottom: 4 },
  dow: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: AppTokens.color.hint,
    fontWeight: '600',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.28%',
    minHeight: 52,
    paddingVertical: 4,
    alignItems: 'center',
  },
  cellSelected: {
    backgroundColor: V4DesignTokens.color.black,
    borderRadius: 50,
  },
  dayNum: { fontSize: 14, color: AppTokens.color.ink, fontWeight: '500' },
  dayNumSelected: { color: V4DesignTokens.color.white, fontWeight: '800' },
  dots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 2,
    marginTop: 2,
    minHeight: 12,
  },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
});
