// PR1 soft-launch safety — 2026-07-12
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConditionChipRow } from '@/components/journal/JournalHomeBlocks';
import { useToast } from '@/components/billing-feedback';
import { ConsumerPrimaryButton } from '@/components/billing-ui';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { AppTokens } from '@/constants/appTokens';
import { JOURNAL_CAPTURE_ENABLED } from '@/constants/feature-flags';
import { HOME_HREF, ROUTINE_PICK_HREF } from '@/constants/routes';
import { postJournalDailyPhoto, type JournalConditionTag } from '@/lib/journal-api';
import { setFirstPhotoLogged } from '@/lib/onboarding-storage';
import { consumePendingCaptureUri } from '@/lib/pending-capture-uri';
import { localTodayIso, resolveRoutineDayMode } from '@/lib/routine-day-mode';

export default function JournalCaptureScreen() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ date?: string; library?: string }>();
  const entryDate =
    typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : localTodayIso();

  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [conditionTags, setConditionTags] = useState<JournalConditionTag[]>([]);
  const [note, setNote] = useState('');

  const dayMode = resolveRoutineDayMode(entryDate);
  const allowsPhoto = dayMode.allows_photo;

  // PR1: soft-launch guard — redirect if journal capture is disabled
  useEffect(() => {
    if (!JOURNAL_CAPTURE_ENABLED) {
      router.replace(ROUTINE_PICK_HREF);
    }
  }, [router]);

  // PR1-24: load pending library URI async (not sync at render)
  useEffect(() => {
    if (!JOURNAL_CAPTURE_ENABLED) return;
    let cancelled = false;
    void (async () => {
      const pending = await consumePendingCaptureUri();
      if (cancelled || !pending?.uri) return;
      setCapturedUri((prev) => prev || pending.uri);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async () => {
    if (!capturedUri) return;
    setBusy(true);
    try {
      await postJournalDailyPhoto({
        photoUri: capturedUri,
        entryDate,
        conditionTags,
        note: note.trim() || undefined,
      });
      await setFirstPhotoLogged();
      if (Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (_) {}
      }
      // PR1-25: celebrate + refresh Home after photo
      router.replace(`${HOME_HREF}?celebrate=1&refresh=1` as typeof HOME_HREF);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not save photo', 'error');
    } finally {
      setBusy(false);
    }
  }, [capturedUri, conditionTags, entryDate, note, router, showToast]);

  const snap = useCallback(async () => {
    if (!camRef.current || !allowsPhoto) return;
    const photo = await camRef.current.takePictureAsync({ quality: 0.85 });
    if (photo?.uri) setCapturedUri(photo.uri);
  }, [allowsPhoto]);

  if (checking || !ready) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={AppTokens.color.accent} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  if (!JOURNAL_CAPTURE_ENABLED) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={AppTokens.color.accent} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  if (capturedUri) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <Stack.Screen options={{ title: 'Save to journal' }} />
        <ScrollView contentContainerStyle={styles.review}>
          <Image source={{ uri: capturedUri }} style={styles.preview} />
          <Text style={styles.reviewTitle}>How does it look?</Text>
          <Text style={styles.reviewSub}>Select everything that applies — this helps find patterns.</Text>
          <ConditionChipRow selected={conditionTags} onChange={setConditionTags} />
          <TextInput
            style={styles.noteInput}
            placeholder="Add a note (optional)"
            placeholderTextColor={AppTokens.color.muted}
            value={note}
            onChangeText={setNote}
            multiline
          />
          <ConsumerPrimaryButton label={busy ? 'Saving…' : 'Save to journal'} onPress={() => void save()} />
          <Pressable onPress={() => setCapturedUri(null)} style={styles.retake}>
            <Text style={styles.retakeText}>Retake</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.root}>
        <Stack.Screen options={{ title: 'Log photo' }} />
        <View style={styles.perm}>
          <Text style={styles.permText}>Camera access is needed for your daily skin photo.</Text>
          <ConsumerPrimaryButton label="Enable camera" onPress={() => void requestPermission()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.cameraRoot}>
      <Stack.Screen options={{ title: 'Log photo', headerShown: false }} />
      <CameraView ref={camRef} style={styles.camera} facing="front">
        <SafeAreaView style={styles.cameraUi} edges={['top', 'bottom']}>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
          <View style={styles.shutterRow}>
            <Pressable onPress={() => void snap()} style={styles.shutter} accessibilityRole="button" />
          </View>
        </SafeAreaView>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  cameraRoot: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraUi: { flex: 1, justifyContent: 'space-between', padding: 16 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 16 },
  shutterRow: { alignItems: 'center', paddingBottom: 24 },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  review: { padding: 16, gap: 12, paddingBottom: 40 },
  preview: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#111' },
  reviewTitle: { fontFamily: AppTokens.font.display, fontSize: 22, color: AppTokens.color.ink },
  reviewSub: { fontSize: 13, color: AppTokens.color.muted, marginBottom: 4 },
  noteInput: {
    backgroundColor: AppTokens.color.cream,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    padding: 12,
    fontSize: 13,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  retake: { alignItems: 'center', padding: 12 },
  retakeText: { color: AppTokens.color.muted, fontSize: 14 },
  perm: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  permText: { fontSize: 14, color: AppTokens.color.muted, textAlign: 'center' },
});
