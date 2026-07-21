import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TrackAiReadsChip } from '@/components/track/TrackAiReadsChip';
import {
  CAPTURE_2A_HREF,
  CAPTURE_GUIDANCE_HREF,
  DAILY_AI_SUGGESTS_HREF,
  MARK_COMPARE_HREF,
  TRACK_CHECKIN_HREF,
} from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { fetchMarksList, type MarkListItem } from '@/lib/marks-api';
import { setPendingCaptureUri } from '@/lib/pending-capture-uri';
import { mimeTypeFromImagePickerAsset } from '@/lib/upload-uri';

/**
 * Step 12 — Track hub (v4.1 frame 12).
 * White background; red reserved for the tab FAB only — no amber/blue accent cards.
 */
export default function TrackScreen() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const [marks, setMarks] = useState<MarkListItem[]>([]);
  const [galleryError, setGalleryError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const payload = await fetchMarksList();
      setMarks(payload.marks);
    } catch {
      setMarks([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      void load();
    }, [ready, load]),
  );

  const openCapture = useCallback(() => {
    router.push(CAPTURE_GUIDANCE_HREF);
  }, [router]);

  const openDailyCheckIn = useCallback(() => {
    router.push(TRACK_CHECKIN_HREF);
  }, [router]);

  const openDailyAiSuggests = useCallback(() => {
    router.push(DAILY_AI_SUGGESTS_HREF);
  }, [router]);

  const uploadFromGallery = useCallback(async () => {
    setGalleryError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setGalleryError(
        perm.canAskAgain === false
          ? 'Photo library access is off. Open Settings to choose a photo.'
          : 'Photo library access is required to upload a spot photo.',
      );
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (picked.canceled || !picked.assets?.[0]?.uri) return;
    const asset = picked.assets[0];
    await setPendingCaptureUri(asset.uri, mimeTypeFromImagePickerAsset(asset));
    router.push({ pathname: CAPTURE_2A_HREF, params: { entry: 'track' } } as never);
  }, [router]);

  const openTimeline = useCallback(() => {
    const first = marks[0];
    if (first) {
      const cg = first.compare_group_id || first.id;
      router.push({
        pathname: MARK_COMPARE_HREF,
        params: { compareGroupId: cg },
      } as never);
      return;
    }
    openCapture();
  }, [marks, router, openCapture]);

  if (checking || !ready) {
    return <SafeAreaView style={styles.root} />;
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']} testID="track-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} testID="track-hub-title">
          Ready when you are
        </Text>
        <Text style={styles.sub} testID="track-hub-tagline">
          Choose how you want to log something.
        </Text>
        <TrackAiReadsChip />

        <HubRow
          testID="track-log-something"
          title="Log something"
          subtitle="Take a photo — skin, Rx, bill, anything"
          onPress={openCapture}
        />
        <HubRow
          testID="track-daily-checkin"
          title="Daily check-in"
          subtitle="No photo needed — how it looks today"
          onPress={openDailyCheckIn}
        />
        <HubRow
          testID="track-daily-ai-suggests"
          title="AI SUGGESTS check-in"
          subtitle="Confirm or correct from your records"
          onPress={openDailyAiSuggests}
        />
        <HubRow
          testID="track-upload-gallery"
          title="Upload from gallery"
          subtitle="Use a photo you already took"
          onPress={() => void uploadFromGallery()}
        />
        <HubRow
          testID="track-see-photos"
          title="See my photos so far"
          subtitle={
            marks.length
              ? `Compare ${marks.length} mark${marks.length === 1 ? '' : 's'} over time`
              : 'Compare how it has changed'
          }
          onPress={openTimeline}
        />

        {galleryError ? <Text style={styles.galleryError}>{galleryError}</Text> : null}

        <Text style={styles.disclaimer}>
          Not a diagnosis. If you&apos;re worried, see a doctor.{'\n'}
          We&apos;re just helping you track changes over time.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function HubRow({
  title,
  subtitle,
  onPress,
  testID,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.row}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white },
  content: {
    padding: 20,
    paddingBottom: 100,
    alignItems: 'center',
  },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 19,
    color: V4DesignTokens.color.black,
    textAlign: 'center',
    marginTop: 48,
    marginBottom: 8,
  },
  sub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
    marginBottom: 24,
  },
  row: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: V4DesignTokens.color.line,
    borderRadius: 14,
    marginBottom: 10,
    backgroundColor: V4DesignTokens.color.white,
    minHeight: 48,
  },
  rowBody: { flex: 1 },
  rowTitle: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 15,
    color: V4DesignTokens.color.black,
  },
  rowSub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    color: V4DesignTokens.color.muted,
    marginTop: 2,
    lineHeight: 17,
  },
  chevron: {
    fontSize: 22,
    color: V4DesignTokens.color.muted,
    marginRight: 2,
  },
  disclaimer: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 11,
    color: V4DesignTokens.color.muted,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 12,
    paddingHorizontal: 8,
  },
  galleryError: {
    color: V4DesignTokens.color.redDeep,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    fontFamily: V4DesignTokens.font.body,
  },
});
