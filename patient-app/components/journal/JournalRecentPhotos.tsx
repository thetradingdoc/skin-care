import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SessionImage } from '@/components/SessionImage';
import { AppFontFamilies } from '@/components/ui/AppFontsProvider';
import { AppTokens } from '@/constants/appTokens';
import { localTodayIso } from '@/lib/routine-day-mode';

type Thumb = {
  date: string;
  logged: boolean;
  thumbnail_url?: string | null;
};

type Props = {
  thumbs: Thumb[];
  onSeeAll: () => void;
  onOpenDay: (date: string) => void;
};

export function JournalRecentPhotos({ thumbs, onSeeAll, onOpenDay }: Props) {
  if (thumbs.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.label}>Recent photos</Text>
        <Pressable onPress={onSeeAll} accessibilityRole="button" accessibilityLabel="See all photos">
          <Text style={styles.link}>See all</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        {thumbs.map((t) => {
          const isToday = t.date === localTodayIso();
          return (
            <Pressable
              key={t.date}
              onPress={() => onOpenDay(t.date)}
              style={[styles.thumb, t.logged && styles.thumbLogged, isToday && styles.thumbToday]}
              accessibilityRole="button"
              accessibilityLabel={isToday ? 'Today' : t.date}>
              {t.thumbnail_url ? (
                <SessionImage uri={t.thumbnail_url} style={styles.thumbImage} contentFit="cover" />
              ) : (
                <Text style={styles.thumbEmoji}>{t.logged ? '📷' : isToday ? '📸' : '·'}</Text>
              )}
              <Text style={styles.thumbDay}>{isToday ? 'Today' : t.date.slice(8)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 4, marginBottom: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: {
    fontSize: 11,
    fontFamily: AppFontFamilies.bodySemiBold,
    color: AppTokens.color.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  link: { fontSize: 12, color: AppTokens.color.brandBlue, fontFamily: AppFontFamilies.bodySemiBold },
  row: { flexDirection: 'row', gap: 8 },
  thumb: {
    flex: 1,
    aspectRatio: 0.85,
    borderRadius: 10,
    backgroundColor: AppTokens.color.cream,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbLogged: { backgroundColor: AppTokens.color.photoBg },
  thumbToday: { borderColor: AppTokens.color.brandBlue, borderWidth: 2 },
  thumbImage: { ...StyleSheet.absoluteFillObject, borderRadius: 10 },
  thumbEmoji: { fontSize: 18 },
  thumbDay: { fontSize: 9, color: AppTokens.color.muted, marginTop: 4, position: 'absolute', bottom: 6 },
});
