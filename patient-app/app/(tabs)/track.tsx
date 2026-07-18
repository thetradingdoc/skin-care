import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AtmActionButton } from '@/components/v3';
import { TrackAiReadsChip } from '@/components/track/TrackAiReadsChip';
import { AppTokens } from '@/constants/appTokens';
import {
  CAPTURE_2A_HREF,
  DAILY_AI_SUGGESTS_HREF,
  MARK_COMPARE_HREF,
} from '@/constants/routes';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { fetchMarksList, type MarkListItem } from '@/lib/marks-api';
import { setPendingCaptureUri } from '@/lib/pending-capture-uri';
import { mimeTypeFromImagePickerAsset } from '@/lib/upload-uri';

/**
 * Track tab — mark list from GET /api/patient/marks (facts), not the legacy spots list API.
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
    router.push({ pathname: CAPTURE_2A_HREF, params: { entry: 'track' } } as never);
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
        <Text style={styles.title}>Track</Text>
        <TrackAiReadsChip />
        <Text style={styles.sub}>
          Log skin, bills, prescriptions, marks — and compare over time.
        </Text>

        <AtmActionButton
          primary
          title="Log something"
          subtitle="Take a photo — skin, Rx, bill, anything"
          icon="photo-camera"
          onPress={openCapture}
        />
        <AtmActionButton
          variant="amber"
          title="Daily check-in"
          subtitle="AI SUGGESTS — confirm or correct"
          icon="lightbulb"
          onPress={openDailyAiSuggests}
        />
        <AtmActionButton
          variant="blue"
          title="Upload from gallery"
          subtitle="Use a photo you already took"
          icon="photo-library"
          onPress={() => void uploadFromGallery()}
        />
        <AtmActionButton
          variant="blue"
          title="See my photos so far"
          subtitle={
            marks.length
              ? `Compare ${marks.length} mark${marks.length === 1 ? '' : 's'} over time`
              : 'Compare how it has changed'
          }
          icon="schedule"
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  content: { padding: AppTokens.spacing.lg, paddingBottom: 100 },
  title: {
    fontFamily: AppTokens.font.display,
    fontSize: 24,
    color: AppTokens.color.ink,
    textAlign: 'center',
    marginBottom: 6,
  },
  sub: {
    fontSize: 13,
    color: AppTokens.color.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  disclaimer: {
    fontSize: 11,
    color: AppTokens.color.muted,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  galleryError: {
    color: '#b91c1c',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
  },
});
