import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SessionImage } from '@/components/SessionImage';
import { AppIcon } from '@/components/ui/AppIcon';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { TRACK_CAPTURE_HREF } from '@/constants/routes';
import { legendForTag, normalizeCalendarTag } from '@/lib/calendar-legend';
import type { FactsCalendarDay } from '@/lib/facts-calendar';
import { useRouter } from 'expo-router';

type Props = {
  day: FactsCalendarDay | null;
  iso: string;
  onClose: () => void;
};

function labelForTag(tag: ReturnType<typeof normalizeCalendarTag>): string {
  if (tag === 'skin') return 'Skin';
  if (tag === 'bill') return 'Bill';
  if (tag === 'rx') return 'Rx';
  if (tag === 'mark') return 'Mark';
  if (tag === 'lab') return 'Lab';
  return 'Other';
}

/** P7.30 — Day detail with mixed record types + media when present. */
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
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {facts.map((f) => {
            const tag = normalizeCalendarTag(f.tag);
            const leg = legendForTag(tag);
            const mediaUrl = f.media_url != null ? String(f.media_url).trim() : '';
            return (
              <View key={f.id} style={styles.row} testID={`calendar-day-fact-${f.id}`}>
                {mediaUrl ? (
                  <SessionImage
                    uri={mediaUrl}
                    style={styles.thumb}
                    contentFit="cover"
                    fallback={
                      <View style={[styles.thumb, styles.thumbFallback]}>
                        <AppIcon name={leg.icon as never} size={18} color={leg.color} />
                      </View>
                    }
                  />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]}>
                    <AppIcon name={leg.icon as never} size={18} color={leg.color} />
                  </View>
                )}
                <View style={[styles.swatch, { backgroundColor: leg.color }]} />
                <Text style={styles.factLabel}>{labelForTag(tag)}</Text>
              </View>
            );
          })}
        </ScrollView>
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
    backgroundColor: V4DesignTokens.color.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 10,
    maxHeight: '70%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: V4DesignTokens.color.line,
  },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 18,
    color: V4DesignTokens.color.black,
    marginBottom: 8,
  },
  empty: {
    fontFamily: V4DesignTokens.font.body,
    color: V4DesignTokens.color.muted,
    fontSize: 15,
  },
  list: { maxHeight: 360 },
  listContent: { gap: 8, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F6F6F6',
  },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  factLabel: {
    flex: 1,
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 15,
    color: V4DesignTokens.color.black,
  },
  add: { marginTop: 8, paddingVertical: 12 },
  addLabel: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    color: V4DesignTokens.color.red,
    fontSize: 15,
  },
  close: {
    fontFamily: V4DesignTokens.font.body,
    color: V4DesignTokens.color.muted,
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
