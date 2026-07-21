/**
 * Step 4 — Plan preview (claim-safe).
 * MUST call GET /api/public/routines/:id/preview/claim-safe — never raw preview.expect.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { ONBOARDING_WHY_HREF, SIGN_IN_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { publicGet } from '@/lib/patient-api';
import { getPendingRoutineConcern } from '@/lib/routine-session';

type ClaimSafePreview = {
  claim_safe?: boolean;
  concern_id?: string;
  eyebrow?: string;
  title?: string;
  morning?: string;
  evening?: string;
  stop_if?: string;
  honesty?: string;
  cta_use?: string;
  cta_skip?: string;
};

export default function OnboardingPlanPreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ concern?: string }>();
  const [preview, setPreview] = useState<ClaimSafePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gap, setGap] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      setGap(null);
      try {
        const fromParams = typeof params.concern === 'string' ? params.concern : '';
        const pending = (await getPendingRoutineConcern()) || '';
        const concernId = fromParams || pending || 'hyperpigmentation';
        const data = await publicGet(
          `/api/public/routines/${encodeURIComponent(concernId)}/preview/claim-safe`,
        );
        const p = (data?.preview || null) as ClaimSafePreview | null;
        if (!p?.claim_safe) {
          if (!cancelled) {
            setGap(
              'CLAIM_SAFE_PREVIEW_MISSING — backend did not return claim_safe projection. Do not render raw expect strings.',
            );
          }
          return;
        }
        // Guard: refuse any unexpected expect fields if a bad proxy merges them.
        if ((p as { expect?: unknown }).expect != null) {
          if (!cancelled) {
            setGap('Claim-safe preview contained expect — refusing to render.');
          }
          return;
        }
        if (!cancelled) setPreview(p);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Preview failed';
        if (!cancelled) {
          if (msg.includes('CLAIM_SAFE') || msg.includes('404')) {
            setGap(msg);
          } else {
            setError(msg);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.concern]);

  if (gap) {
    return (
      <SafeAreaView style={styles.root} testID="screen-plan-preview-gap">
        <BackNavHeader label="Back" onBack={() => router.replace(ONBOARDING_WHY_HREF)} />
        <Text style={styles.gapTitle}>Plan preview blocked</Text>
        <Text style={styles.gapBody} testID="plan-preview-gap">
          {gap}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} testID="screen-plan-preview" edges={['top', 'bottom']}>
      <BackNavHeader
        label="Back"
        testID="plan-preview-back"
        onBack={() => router.replace(ONBOARDING_WHY_HREF)}
      />
      {loading ? (
        <ActivityIndicator color={V4DesignTokens.color.red} style={{ marginTop: 48 }} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Text style={styles.eyebrow} testID="plan-preview-eyebrow">
              {preview?.eyebrow || ''}
            </Text>
            <Text style={styles.title} testID="plan-preview-title">
              {preview?.title || ''}
            </Text>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Morning</Text>
              <Text style={styles.cardBody}>{preview?.morning}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Evening</Text>
              <Text style={styles.cardBody}>{preview?.evening}</Text>
            </View>
            <View style={[styles.card, styles.alertCard]}>
              <Text style={styles.alertTag}>Stop & reassess if</Text>
              <Text style={styles.cardBody}>{preview?.stop_if}</Text>
            </View>
            <Text style={styles.honesty} testID="plan-preview-honesty">
              {preview?.honesty}
            </Text>
          </ScrollView>
          <View style={styles.footer}>
            <Pressable
              style={styles.cta}
              testID="plan-preview-use"
              onPress={() => router.push(SIGN_IN_HREF)}>
              <Text style={styles.ctaLabel}>{preview?.cta_use || 'Use this plan'}</Text>
            </Pressable>
            <Pressable
              testID="plan-preview-skip"
              onPress={() => router.push(SIGN_IN_HREF)}
              style={styles.skip}>
              <Text style={styles.skipLabel}>{preview?.cta_skip || 'Skip for now'}</Text>
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white, paddingHorizontal: 18 },
  content: { paddingTop: 8, paddingBottom: 24, gap: 12 },
  eyebrow: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 10,
    letterSpacing: 0.7,
    color: V4DesignTokens.color.redDeep,
  },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 21,
    color: V4DesignTokens.color.black,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V4DesignTokens.color.line,
    padding: 14,
  },
  alertCard: { backgroundColor: '#FFF8F5' },
  alertTag: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 12,
    color: V4DesignTokens.color.red,
    marginBottom: 6,
  },
  cardTitle: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 13,
    color: V4DesignTokens.color.black,
    marginBottom: 6,
  },
  cardBody: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    lineHeight: 20,
    color: V4DesignTokens.color.muted,
  },
  honesty: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    lineHeight: 18,
    color: V4DesignTokens.color.muted,
  },
  footer: { paddingBottom: 16, gap: 10 },
  cta: {
    backgroundColor: V4DesignTokens.color.black,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.white,
  },
  skip: { alignItems: 'center', paddingVertical: 8 },
  skipLabel: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
  },
  error: { color: V4DesignTokens.color.red },
  gapTitle: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 20,
    marginTop: 24,
    color: V4DesignTokens.color.black,
  },
  gapBody: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    marginTop: 12,
  },
});
