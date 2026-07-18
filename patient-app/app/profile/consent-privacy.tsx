/**
 * P7.42 — Profile consent & privacy.
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
import { PROFILE_HREF } from '@/constants/routes';

export const CONSENT_TITLE = 'Consent & privacy';
export const CONSENT_BODY =
  'touche reads photos and documents you attach to log facts across six tags — skin, bill, prescription, mark, lab, or other. Optional AI reads can draft fields you confirm; manual entry is always free. It never diagnoses. Uploads are scanned for malware, encrypted at rest (without key rotation/KMS yet), and media/raw text are purged on a schedule (90 days after confirm; 30 days for unconfirmed drafts). Nothing you upload is used to train outside models. Full details are in the Privacy Policy.';

export default function ProfileConsentPrivacyScreen() {
  const router = useRouter();

  return (
    <SecondTierChrome testID="screen-profile-consent-privacy">
      <View>
        <Text style={styles.title} testID="consent-privacy-title">
          {CONSENT_TITLE}
        </Text>
        <Text style={styles.body} testID="consent-privacy-body">
          {CONSENT_BODY}
        </Text>
        <Text style={styles.detail}>
          You can delete your account and related health data from Profile. Documents keep their
          own language; we detect it and ask you to confirm.
        </Text>
      </View>
      <View>
        <TierPrimary
          label="I understand"
          testID="consent-privacy-ack"
          onPress={() => router.replace(PROFILE_HREF)}
        />
        <TierSecondary
          label="privacy details"
          testID="consent-privacy-details"
          onPress={() => {
            void Linking.openURL('https://app.trytouche.com/privacy');
          }}
        />
      </View>
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, color: AppTokens.color.ink, marginBottom: 12 },
  detail: { fontSize: 14, lineHeight: 22, color: AppTokens.color.muted },
});
