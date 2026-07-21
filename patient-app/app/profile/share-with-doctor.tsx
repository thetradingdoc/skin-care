/**
 * Step 33 — Share with doctor (mock frame 33).
 * Real export via physician-share / physician.pdf — never fake success.
 */
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { PROFILE_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { PatientApiError } from '@/lib/patient-api-error';
import { patientGetBinary, patientPost } from '@/lib/patient-api';

export const SHARE_DOCTOR_TITLE = 'Share with doctor';
export const SHARE_DOCTOR_SUB = 'A read-only export of your records — you choose the window.';
export const SHARE_EXPORT_API = '/api/patient/export/physician.pdf';
export const SHARE_LINK_API = '/api/patient/export/physician-share';

type Outcome =
  | { kind: 'idle' }
  | { kind: 'ok'; message: string; url?: string }
  | { kind: 'error'; message: string };

function errorMessage(e: unknown): string {
  if (e instanceof PatientApiError) {
    if (e.error_code === 'PATIENT_ID_REQUIRED') {
      return 'Sign in again — we need a patient account to build this export.';
    }
    if (e.error_code === 'EMPTY_EXPORT') {
      return 'Export returned empty — nothing to share yet.';
    }
    return e.error_code || e.message || 'Export failed';
  }
  return e instanceof Error ? e.message : 'Export failed';
}

export default function ShareWithDoctorScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });

  const generateLink = async () => {
    setBusy(true);
    setOutcome({ kind: 'idle' });
    try {
      const res = await patientPost(SHARE_LINK_API, { ttl_sec: 7 * 24 * 3600 });
      const url = String(res?.url || res?.share_url || '').trim();
      const token = String(res?.token || '').trim();
      // Honest success only when the API returned a real link/token — never invent one
      if (!res?.success || (!url && !token)) {
        setOutcome({
          kind: 'error',
          message: String(res?.error_code || res?.error || 'Share link was not created'),
        });
        return;
      }
      const resolvedUrl = url || `(token ${token.slice(0, 8)}…)`;
      setOutcome({
        kind: 'ok',
        message: 'Link ready — expires 7 days after sending.',
        url: url || undefined,
      });
      if (url && Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(url).catch(() => {});
      }
      if (url && Platform.OS !== 'web') {
        // Surface URL in status; opening is optional
        void resolvedUrl;
      }
    } catch (e: unknown) {
      setOutcome({ kind: 'error', message: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const createPdf = async () => {
    setBusy(true);
    setOutcome({ kind: 'idle' });
    try {
      // Binary path — patientGet would JSON-parse the PDF and falsely fail/succeed
      const { blob, byteLength, contentType } = await patientGetBinary(
        `${SHARE_EXPORT_API}?range_days=90`,
      );
      if (!contentType.includes('pdf') && byteLength < 100) {
        setOutcome({ kind: 'error', message: 'Export did not return a PDF.' });
        return;
      }
      if (Platform.OS === 'web' && typeof URL !== 'undefined') {
        const href = URL.createObjectURL(blob);
        void Linking.openURL(href);
        setOutcome({
          kind: 'ok',
          message: `PDF ready (${Math.round(byteLength / 1024)} KB).`,
          url: href,
        });
      } else {
        setOutcome({
          kind: 'ok',
          message: `PDF ready (${Math.round(byteLength / 1024)} KB).`,
        });
      }
    } catch (e: unknown) {
      setOutcome({ kind: 'error', message: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']} testID="screen-share-with-doctor">
      <View style={styles.pad}>
        <BackNavHeader
          label="Back"
          onBack={() => router.replace(PROFILE_HREF)}
          testID="share-doctor-back-nav"
        />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} testID="share-doctor-title">
          {SHARE_DOCTOR_TITLE}
        </Text>
        <Text style={styles.tagline} testID="share-doctor-tagline">
          {SHARE_DOCTOR_SUB}
        </Text>

        <View style={styles.field} testID="share-doctor-range">
          <Text style={styles.fieldK}>Range</Text>
          <Text style={styles.fieldV}>Last 90 days</Text>
        </View>
        <View style={styles.field} testID="share-doctor-include">
          <Text style={styles.fieldK}>Include</Text>
          <Text style={styles.fieldV}>Skin, Rx, Lab</Text>
        </View>
        <View style={styles.field} testID="share-doctor-expires">
          <Text style={styles.fieldK}>Expires</Text>
          <Text style={styles.fieldV}>7 days after sending</Text>
        </View>

        {outcome.kind === 'ok' ? (
          <View style={styles.okBox} testID="share-doctor-success">
            <Text style={styles.okText} testID="share-doctor-status">
              {outcome.message}
            </Text>
            {outcome.url ? (
              <Text style={styles.urlText} testID="share-doctor-url" selectable>
                {outcome.url}
              </Text>
            ) : null}
          </View>
        ) : null}
        {outcome.kind === 'error' ? (
          <View style={styles.errBox} testID="share-doctor-error">
            <Text style={styles.errText} testID="share-doctor-status">
              {outcome.message}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.cta, busy && styles.ctaDisabled]}
          disabled={busy}
          onPress={() => void generateLink()}
          accessibilityRole="button"
          testID="share-doctor-link">
          <Text style={styles.ctaText}>{busy ? 'Working…' : 'Generate link'}</Text>
        </Pressable>
        <Pressable
          style={styles.secondary}
          disabled={busy}
          onPress={() => void createPdf()}
          accessibilityRole="button"
          testID="share-doctor-pdf">
          <Text style={styles.secondaryText}>{busy ? 'Working…' : 'Download PDF instead'}</Text>
        </Pressable>
        {/* Legacy back control for older locks */}
        <Pressable testID="share-doctor-back" onPress={() => router.replace(PROFILE_HREF)}>
          <Text style={styles.legacyBack}>Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white },
  pad: { paddingHorizontal: 12 },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 19,
    color: V4DesignTokens.color.black,
    marginBottom: 4,
  },
  tagline: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
    marginBottom: 12,
    lineHeight: 18,
  },
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: V4DesignTokens.color.line,
  },
  fieldK: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
  },
  fieldV: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 14,
    color: V4DesignTokens.color.black,
  },
  okBox: {
    marginTop: 12,
    backgroundColor: '#F0F7F0',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  okText: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 14,
    color: V4DesignTokens.color.black,
  },
  urlText: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    color: V4DesignTokens.color.muted,
  },
  errBox: {
    marginTop: 12,
    backgroundColor: '#FDF0F0',
    borderRadius: 12,
    padding: 12,
  },
  errText: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 14,
    color: V4DesignTokens.color.redDeep,
  },
  footer: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  cta: {
    backgroundColor: V4DesignTokens.color.black,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 15,
    color: V4DesignTokens.color.white,
  },
  secondary: { alignItems: 'center', paddingVertical: 10 },
  secondaryText: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 14,
    color: V4DesignTokens.color.red,
  },
  legacyBack: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
    textAlign: 'center',
  },
});
