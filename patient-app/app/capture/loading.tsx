/**
 * P7.04 — Screen 4 Loading: real gate → orchestrateCapture (no timers).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { SecondTierChrome } from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import type { CaptureFlowTag } from '@/lib/capture-state-machine';
import {
  runAiCaptureOrchestration,
  type CapturePipelinePhase,
} from '@/lib/capture-orchestration-client';

export const LOADING_STEP_READING = 'reading what you sent';
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

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;

    void (async () => {
      const result = await runAiCaptureOrchestration({
        uiTag: tag,
        entry,
        onPhase: (p) => {
          if (!cancelled) setPhase(p);
        },
      });
      if (cancelled) return;
      if (result.ok) {
        router.replace(result.confirmHref as never);
        return;
      }
      router.replace(result.href as never);
    })();

    return () => {
      cancelled = true;
    };
  }, [router, tag, entry]);

  return (
    <SecondTierChrome testID="capture-4-loading">
      <View style={styles.center}>
        <ActivityIndicator size="large" color={AppTokens.color.fabBg} />
        <Text
          style={[styles.step, phase === 'reading' && styles.stepOn]}
          testID="loading-step-reading">
          {LOADING_STEP_READING}
        </Text>
        <Text
          style={[styles.step, phase === 'extracting' && styles.stepOn]}
          testID="loading-step-extracting">
          {LOADING_STEP_EXTRACTING}
        </Text>
      </View>
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  step: { fontSize: 15, color: AppTokens.color.hint },
  stepOn: { color: AppTokens.color.ink, fontWeight: '600' },
});
