import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';

import type { CalendarDay } from '@/components/journal/journalTypes';
import { styles } from '@/components/journal/journalStyles';

type Props = {
  photoDays: CalendarDay[];
  onOpenRoutineSheet: (iso: string) => void;
};

export function JournalPhotosTab({ photoDays, onOpenRoutineSheet }: Props) {
  const router = useRouter();

  const openCompareLatest = useCallback(() => {
    if (photoDays.length < 2) return;
    router.push({
      pathname: '/compare',
      params: { dateA: photoDays[0].date, dateB: photoDays[1].date },
    });
  }, [photoDays, router]);

  if (!photoDays.length) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your progress story starts here</Text>
        <Text style={styles.cardBody}>
          Log a front-facing photo from Today. Each check-in builds a filmstrip you can compare over time.
        </Text>
        <Pressable
          style={styles.inlineBtnPrimary}
          onPress={() => router.push('/routine/capture')}
          accessibilityRole="button">
          <Text style={styles.inlineBtnPrimaryText}>Log progress photo</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.photosPanel}>
      {photoDays.length >= 2 ? (
        <Pressable
          style={styles.compareLatestBtn}
          onPress={openCompareLatest}
          accessibilityRole="button"
          accessibilityLabel="Compare your two most recent progress photos">
          <Text style={styles.compareLatestText}>Compare latest</Text>
        </Pressable>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filmstrip}>
        {photoDays.map((row) => (
          <Pressable
            key={`film-${row.date}`}
            style={styles.filmFrame}
            onPress={() => onOpenRoutineSheet(row.date)}
            accessibilityRole="button"
            accessibilityLabel={`Progress photo ${row.date}`}>
            <Image source={{ uri: row.thumbnail_url || '' }} style={styles.filmImage} />
            <Text style={styles.filmLabel}>
              {new Date(`${row.date}T12:00:00`).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
              {row.program_week ? ` · W${row.program_week}` : ''}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable
        style={styles.logPhotoBtn}
        onPress={() => router.push('/routine/capture')}
        accessibilityRole="button">
        <Text style={styles.logPhotoBtnText}>Log today&apos;s photo</Text>
      </Pressable>
    </View>
  );
}
