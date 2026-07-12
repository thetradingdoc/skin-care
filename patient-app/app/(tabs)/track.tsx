import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AtmActionButton } from '@/components/v3';
import { AppTokens } from '@/constants/appTokens';
import { spotHref, TRACK_CAPTURE_HREF } from '@/constants/routes';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { listSpots } from '@/lib/spot-store';
import { setPendingCaptureUri } from '@/lib/pending-capture-uri';
import { mimeTypeFromImagePickerAsset } from '@/lib/upload-uri';
import type { Spot } from '@/lib/spot-store';

export default function TrackScreen() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const [spots, setSpots] = useState<Spot[]>([]);

  const [galleryError, setGalleryError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setSpots(await listSpots());
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const openCapture = useCallback(() => {
    router.push(TRACK_CAPTURE_HREF);
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
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (picked.canceled || !picked.assets?.[0]?.uri) return;
    const asset = picked.assets[0];
    await setPendingCaptureUri(asset.uri, mimeTypeFromImagePickerAsset(asset));
    router.push(TRACK_CAPTURE_HREF);
  }, [router]);

  const openTimeline = useCallback(() => {
    if (spots[0]) {
      router.push(spotHref(spots[0].id));
    } else {
      openCapture();
    }
  }, [spots, router, openCapture]);

  if (checking || !ready) {
    return <SafeAreaView style={styles.root} />;
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Track a spot</Text>
        <Text style={styles.sub}>
          Take a photo. We&apos;ll measure and watch it with you.{'\n'}
          No forms. No medical words.
        </Text>

        <AtmActionButton
          primary
          title="Take a photo now"
          subtitle="Point at the spot, tap the button"
          icon="photo-camera"
          onPress={openCapture}
        />
        <AtmActionButton
          variant="amber"
          title="Upload from gallery"
          subtitle="Use a photo you already took"
          icon="photo-library"
          onPress={() => void uploadFromGallery()}
        />
        <AtmActionButton
          variant="blue"
          title="See my photos so far"
          subtitle="Compare how it has changed"
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
    marginBottom: 20,
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
