/**
 * TOUCH-019–023 + TOUCH-104 — Reveal Safe / Caution / Hard-no + acrylate-free as distinct second badge.
 */
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppTokens } from '@/constants/appTokens';
import { COMMERCE_CTAS_LOCAL_OVERRIDE } from '@/constants/feature-flags';
import { CHECKOUT_HANDOFF_HREF, SHOP_HREF, SIGN_IN_HREF, TRY_VERDICT_HREF } from '@/constants/routes';
import { getTryRevealPayload, type TryRevealPayload } from '@/lib/try-reveal-store';
import { patientGet } from '@/lib/patient-api';

type PrimaryKind = 'safe' | 'caution' | 'hard_no';

function mapPrimary(verdict: Record<string, unknown>): PrimaryKind {
  const overall = String(verdict.overall || '').toLowerCase();
  if (overall === 'hard_no' || verdict.hard_no === true) return 'hard_no';
  if (overall === 'avoid') return 'hard_no';
  if (overall === 'caution') return 'caution';
  return 'safe';
}

/** TOUCH-104 — secondary badge; never replaces Safe / Caution / Hard-no. */
function showAcrylateFreeBadge(
  verdict: Record<string, unknown>,
  allergens: { allergen_class: string }[],
  primary: PrimaryKind,
): boolean {
  if (primary !== 'safe') return false;
  if (verdict.acrylate_free_verified !== true) return false;
  // Only when user cared about acrylates (or explicitly verified by engine with that intent).
  return allergens.some((a) => a.allergen_class === 'acrylates');
}

function plainLanguage(kind: PrimaryKind, verdict: Record<string, unknown>, productName: string): string {
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
  const router = useRouter();
  const [payload, setPayload] = useState<TryRevealPayload | null>(null);
  const [commerceOn, setCommerceOn] = useState(COMMERCE_CTAS_LOCAL_OVERRIDE);

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

  const kind = useMemo(() => (payload ? mapPrimary(payload.verdict) : 'safe'), [payload]);
  const acrylateFree = useMemo(
    () => (payload ? showAcrylateFreeBadge(payload.verdict, payload.allergens, kind) : false),
    [payload, kind],
  );
  const sources = useMemo(() => (payload ? sourceLines(payload.verdict) : []), [payload]);

  if (!payload) {
    return <SafeAreaView style={styles.root} />;
  }

  const bannerStyle =
    kind === 'hard_no' ? styles.bannerHardNo : kind === 'caution' ? styles.bannerCaution : styles.bannerSafe;
  const badgeLabel = kind === 'hard_no' ? 'Hard no' : kind === 'caution' ? 'Caution' : 'Safe';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={[styles.banner, bannerStyle]} testID={`reveal-banner-${kind}`}>
        <View style={styles.badgeRow}>
          <View
            style={[styles.badge, kind === 'hard_no' ? styles.badgeHardNo : kind === 'caution' ? styles.badgeCaution : styles.badgeSafe]}
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
              <Pressable
                onPress={() => router.push(CHECKOUT_HANDOFF_HREF)}
                testID="reveal-swap-buy"
                accessibilityRole="button">
                <Text style={styles.crossSellLink}>Swap / Buy →</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.crossSellMuted}>Suggestions when shopping connects</Text>
          )}
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
  /** Distinct from Safe — outlined chip, not the same green fill treatment. */
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
  cta: {
    marginTop: 'auto',
    backgroundColor: AppTokens.color.fabBg,
    borderRadius: AppTokens.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
