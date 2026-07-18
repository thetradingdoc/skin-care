/**
 * TOUCH-019–023 + TOUCH-104 — Reveal Safe / Caution / Hard-no + acrylate-free as distinct second badge.
 * Trust rule: evaluate failure / unknown overall must NEVER render as Safe.
 */
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppTokens } from '@/constants/appTokens';
import { COMMERCE_CTAS_LOCAL_OVERRIDE } from '@/constants/feature-flags';
import {
  SHOP_HREF,
  SIGN_IN_HREF,
  TRY_ALLERGENS_HREF,
  TRY_VERDICT_HREF,
  checkoutHandoffHref,
} from '@/constants/routes';
import { getTryRevealPayload, type TryRevealPayload } from '@/lib/try-reveal-store';
import { patientGet } from '@/lib/patient-api';
import { useTryFunnelNoIndex } from '@/lib/try-funnel-noindex';
import {
  TRY_REVEAL_BUY_BLOCKED,
  commerceIdsFromTryReveal,
  tryRevealCanCheckout,
} from '@/lib/try-reveal-commerce';

type PrimaryKind = 'safe' | 'caution' | 'hard_no' | 'error';

/**
 * Map API verdict → UI kind.
 * Default absent/invalid overall → error (never safe).
 */
export function mapPrimary(verdict: Record<string, unknown> | null | undefined): PrimaryKind {
  if (!verdict || typeof verdict !== 'object') return 'error';
  if (verdict.success === false) return 'error';
  if (verdict.error != null && String(verdict.error).length > 0 && verdict.overall == null) {
    return 'error';
  }

  const overall = String(verdict.overall ?? '').toLowerCase().trim();
  if (!overall || overall === 'unknown') return 'error';
  if (overall === 'hard_no' || verdict.hard_no === true) return 'hard_no';
  if (overall === 'avoid') return 'hard_no';
  if (overall === 'caution') return 'caution';
  if (overall === 'safe') return 'safe';
  return 'error';
}

/** TOUCH-104 — secondary badge; never replaces Safe / Caution / Hard-no. */
function showAcrylateFreeBadge(
  verdict: Record<string, unknown>,
  allergens: { allergen_class: string }[],
  primary: PrimaryKind,
): boolean {
  if (primary !== 'safe') return false;
  if (verdict.acrylate_free_verified !== true) return false;
  return allergens.some((a) => a.allergen_class === 'acrylates');
}

function plainLanguage(kind: PrimaryKind, verdict: Record<string, unknown>, productName: string): string {
  if (kind === 'error') {
    return String(
      verdict.message ||
        verdict.error ||
        'We couldn’t verify this product. Try again — we won’t guess a Safe result.',
    );
  }
  if (kind === 'hard_no') {
    return String(verdict.message || `Not a match for ${productName} with your exclusions.`);
  }
  if (kind === 'caution') {
    return String(verdict.message || `Use care with ${productName} — check the notes below.`);
  }
  return String(verdict.message || `${productName} looks compatible so far.`);
}

function sourceLines(verdict: Record<string, unknown>): string[] {
  const snippets = verdict.evidence_snippets;
  if (Array.isArray(snippets)) {
    return snippets
      .map((s) => {
        if (typeof s === 'string') return s;
        if (s && typeof s === 'object' && 'text' in s) return String((s as { text: unknown }).text);
        if (s && typeof s === 'object' && 'snippet' in s) return String((s as { snippet: unknown }).snippet);
        return '';
      })
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 3);
  }
  if (typeof verdict.message === 'string' && verdict.message.trim()) {
    return [verdict.message.trim()];
  }
  return [];
}

