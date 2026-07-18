/**
 * P7.10 — Share with a doctor T12 wired to physician export API.
 */
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  SecondTierChrome,
  TierPrimary,
  TierSecondary,
} from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { PROFILE_HREF } from '@/constants/routes';
import { patientGet, patientPost } from '@/lib/patient-api';

export const SHARE_DOCTOR_TITLE = 'Share with a doctor';
export const SHARE_DOCTOR_SUB = 'a dated record — nothing AI-interpreted';
export const SHARE_EXPORT_API = '/api/patient/export/physician.pdf';
export const SHARE_LINK_API = '/api/patient/export/physician-share';

export default function ShareWithDoctorScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const createPdf = async () => {
    setBusy(true);
    try {
      await patientGet(`${SHARE_EXPORT_API}?range_days=30`);
      setStatus('PDF requested');
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  const shareLink = async () => {
    setBusy(true);
    try {
      const res = await patientPost(SHARE_LINK_API, { range_days: 30 });
      setStatus(res?.url ? `Link ready` : 'Share link created');
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : 'Share failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SecondTierChrome testID="screen-share-with-doctor">
      <View>
        <Text style={styles.title} testID="share-doctor-title">
          {SHARE_DOCTOR_TITLE}
        </Text>
        <Text style={styles.sub}>{SHARE_DOCTOR_SUB}</Text>
        <Text style={styles.row}>Date range · last 30 days</Text>
        <Text style={styles.row}>Include · all tags</Text>
        <Text style={styles.row}>Language · as saved</Text>
        {status ? <Text style={styles.status} testID="share-doctor-status">{status}</Text> : null}
      </View>
      <View>
        <TierPrimary
          label={busy ? 'Working…' : 'Create PDF'}
          testID="share-doctor-pdf"
          onPress={() => void createPdf()}
        />
        <TierSecondary
          label="Share link instead"
          testID="share-doctor-link"
          onPress={() => void shareLink()}
        />
        <TierSecondary label="Back" testID="share-doctor-back" onPress={() => router.replace(PROFILE_HREF)} />
      </View>
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 8 },
  sub: { fontSize: 15, color: AppTokens.color.muted, marginBottom: 16 },
  row: { fontSize: 15, color: AppTokens.color.ink, marginBottom: 8 },
  status: { marginTop: 12, color: AppTokens.color.safe },
});
