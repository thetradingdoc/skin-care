import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/billing-feedback';
import { BodyMapPicker, SpotCaptureFrame } from '@/components/v3';
import { AppTokens } from '@/constants/appTokens';
import { spotHref } from '@/constants/routes';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { addSpotPhoto, createSpot, type BodyRegion } from '@/lib/spot-store';
import { consumePendingCaptureUri } from '@/lib/pending-capture-uri';
import { localTodayIso } from '@/lib/routine-day-mode';

export default function TrackCaptureScreen() {
  const { ready, checking } = useRequirePatientSession();
  const { showToast } = useToast();
  const router = useRouter();
  const params = useLocalSearchParams<{ libraryUri?: string; spotId?: string }>();
  const pendingLibrary = consumePendingCaptureUri();
  const [region, setRegion] = useState<BodyRegion>('neck');
  const [uri, setUri] = useState<string | null>(
    pendingLibrary?.uri ||
      (typeof params.libraryUri === 'string' ? params.libraryUri : null),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraDenied, setCameraDenied] = useState(false);

  const capturePhoto = useCallback(async () => {
    setError(null);
    setCameraDenied(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setCameraDenied(true);
      setError(
        perm.canAskAgain === false
          ? 'Camera access is off. Open Settings to allow photos for spot tracking.'
          : 'Camera access is required to photograph a spot.',
      );
      return;
    }
    const picked = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!picked.canceled && picked.assets?.[0]?.uri) {
      setUri(picked.assets[0].uri);
    }
  }, []);

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  const save = useCallback(async () => {
    if (!uri) {
      setError('Take or choose a photo before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const today = localTodayIso();
      let spotId = typeof params.spotId === 'string' ? params.spotId : null;
      if (!spotId) {
        const spot = await createSpot(region);
        spotId = spot.id;
      }
      await addSpotPhoto(spotId, { date: today, uri });
      router.replace(spotHref(spotId));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not save your photo. Try again.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }, [params.spotId, region, uri, router, showToast]);

  if (checking || !ready) {
    return <SafeAreaView style={styles.root} />;
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <Text style={styles.title}>Position your skin in the circle</Text>
        <Text style={styles.sub}>Get as close as you can</Text>

        {uri ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri }} style={styles.preview} accessibilityLabel="Selected spot photo" />
            <Pressable style={styles.retake} onPress={() => void capturePhoto()} accessibilityRole="button">
              <Text style={styles.retakeText}>Retake</Text>
            </Pressable>
          </View>
        ) : (
          <SpotCaptureFrame onPress={() => void capturePhoto()} />
        )}

        {cameraDenied ? (
          <Pressable style={styles.settingsBtn} onPress={openSettings} accessibilityRole="button">
            <Text style={styles.settingsBtnText}>Open Settings</Text>
          </Pressable>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <BodyMapPicker selected={region} onSelect={setRegion} />

        <View style={styles.actions}>
          <Pressable style={styles.cancel} onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.save, (!uri || saving) && styles.saveDisabled]}
            onPress={() => void save()}
            disabled={!uri || saving}
            accessibilityRole="button">
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save photo'}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  content: { padding: AppTokens.spacing.lg, flex: 1 },
  title: { fontSize: 15, fontWeight: '600', textAlign: 'center', color: AppTokens.color.ink },
  sub: { fontSize: 12, color: AppTokens.color.muted, textAlign: 'center', marginBottom: 10 },
  previewWrap: { marginBottom: 14, position: 'relative' },
  preview: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    backgroundColor: AppTokens.color.photoBg,
  },
  retake: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retakeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  settingsBtn: {
    alignSelf: 'center',
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  settingsBtnText: { color: AppTokens.color.brandAccent, fontSize: 13, fontWeight: '600' },
  error: { color: '#b91c1c', fontSize: 12, textAlign: 'center', marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  cancel: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: AppTokens.minTap,
    justifyContent: 'center',
  },
  cancelText: { fontSize: 13, color: AppTokens.color.muted },
  save: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: AppTokens.color.fabBg,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: AppTokens.minTap,
    justifyContent: 'center',
  },
  saveDisabled: { opacity: 0.45 },
  saveText: { fontSize: 13, fontWeight: '600', color: '#fff' },
});
