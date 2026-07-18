/**
 * P7.34 — Screen 2c capture failure / retry (manual escape required).
 * Copy is driven by error_code + reason so quality / AV / perceive are not one mask.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  SecondTierChrome,
  TierPrimary,
  TierSecondary,
} from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { CAPTURE_2A_HREF, MANUAL_ENTRY_HREF } from '@/constants/routes';
import {
  VISION_FAIL_MANUAL,
  VISION_FAIL_RETRY,
  copyForCaptureFailure,
} from '@/lib/capture-failure-copy';

export {
  AV_BLOCKED_TITLE,
  QUALITY_FAIL_TITLE,
  VISION_FAIL_MANUAL,
  VISION_FAIL_RETRY,
  VISION_FAIL_TITLE,
  copyForCaptureFailure,
} from '@/lib/capture-failure-copy';

export default function VisionFailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ error_code?: string; reason?: string }>();
  const copy = copyForCaptureFailure({
    error_code: params.error_code,
    reason: params.reason,
  });

  return (
    <SecondTierChrome testID={copy.testID}>
      <View>
        <Text style={styles.title} testID="vision-fail-title">
          {copy.title}
        </Text>
        <Text style={styles.body} testID="vision-fail-body">
          {copy.body}
        </Text>
        {params.error_code ? (
          <Text style={styles.code} testID="vision-fail-error-code">
            {String(params.error_code)}
          </Text>
        ) : null}
      </View>
      <View>
        <TierPrimary
          label={VISION_FAIL_RETRY}
          testID="vision-fail-retry"
          onPress={() => router.replace(CAPTURE_2A_HREF)}
        />
        {copy.allowManual ? (
          <TierSecondary
            label={VISION_FAIL_MANUAL}
            testID="vision-fail-manual"
            onPress={() => router.push(MANUAL_ENTRY_HREF)}
          />
        ) : null}
      </View>
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, color: AppTokens.color.muted },
  code: { marginTop: 12, fontSize: 12, color: AppTokens.color.hint },
});
