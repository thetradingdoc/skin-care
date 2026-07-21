import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SessionImage } from '@/components/SessionImage';
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
        (day.facts || []).map((fact) => {
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
          const mediaUrl = fact.media_url != null ? String(fact.media_url).trim() : '';
          return (
            <Pressable
              key={fact.id}
              style={styles.row}
              onPress={() => onOpenDay(day.date)}
              testID={`calendar-list-row-${fact.id}`}>
              {mediaUrl ? (
                <SessionImage
                  uri={mediaUrl}
                  style={styles.thumb}
                  contentFit="cover"
                  fallback={
                    <View style={[styles.thumb, styles.thumbFallback]}>
                      <AppIcon name={leg.icon as never} size={16} color={leg.color} />
                    </View>
                  }
                />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <AppIcon name={leg.icon as never} size={16} color={leg.color} />
                </View>
              )}
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
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppTokens.color.line,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: AppTokens.color.photoBg,
  },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  copy: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: AppTokens.color.ink },
  date: { fontSize: 13, color: AppTokens.color.muted, marginTop: 2 },
});
