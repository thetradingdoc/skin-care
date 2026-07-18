/**
 * TOUCH-062/063 + TOUCH-109 — Spot soft-ring capture + “What is this?” + library when denied.
 */
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/billing-feedback';
import { BodyMapPicker, SpotCaptureFrame } from '@/components/v3';
import { ToucheMarkCompact } from '@/components/ToucheMarkCompact';
import { AppTokens } from '@/constants/appTokens';
import { SIGN_IN_HREF, MARK_COMPARE_HREF } from '@/constants/routes';
import { consumePendingCaptureUri } from '@/lib/pending-capture-uri';
import { createCaptureRequestId } from '@/lib/capture-request-id';
import { captureRecordFact } from '@/lib/patient-record-capture';
import { getPatientSessionId } from '@/lib/patient-session';
import { localTodayIso } from '@/lib/routine-day-mode';
import type { BodyRegion } from '@/lib/spot-store';

export default function TrackCaptureScreen() {
  const { showToast } = useToast();
  const router = useRouter();
  const params = useLocalSearchParams<{ libraryUri?: string; spotId?: string }>();
  const [region, setRegion] = useState<BodyRegion>('neck');
  const [uri, setUri] = useState<string | null>(
    typeof params.libraryUri === 'string' ? params.libraryUri : null,
  );
  const [askOpen, setAskOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  /** Stable across retries of the same Save until success. */
  const pendingRequestId = React.useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const sid = await getPatientSessionId();
      if (!cancelled) setHasSession(Boolean(sid));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const pending = await consumePendingCaptureUri();
      if (cancelled || !pending?.uri) return;
      setUri((prev) => prev || pending.uri);
      setAskOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof params.libraryUri === 'string' && params.libraryUri) {
      setAskOpen(true);
    }
  }, [params.libraryUri]);

  const capturePhoto = useCallback(async () => {
    setError(null);
    setCameraDenied(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setCameraDenied(true);
      setError('Camera access is off. Upload from your library instead.');
      return;
    }
    const picked = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!picked.canceled && picked.assets?.[0]?.uri) {
      setUri(picked.assets[0].uri);
      setAskOpen(true);
    }
  }, []);

  const pickLibrary = useCallback(async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library access is required.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!picked.canceled && picked.assets?.[0]?.uri) {
      setUri(picked.assets[0].uri);
      setAskOpen(true);
      setCameraDenied(false);
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
    if (!pendingRequestId.current) pendingRequestId.current = createCaptureRequestId();
    const requestId = pendingRequestId.current;
    try {
      const today = localTodayIso();
      const trimmedLabel = label.trim();
      // C2 / H3 — unified facts pipeline (auth → /records/capture; guest → anonymous + capture_token)
      const factResult = await captureRecordFact({
        tag: 'mark',
        uri,
        ai_or_manual: 'manual',
        date: today,
        label: trimmedLabel || undefined,
        note: trimmedLabel || undefined,
        body_location: region,
        body_area: region,
        compare_group_id:
          typeof params.spotId === 'string' && params.spotId ? params.spotId : undefined,
        request_id: requestId,
      });

      const sid = await getPatientSessionId();
      if (!sid || factResult.via === 'anonymous_capture') {
        pendingRequestId.current = null;
        showToast('Sign in to keep this spot on your account.', 'success');
        router.replace(SIGN_IN_HREF);
        return;
      }

      // Phase D — facts/marks only. No dual-write to legacy /api/patient/spots.
      const fact = factResult.fact || {};
      const structured =
        fact.structured_json && typeof fact.structured_json === 'object'
          ? (fact.structured_json as Record<string, unknown>)
          : {};
      const compareGroupId = String(
        (typeof params.spotId === 'string' && params.spotId) ||
          structured.compare_group_id ||
          fact.compare_group_id ||
          fact.id ||
          requestId,
      );
      pendingRequestId.current = null;
      router.replace({
        pathname: MARK_COMPARE_HREF,
        params: { compareGroupId },
      } as never);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not save your photo. Try again.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }, [params.spotId, region, uri, label, router, showToast]);

  if (hasSession === null) {
    return <SafeAreaView style={styles.root} />;
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <ToucheMarkCompact height={20} style={styles.mark} />
        <Text style={styles.title}>Spot</Text>
        <Text style={styles.sub}>Soft ring · location only</Text>

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
          <View style={styles.deniedRow} testID="spot-camera-denied">
            <Pressable style={styles.settingsBtn} onPress={openSettings} accessibilityRole="button">
              <Text style={styles.settingsBtnText}>Open Settings</Text>
            </Pressable>
            <Pressable
              style={styles.libraryBtn}
              onPress={() => void pickLibrary()}
              testID="spot-library-upload"
              accessibilityRole="button">
              <Text style={styles.libraryBtnText}>Upload from library</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => void pickLibrary()} testID="spot-library-optional">
            <Text style={styles.libraryOptional}>or upload from library</Text>
          </Pressable>
        )}

        {/* TOUCH-063 — calm “What is this?” after capture */}
        {askOpen && uri ? (
          <View style={styles.ask} testID="spot-what-is-this">
            <Text style={styles.askTitle}>What is this?</Text>
            <Text style={styles.askSub}>A short label helps you find it later.</Text>
            <TextInput
              style={styles.askInput}
              placeholder="e.g. left cheek patch"
              value={label}
              onChangeText={setLabel}
              testID="spot-what-label"
            />
            <BodyMapPicker selected={region} onSelect={setRegion} />
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <Pressable style={styles.cancel} onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.save, (!uri || saving) && styles.saveDisabled]}
            onPress={() => void save()}
            disabled={!uri || saving}
            accessibilityRole="button"
            testID="spot-save">
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  content: { padding: AppTokens.spacing.lg, flex: 1 },
  mark: { alignSelf: 'flex-start', marginBottom: 8 },
  title: {
    fontSize: 22,
    fontFamily: AppTokens.font.display,
    textAlign: 'center',
    color: AppTokens.color.ink,
  },
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
  deniedRow: { alignItems: 'center', gap: 8, marginBottom: 8 },
  settingsBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  settingsBtnText: { color: AppTokens.color.brandAccent, fontSize: 13, fontWeight: '600' },
  libraryBtn: {
    backgroundColor: AppTokens.color.fabBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  libraryBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  libraryOptional: {
    textAlign: 'center',
    color: AppTokens.color.muted,
    marginBottom: 8,
    textDecorationLine: 'underline',
    fontSize: 13,
  },
  ask: {
    marginTop: 4,
    marginBottom: 8,
    gap: 8,
    padding: 12,
    backgroundColor: AppTokens.color.cream,
    borderRadius: 12,
  },
  askTitle: { fontFamily: AppTokens.font.display, fontSize: 18, color: AppTokens.color.ink },
  askSub: { fontFamily: AppTokens.font.body, fontSize: 13, color: AppTokens.color.muted },
  askInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppTokens.color.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: AppTokens.font.body,
    backgroundColor: '#fff',
  },
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
