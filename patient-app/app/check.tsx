/**
 * TOUCH-033–037 + TOUCH-107 — Check camera shell (authenticated sole home).
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ToucheMarkCompact } from '@/components/ToucheMarkCompact';
import { AppTokens } from '@/constants/appTokens';
import { ALERTS_HREF, BOTTLE_HREF, PROOF_HREF, SEVERITY_HREF } from '@/constants/routes';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { fetchAlertsCount, fetchCheckSafeMode } from '@/lib/conflict-api';
import { patientGet, patientPost } from '@/lib/patient-api';
import { registerPushDeviceToken } from '@/lib/push-registration';
import { localTodayIso } from '@/lib/routine-day-mode';
import { mimeTypeFromImagePickerAsset } from '@/lib/upload-uri';

const BOTTLE_TIP_KEY = 'touche_check_bottle_tip_dismissed';
const YESTERDAY_URI_KEY = 'touche_check_yesterday_uri';
const AGENT_DISMISS_KEY = 'touche_check_agent_dismissed_date';

export default function CheckScreen() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [ghostUri, setGhostUri] = useState<string | null>(null);
  const [isDayOne, setIsDayOne] = useState(true);
  const [showBottleTip, setShowBottleTip] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [agentMsg, setAgentMsg] = useState<string | null>(null);
  const [agentBusy, setAgentBusy] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [ambient, setAmbient] = useState('barrier: calm');
  const [safeModeActive, setSafeModeActive] = useState(false);
  const [recoveryProtocol, setRecoveryProtocol] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      const tipDone = await AsyncStorage.getItem(BOTTLE_TIP_KEY);
      if (!tipDone) setShowBottleTip(true);
      const uri = await AsyncStorage.getItem(YESTERDAY_URI_KEY);
      if (uri) {
        setGhostUri(uri);
        setIsDayOne(false);
      } else {
        setIsDayOne(true);
      }
      await registerPushDeviceToken();

      try {
        const dismissed = await AsyncStorage.getItem(AGENT_DISMISS_KEY);
        if (dismissed !== localTodayIso()) {
          const delta = await patientGet('/api/patient/check/agent-delta');
          if (delta?.show && delta?.message) setAgentMsg(String(delta.message));
        }
      } catch {
        /* no banner */
      }

      try {
        const count = await fetchAlertsCount();
        setAlertCount(count);
      } catch {
        setAlertCount(0);
      }

      // TOUCH-101 — safe-mode ambient + protocol (TOUCH-100)
      try {
        const sm = await fetchCheckSafeMode();
        if (sm?.safe_mode?.active && sm.safe_mode.ambient_copy) {
          setAmbient(String(sm.safe_mode.ambient_copy));
          setSafeModeActive(true);
          setRecoveryProtocol(
            Array.isArray(sm.safe_mode.recovery_protocol)
              ? sm.safe_mode.recovery_protocol.map(String)
              : [],
          );
        }
      } catch {
        /* keep default */
      }
    })();
  }, []);

  const dismissTip = useCallback(async () => {
    setShowBottleTip(false);
    await AsyncStorage.setItem(BOTTLE_TIP_KEY, '1');
  }, []);

  const enterBottle = useCallback(() => {
    void dismissTip();
    router.push(BOTTLE_HREF);
  }, [dismissTip, router]);

  const openSeverity = useCallback(
    async (uri: string) => {
      await AsyncStorage.setItem(YESTERDAY_URI_KEY, uri);
      setGhostUri(uri);
      setIsDayOne(false);
      router.push({
        pathname: SEVERITY_HREF,
        params: { uri, date: localTodayIso() },
      } as never);
    },
    [router],
  );

  const onShutter = useCallback(async () => {
    if (!camRef.current) return;
    const photo = await camRef.current.takePictureAsync({ quality: 0.85 });
    if (photo?.uri) await openSeverity(photo.uri);
  }, [openSeverity]);

  const onLibraryUpload = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    void mimeTypeFromImagePickerAsset(asset);
    await openSeverity(asset.uri);
  }, [openSeverity]);

  /** TOUCH-056 — long-press shutter → bottle mode (back camera path). */
  const onLongPressShutter = useCallback(() => {
    setFacing('back');
    enterBottle();
  }, [enterBottle]);

  /** TOUCH-056 — flip to back also enters bottle mode. */
  const onFlipToBottle = useCallback(() => {
    setFacing('back');
    enterBottle();
  }, [enterBottle]);

  const onBell = useCallback(() => {
    if (alertCount <= 0) return;
    router.push(ALERTS_HREF);
  }, [alertCount, router]);

  const onAgentSkip = useCallback(async () => {
    setAgentBusy(true);
    try {
      await patientPost('/api/patient/check/agent-delta/skip', {});
      setAgentMsg(null);
      await AsyncStorage.setItem(AGENT_DISMISS_KEY, localTodayIso());
    } finally {
      setAgentBusy(false);
    }
  }, []);

  const onAgentKeep = useCallback(async () => {
    setAgentBusy(true);
    try {
      await patientPost('/api/patient/check/agent-delta/keep', {});
      setAgentMsg(null);
      await AsyncStorage.setItem(AGENT_DISMISS_KEY, localTodayIso());
    } finally {
      setAgentBusy(false);
    }
  }, []);

  if (checking || !ready) {
    return <SafeAreaView style={styles.root} />;
  }

  const cameraDenied = permission && !permission.granted;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.chrome} testID="check-shell">
        <Pressable
          style={styles.gear}
          onPress={() => router.push('/(tabs)/account' as never)}
          accessibilityLabel="Profile settings"
          testID="check-gear">
          <Text style={styles.chromeIcon}>⚙</Text>
        </Pressable>
        <Text style={styles.ambient} testID="check-ambient">
          {ambient}
        </Text>
        <Pressable
          style={styles.bell}
          onPress={onBell}
          accessibilityLabel={alertCount > 0 ? `Alerts, ${alertCount}` : 'Alerts'}
          testID="check-bell">
          <Text style={styles.chromeIcon}>🔔</Text>
          {alertCount > 0 ? (
            <View style={styles.badge} testID="check-bell-badge">
              <Text style={styles.badgeText}>{alertCount > 9 ? '9+' : String(alertCount)}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.markRow}>
        <ToucheMarkCompact height={20} />
      </View>

      {/* TOUCH-052 — swipe/affordance → Proof */}
      <Pressable
        style={styles.proofAffordance}
        onPress={() => router.push(PROOF_HREF)}
        testID="check-open-proof"
        accessibilityRole="button"
        accessibilityLabel="Open Proof">
        <Text style={styles.proofAffordanceText}>Proof ↑</Text>
      </Pressable>

      <View style={styles.cameraRegion} testID="check-camera-region">
        {cameraDenied ? (
          <View style={styles.denied} testID="check-camera-denied">
            <Text style={styles.deniedTitle}>Camera access is off</Text>
            <Text style={styles.deniedBody}>
              Allow camera for the daily check, or upload a photo from your library — same severity path.
            </Text>
            <Pressable style={styles.deniedBtn} onPress={() => void requestPermission()}>
              <Text style={styles.deniedBtnText}>Enable camera</Text>
            </Pressable>
            <Pressable style={styles.deniedLink} onPress={() => void onLibraryUpload()} testID="check-library-upload">
              <Text style={styles.deniedLinkText}>Upload from library</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing={facing} />
            {ghostUri && !isDayOne ? (
              <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="check-ghost">
                <Image
                  source={{ uri: ghostUri }}
                  style={[StyleSheet.absoluteFill, styles.ghost]}
                />
              </View>
            ) : null}
            {isDayOne ? (
              <View style={styles.oval} pointerEvents="none" testID="check-day1-oval" />
            ) : null}
          </>
        )}
      </View>

      {safeModeActive && recoveryProtocol.length ? (
        <View style={styles.safeModeStrip} testID="check-safe-mode-protocol">
          <Text style={styles.safeModeTitle}>Recovery protocol</Text>
          {recoveryProtocol.slice(0, 4).map((line) => (
            <Text key={line} style={styles.safeModeLine}>
              · {line}
            </Text>
          ))}
        </View>
      ) : null}

      {agentMsg ? (
        <View style={styles.agentBanner} testID="check-agent-banner">
          <Text style={styles.agentText}>{agentMsg}</Text>
          <View style={styles.agentRow}>
            <Pressable style={styles.agentSecondary} disabled={agentBusy} onPress={() => void onAgentKeep()} testID="agent-keep">
              <Text style={styles.agentSecondaryText}>Keep</Text>
            </Pressable>
            <Pressable style={styles.agentPrimary} disabled={agentBusy} onPress={() => void onAgentSkip()} testID="agent-skip">
              <Text style={styles.agentPrimaryText}>Skip</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {showBottleTip ? (
        <Pressable style={styles.tip} onPress={() => void dismissTip()} testID="check-bottle-tip">
          <Text style={styles.tipText}>Long-press shutter or flip for bottle mode</Text>
        </Pressable>
      ) : null}

      <View style={styles.shutterRow}>
        <Pressable
          style={styles.flipBtn}
          onPress={onFlipToBottle}
          accessibilityLabel="Flip camera for bottle mode"
          testID="check-flip-bottle">
          <Text style={styles.flipBtnText}>Flip</Text>
        </Pressable>
        <Pressable
          style={styles.shutter}
          onPress={() => void onShutter()}
          onLongPress={onLongPressShutter}
          accessibilityLabel="Capture"
          testID="check-shutter"
        />
        <View style={styles.flipBtnSpacer} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  chrome: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  gear: { position: 'absolute', left: 12, padding: 6 },
  bell: { position: 'absolute', right: 12, padding: 6 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: AppTokens.color.hardNo,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  chromeIcon: { fontSize: 16 },
  ambient: {
    fontFamily: AppTokens.font.body,
    fontSize: 12,
    color: AppTokens.color.muted,
  },
  markRow: { alignItems: 'center', paddingBottom: 4 },
  proofAffordance: { alignItems: 'center', paddingVertical: 4 },
  proofAffordanceText: {
    fontFamily: AppTokens.font.body,
    fontSize: 12,
    color: AppTokens.color.muted,
    letterSpacing: 0.3,
  },
  cameraRegion: {
    flex: 1,
    backgroundColor: '#e9e5dd',
    overflow: 'hidden',
    position: 'relative',
  },
  ghost: { opacity: 0.28 },
  oval: {
    position: 'absolute',
    alignSelf: 'center',
    top: '22%',
    width: 180,
    height: 236,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(31,41,55,0.35)',
    borderRadius: 999,
  },
  agentBanner: {
    backgroundColor: AppTokens.color.cream,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AppTokens.color.line,
    padding: 12,
    gap: 10,
  },
  agentText: { fontFamily: AppTokens.font.body, fontSize: 13, color: AppTokens.color.ink },
  agentRow: { flexDirection: 'row', gap: 8 },
  agentSecondary: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppTokens.color.line,
    borderRadius: AppTokens.radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  agentSecondaryText: { color: AppTokens.color.ink, fontWeight: '600' },
  agentPrimary: {
    flex: 1,
    backgroundColor: AppTokens.color.fabBg,
    borderRadius: AppTokens.radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  agentPrimaryText: { color: '#fff', fontWeight: '600' },
  tip: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(31,41,55,0.85)',
    borderRadius: 10,
    padding: 12,
  },
  tipText: { color: '#fff', textAlign: 'center', fontSize: 13, fontFamily: AppTokens.font.body },
  shutterRow: {
    height: 88,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  flipBtn: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  flipBtnText: {
    fontFamily: AppTokens.font.body,
    fontSize: 13,
    color: AppTokens.color.ink,
    fontWeight: '600',
  },
  flipBtnSpacer: { width: 56 },
  /** TOUCH-036 — outlined shutter 58–72px. */
  shutter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: AppTokens.color.fabBg,
    backgroundColor: 'transparent',
  },
  safeModeStrip: {
    backgroundColor: AppTokens.color.cream,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AppTokens.color.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
  },
  safeModeTitle: {
    fontFamily: AppTokens.font.body,
    fontWeight: '700',
    fontSize: 12,
    color: AppTokens.color.ink,
    marginBottom: 2,
  },
  safeModeLine: {
    fontFamily: AppTokens.font.body,
    fontSize: 12,
    color: AppTokens.color.muted,
  },
  denied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  deniedTitle: {
    fontFamily: AppTokens.font.display,
    fontSize: 22,
    color: AppTokens.color.ink,
  },
  deniedBody: {
    fontFamily: AppTokens.font.body,
    fontSize: 14,
    color: AppTokens.color.muted,
    textAlign: 'center',
  },
  deniedBtn: {
    backgroundColor: AppTokens.color.fabBg,
    borderRadius: AppTokens.radius.md,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  deniedBtnText: { color: '#fff', fontWeight: '600' },
  deniedLink: { padding: 8 },
  deniedLinkText: {
    color: AppTokens.color.ink,
    textDecorationLine: 'underline',
    fontFamily: AppTokens.font.body,
  },
});