export default function TryRevealScreen() {
  useTryFunnelNoIndex();
  const router = useRouter();
  const [payload, setPayload] = useState<TryRevealPayload | null>(null);
  const [commerceOn, setCommerceOn] = useState(COMMERCE_CTAS_LOCAL_OVERRIDE);
  const [buyError, setBuyError] = useState<string | null>(null);

  useEffect(() => {
    void getTryRevealPayload().then((p) => {
      if (!p) {
        router.replace(TRY_VERDICT_HREF);
        return;
      }
      setPayload(p);
    });
    void patientGet('/api/patient/commerce/status')
      .then((s) => {
        if (s?.commerce_ctas_enabled) setCommerceOn(true);
      })
      .catch(() => undefined);
  }, [router]);

  const productName =
    payload?.product.product_name || payload?.product.query || payload?.product.barcode || 'This product';

  const commerceIds = useMemo(
    () =>
      commerceIdsFromTryReveal({
        product: payload?.product as unknown as Record<string, unknown>,
        verdict: payload?.verdict,
      }),
    [payload],
  );
  const canCheckout = tryRevealCanCheckout(commerceIds);

  const onSwapBuy = () => {
    setBuyError(null);
    if (!canCheckout) {
      setBuyError(TRY_REVEAL_BUY_BLOCKED);
      return;
    }
    router.push(
      checkoutHandoffHref({
        variantId: commerceIds.variantId,
        handle: commerceIds.handle,
        mode: commerceIds.variantId ? 'cart' : 'pdp',
      }),
    );
  };
  const kind = useMemo(() => (payload ? mapPrimary(payload.verdict) : 'error'), [payload]);
  const acrylateFree = useMemo(
    () => (payload ? showAcrylateFreeBadge(payload.verdict, payload.allergens, kind) : false),
    [payload, kind],
  );
  const sources = useMemo(() => (payload ? sourceLines(payload.verdict) : []), [payload]);

  if (!payload) {
    return <SafeAreaView style={styles.root} />;
  }

  if (kind === 'error') {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={[styles.banner, styles.bannerError]} testID="reveal-banner-error">
          <View style={[styles.badge, styles.badgeError]} testID="reveal-badge-error">
            <Text style={styles.badgeText}>Couldn’t verify</Text>
          </View>
          <Text style={styles.plain} testID="reveal-plain-language">
            {plainLanguage('error', payload.verdict, productName)}
          </Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.errorDetail} testID="reveal-error-detail">
            No Safe / Caution / Hard-no is shown until evaluate succeeds.
          </Text>
          <Pressable
            style={styles.cta}
            onPress={() => router.replace(TRY_ALLERGENS_HREF)}
            testID="reveal-retry"
            accessibilityRole="button">
            <Text style={styles.ctaText}>Try again</Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            onPress={() => router.replace(TRY_VERDICT_HREF)}
            testID="reveal-start-over"
            accessibilityRole="button">
            <Text style={styles.secondaryText}>Check a different product</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const bannerStyle =
    kind === 'hard_no' ? styles.bannerHardNo : kind === 'caution' ? styles.bannerCaution : styles.bannerSafe;
  const badgeLabel = kind === 'hard_no' ? 'Hard no' : kind === 'caution' ? 'Caution' : 'Safe';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={[styles.banner, bannerStyle]} testID={`reveal-banner-${kind}`}>
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.badge,
              kind === 'hard_no' ? styles.badgeHardNo : kind === 'caution' ? styles.badgeCaution : styles.badgeSafe,
            ]}
            testID={`reveal-badge-${kind}`}>
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
          {acrylateFree ? (
            <View style={[styles.badge, styles.badgeAcrylate]} testID="reveal-badge-acrylate_free">
              <Text style={styles.badgeAcrylateText}>Acrylate-free verified</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.plain} testID="reveal-plain-language">
          {plainLanguage(kind, payload.verdict, productName)}
        </Text>
        {acrylateFree ? (
          <Text style={styles.acrylateNote} testID="reveal-acrylate-note">
            Engine confirmed no acrylate class in this product.
          </Text>
        ) : null}
      </View>

      <View style={styles.body}>
        {sources.length > 0 ? (
          <View style={styles.sources} testID="reveal-sources">
            <Text style={styles.sourcesLabel}>Sources</Text>
            {sources.map((s, i) => (
              <Text key={`${i}-${s.slice(0, 24)}`} style={styles.sourceLine} testID="reveal-source-line">
                {s}
              </Text>
            ))}
          </View>
        ) : (
          <View style={styles.sources} testID="reveal-source-slot">
            <Text style={styles.sourcesLabel}>Sources</Text>
            <Text style={styles.sourceLineMuted}>Source line when evidence is available</Text>
          </View>
        )}

        <View style={styles.crossSell} testID="reveal-cross-sell">
          <Text style={styles.crossSellLabel}>Alternatives</Text>
          {commerceOn ? (
            <View style={styles.crossSellActions}>
              <Pressable
                onPress={() => router.push(SHOP_HREF)}
                testID="reveal-shop"
                accessibilityRole="button">
                <Text style={styles.crossSellLink}>Browse shop</Text>
              </Pressable>
              {canCheckout ? (
                <Pressable
                  onPress={onSwapBuy}
                  testID="reveal-swap-buy"
                  accessibilityRole="button">
                  <Text style={styles.crossSellLink}>Swap / Buy →</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={onSwapBuy}
                  testID="reveal-swap-buy-blocked"
                  accessibilityRole="button">
                  <Text style={styles.crossSellLinkMuted}>Swap / Buy unavailable</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <Text style={styles.crossSellMuted}>Suggestions when shopping connects</Text>
          )}
          {buyError ? (
            <Text style={styles.buyError} testID="reveal-buy-error">
              {buyError}
            </Text>
          ) : null}
        </View>

        <Pressable
          style={styles.cta}
          onPress={() => router.push(SIGN_IN_HREF)}
          testID="reveal-save-cta"
          accessibilityRole="button">
          <Text style={styles.ctaText}>Save & continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  banner: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24, gap: 12 },
  bannerSafe: { backgroundColor: AppTokens.color.safe },
  bannerCaution: { backgroundColor: AppTokens.color.terracotta },
  bannerHardNo: { backgroundColor: AppTokens.color.hardNo },
  bannerError: { backgroundColor: AppTokens.color.ink },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  badgeSafe: {},
  badgeCaution: {},
  badgeHardNo: {},
  badgeError: {},
  badgeAcrylate: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 12, letterSpacing: 0.3 },
  badgeAcrylateText: { color: '#fff', fontWeight: '700', fontSize: 11, letterSpacing: 0.2 },
  plain: { color: '#fff', fontFamily: AppTokens.font.display, fontSize: 22, lineHeight: 28 },
  acrylateNote: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: AppTokens.font.body,
    fontSize: 13,
  },
  body: { flex: 1, padding: 20, gap: 20 },
  errorDetail: {
    fontFamily: AppTokens.font.body,
    fontSize: 14,
    color: AppTokens.color.muted,
    lineHeight: 20,
  },
  sources: { gap: 6 },
  sourcesLabel: {
    fontFamily: AppTokens.font.body,
    fontSize: 12,
    color: AppTokens.color.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sourceLine: { fontFamily: AppTokens.font.body, fontSize: 14, color: AppTokens.color.ink },
  sourceLineMuted: { fontFamily: AppTokens.font.body, fontSize: 13, color: AppTokens.color.muted },
  crossSell: { gap: 4 },
  crossSellLabel: { fontFamily: AppTokens.font.body, fontWeight: '600', color: AppTokens.color.ink },
  crossSellMuted: { fontFamily: AppTokens.font.body, fontSize: 13, color: AppTokens.color.muted },
  crossSellActions: { flexDirection: 'row', gap: 16, marginTop: 4 },
  crossSellLink: {
    fontFamily: AppTokens.font.body,
    fontSize: 14,
    fontWeight: '600',
    color: AppTokens.color.fabBg,
    textDecorationLine: 'underline',
  },
  crossSellLinkMuted: {
    fontFamily: AppTokens.font.body,
    fontSize: 14,
    fontWeight: '600',
    color: AppTokens.color.muted,
  },
  buyError: {
    fontFamily: AppTokens.font.body,
    fontSize: 13,
    color: AppTokens.color.cardRedText,
    marginTop: 6,
  },
  cta: {
    marginTop: 'auto',
    backgroundColor: AppTokens.color.fabBg,
    borderRadius: AppTokens.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondary: { alignItems: 'center', paddingVertical: 10 },
  secondaryText: {
    fontFamily: AppTokens.font.body,
    fontSize: 14,
    color: AppTokens.color.muted,
    textDecorationLine: 'underline',
  },
});
