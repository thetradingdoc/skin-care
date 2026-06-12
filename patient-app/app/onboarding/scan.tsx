import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConsumerPrimaryButton } from '@/components/billing-ui';
import { AppTokens } from '@/constants/appTokens';
import { JournalTokens } from '@/constants/journalTokens';
import { postFaceRead } from '@/lib/face-read-api';
import { setFacePhotoUri, setFaceRead } from '@/lib/onboarding-storage';
import {
  ONBOARDING_CONCERNS_HREF,
  ONBOARDING_REVEAL_HREF,
} from '@/constants/routes';

export default function OnboardingScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(async () => {
    if (!camRef.current || busy) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await camRef.current.takePictureAsync({ quality: 0.85, skipProcessing: false });
      if (!photo?.uri) throw new Error('Could not capture photo.');
      const result = await postFaceRead(photo.uri);
      await setFacePhotoUri(photo.uri);
      await setFaceRead(result);
      router.push(ONBOARDING_REVEAL_HREF);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Scan failed. Try again.');
    } finally {
      setBusy(false);
    }
  }, [busy, router]);

  const skip = useCallback(() => {
    router.push(ONBOARDING_CONCERNS_HREF);
  }, [router]);

  if (!permission) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={JournalTokens.color.accent} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <Text style={styles.title}>Camera access</Text>
          <Text style={styles.subtitle}>
            We need your front camera for a wellness skin-age estimate. Your photo is analyzed securely and
            stays on this device until you create an account.
          </Text>
          <ConsumerPrimaryButton label="Allow camera" onPress={() => void requestPermission()} />
          <Pressable
            onPress={skip}
            style={styles.skipBtn}
            accessibilityRole="button"
            accessibilityLabel="Skip for now">
            <Text style={styles.skipText}>Skip for now</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.full}>
      <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="front" />
      <SafeAreaView style={styles.overlay} edges={['top', 'left', 'right', 'bottom']}>
        <Text style={styles.badge}>Your face is the data</Text>
        <Text style={styles.headline}>Know your skin age in seconds</Text>
        <Text style={styles.hint}>Center your face in the oval</Text>
        <View style={styles.ovalWrap}>
          <View style={styles.oval} />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <ConsumerPrimaryButton
          label={busy ? 'Analyzing…' : 'Scan now'}
          onPress={() => void capture()}
        />
        <Pressable
          onPress={skip}
          style={styles.skipBtn}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Skip for now">
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
        <Text style={styles.disclaimer}>Skin age estimate · Not a medical diagnosis</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  full: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, padding: JournalTokens.spacing.lg, justifyContent: 'center', gap: 12 },
  overlay: {
    flex: 1,
    padding: JournalTokens.spacing.lg,
    justifyContent: 'flex-end',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: JournalTokens.radius.pill,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },
  headline: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    fontFamily: JournalTokens.font.display,
  },
  hint: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginBottom: 8 },
  ovalWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  oval: {
    width: 220,
    height: 280,
    borderRadius: 140,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'transparent',
  },
  title: { fontSize: 22, fontWeight: '700', color: JournalTokens.color.ink },
  subtitle: { color: JournalTokens.color.muted, lineHeight: 22, marginBottom: 8 },
  error: { color: '#fecaca', textAlign: 'center', fontSize: 13 },
  skipBtn: { alignItems: 'center', paddingVertical: 10 },
  skipText: { color: 'rgba(255,255,255,0.9)', fontWeight: '600', fontSize: 14 },
  disclaimer: { color: 'rgba(255,255,255,0.6)', fontSize: 11, textAlign: 'center', marginTop: 4 },
});
