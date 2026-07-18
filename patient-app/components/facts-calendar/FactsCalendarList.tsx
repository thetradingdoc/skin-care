import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppTokens } from '@/constants/appTokens';
import { legendForTag, normalizeCalendarTag } from '@/lib/calendar-legend';
import type { FactsCalendarDay } from '@/lib/facts-calendar';

type Props = {
  days: FactsCalendarDay[];
  onOpenDay: (iso: string) => void;
};

/** P7.27 — Calendar list view (all tags on multi-type days appear as separate rows). */
export function FactsCalendarList({ days, onOpenDay }: Props) {
  const rows = [...days].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <View testID="calendar-list">
      {rows.map((day) =>
        day.facts.map((fact) => {
          const tag = normalizeCalendarTag(fact.tag);
          const leg = legendForTag(tag);
          const title =
            tag === 'skin'
              ? 'Skin'
              : tag === 'bill'
                ? 'Bill'
                : tag === 'rx'
                  ? 'Rx'
                  : tag === 'mark'
                    ? 'Mark'
                    : tag === 'lab'
                      ? 'Lab'
                      : 'Other';
          return (
            <Pressable
              key={fact.id}
              style={styles.row}
              onPress={() => onOpenDay(day.date)}
              testID={`calendar-list-row-${fact.id}`}>
              <AppIcon name={leg.icon as never} size={18} color={leg.color} />
              <View style={[styles.swatch, { backgroundColor: leg.color }]} />
              <View style={styles.copy}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.date}>{day.date}</Text>
              </View>
            </Pressable>
          );
        }),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppTokens.color.line,
  },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  copy: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: AppTokens.color.ink },
  date: { fontSize: 13, color: AppTokens.color.muted, marginTop: 2 },
});
