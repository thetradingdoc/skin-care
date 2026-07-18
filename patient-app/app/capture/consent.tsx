/**
 * Frame 1 — Pre-capture consent (cold onboarding).
 * Distinct from profile/consent-privacy (post-auth acknowledgment).
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import {
  SecondTierChrome,
  TierPrimary,
  TierSecondary,
} from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { CAPTURE_2A_HREF, MANUAL_ENTRY_HREF } from '@/constants/routes';

export const ONBOARDING_CONSENT_TITLE = 'Before we start';
export const ONBOARDING_CONSENT_BODY =
  'touche reads photos and documents you attach to log facts across six tags — skin, bill, prescription, mark, lab, or other. Optional AI reads can draft fields you confirm; manual entry is always free. It never diagnoses. Uploads are scanned for malware, encrypted at rest (without key rotation/KMS yet), and media/raw text are purged on a schedule (90 days after confirm; 30 days for unconfirmed drafts). Nothing you upload is used to train outside models. Full details are in the Privacy Policy.';
export const ONBOARDING_CONSENT_CONTINUE = 'I understand, continue';
export const ONBOARDING_CONSENT_MANUAL = 'Enter details manually instead';

export default function CaptureConsentScreen() {
  const router = useRouter();

  return (
    <SecondTierChrome testID="capture-1-consent">
      <View>
        <Text style={styles.title} testID="capture-consent-title">
          {ONBOARDING_CONSENT_TITLE}
        </Text>
        <Text style={styles.body} testID="capture-consent-body">
          {ONBOARDING_CONSENT_BODY}
        </Text>
      </View>
      <View>
        <TierPrimary
          label={ONBOARDING_CONSENT_CONTINUE}
          testID="capture-consent-continue"
          onPress={() => router.push(CAPTURE_2A_HREF)}
        />
        <TierSecondary
          label={ONBOARDING_CONSENT_MANUAL}
          testID="capture-consent-manual"
          onPress={() => router.push(MANUAL_ENTRY_HREF)}
        />
        <Text
          style={styles.privacy}
          testID="capture-consent-privacy"
          onPress={() => {
            void Linking.openURL('https://app.trytouche.com/privacy');
          }}>
          privacy details
        </Text>
      </View>
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, color: AppTokens.color.muted },
  privacy: {
    textAlign: 'center',
    color: AppTokens.color.muted,
    marginTop: 12,
    fontSize: 13,
  },
});
