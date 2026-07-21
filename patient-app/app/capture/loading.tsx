/**
 * Step 16 — Loading (v4.1 frame 16).
 * Real gate → orchestrateCapture (no timers). Copy names only the step actually happening.
 * G-CANCEL — Cancel aborts navigation after return (no hung spinner / dead end).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { CAPTURE_2A_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import type { CaptureFlowTag } from '@/lib/capture-state-machine';
import {
  runAiCaptureOrchestration,
  type CapturePipelinePhase,
} from '@/lib/capture-orchestration-client';
import { clearPendingCaptureDraft } from '@/lib/pending-capture-draft';
import { clearPendingCaptureUri } from '@/lib/pending-capture-uri';

/** Active reading-phase copy (mock: "Reading your photo"). */
export const LOADING_STEP_READING = 'Reading your photo';
/** Active extracting-phase copy — only shown while that HTTP step is running. */
export const LOADING_STEP_EXTRACTING = 'extracting date, provider, facts';

const TAGS: CaptureFlowTag[] = ['skin', 'bill', 'rx', 'mark', 'lab', 'other'];

function parseTag(raw: string | undefined): CaptureFlowTag {
  const t = String(raw || 'skin').trim();
  return (TAGS.includes(t as CaptureFlowTag) ? t : 'skin') as CaptureFlowTag;
}

export default function CaptureLoadingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tag?: string; entry?: string }>();
  const tag = parseTag(params.tag);
  const entry = params.entry === 'track' ? 'track' : 'onboarding';
  const [phase, setPhase] = useState<CapturePipelinePhase>('reading');
  const started = useRef(false);
  const cancelledRef = useRef(false);

  const onCancel = useCallback(() => {
    cancelledRef.current = true;
    void clearPendingCaptureDraft();
    void clearPendingCaptureUri();
    router.replace(CAPTURE_2A_HREF as never);
  }, [router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    cancelledRef.current = false;

    void (async () => {
      const result = await runAiCaptureOrchestration({
        uiTag: tag,
        entry,
        onPhase: (p) => {
          if (!cancelledRef.current) setPhase(p);
        },
      });
      if (cancelledRef.current) return;
      if (result.ok) {
        router.replace(result.confirmHref as never);
        return;
      }
      router.replace(result.href as never);
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [router, tag, entry]);

  const stepCopy = phase === 'extracting' ? LOADING_STEP_EXTRACTING : LOADING_STEP_READING;
  const stepTestId = phase === 'extracting' ? 'loading-step-extracting' : 'loading-step-reading';

  return (
    <SafeAreaView style={styles.root} testID="capture-4-loading" edges={['top', 'bottom']}>
      <BackNavHeader label="Cancel" testID="capture-loading-cancel" onBack={onCancel} />
      <View style={styles.center}>
        <ActivityIndicator size="large" color={V4DesignTokens.color.red} />
        <Text style={styles.step} testID={stepTestId}>
          {stepCopy}
        </Text>
        <Text style={styles.hint} testID="loading-honesty">
          Only the step actually happening.
        </Text>
      </View>
      <Pressable
        style={styles.cancelBtn}
        testID="capture-loading-cancel-btn"
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Cancel">
        <Text style={styles.cancelLabel}>Cancel</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white, paddingHorizontal: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  step: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 15.5,
    color: V4DesignTokens.color.black,
    textAlign: 'center',
  },
  hint: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
    textAlign: 'center',
  },
  cancelBtn: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cancelLabel: {
    fontFamily: V4DesignTokens.font.bodyMedium,
    fontSize: 15,
    color: V4DesignTokens.color.muted,
  },
});
