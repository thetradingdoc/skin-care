import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppTokens } from '@/constants/appTokens';
import { TRACK_CAPTURE_HREF } from '@/constants/routes';
import { legendForTag, normalizeCalendarTag } from '@/lib/calendar-legend';
import type { FactsCalendarDay } from '@/lib/facts-calendar';
import { useRouter } from 'expo-router';

type Props = {
  day: FactsCalendarDay | null;
  iso: string;
  onClose: () => void;
};

/** P7.30 — Day detail with mixed record types (all tags listed). */
export function FactsCalendarDayDetail({ day, iso, onClose }: Props) {
  const router = useRouter();
  const facts = day?.facts || [];

  return (
    <View style={styles.sheet} testID="calendar-day-detail">
      <Text style={styles.title} testID="calendar-day-detail-date">
        {iso}
      </Text>
      {facts.length === 0 ? (
        <Text style={styles.empty}>Nothing on this day yet.</Text>
      ) : (
        facts.map((f) => {
          const tag = normalizeCalendarTag(f.tag);
          const leg = legendForTag(tag);
          return (
            <View key={f.id} style={styles.row} testID={`calendar-day-fact-${f.id}`}>
              <AppIcon name={leg.icon as never} size={18} color={leg.color} />
              <View style={[styles.swatch, { backgroundColor: leg.color }]} />
              <Text style={styles.factLabel}>
                {tag === 'skin'
                  ? 'Skin'
                  : tag === 'bill'
                    ? 'Bill'
                    : tag === 'rx'
                      ? 'Rx'
                      : tag === 'mark'
                        ? 'Mark'
                        : tag === 'lab'
                          ? 'Lab'
                          : 'Other'}
              </Text>
            </View>
          );
        })
      )}
      <Pressable
        style={styles.add}
        testID="calendar-day-add"
        onPress={() => {
          onClose();
          router.push(TRACK_CAPTURE_HREF);
        }}>
        <Text style={styles.addLabel}>+ add to this day</Text>
      </Pressable>
      <Pressable onPress={onClose} testID="calendar-day-close">
        <Text style={styles.close}>Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    padding: 20,
    backgroundColor: AppTokens.color.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 10,
  },
  title: { fontSize: 18, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 8 },
  empty: { color: AppTokens.color.muted, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  factLabel: { fontSize: 15, fontWeight: '500', color: AppTokens.color.ink },
  add: { marginTop: 8, paddingVertical: 12 },
  addLabel: { color: AppTokens.color.fabBg, fontWeight: '600', fontSize: 15 },
  close: { color: AppTokens.color.muted, fontSize: 15, textAlign: 'center', paddingVertical: 8 },
});
