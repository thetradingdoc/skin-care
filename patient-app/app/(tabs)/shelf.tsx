/**
 * P7.32 / Phase C / Steps 26–27 — Shelf tab: inventory from GET /shelf/products only.
 * Buy vs Rx is driven by each row's real classification (is_prescription / category).
 * Empty ≠ load-failed — distinct components and testIDs.
 */
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShelfConflictHardNoSurface } from '@/components/shelf/ShelfConflictHardNoSurface';
import { ShelfItemActions } from '@/components/shelf/ShelfItemActions';
import { LoadFailedState } from '@/components/LoadFailedState';
import {
  RX_REFILL_INFO_HREF,
  SCAN_HREF,
  SHELF_ADD_HREF,
  SHOP_HREF,
  CAPTURE_2A_HREF,
  verdictHref,
} from '@/constants/routes';
import { MEMBER_DISCOUNT_CODE } from '@/constants/storeConfig';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { isConflictVerdictUiEnabled } from '@/lib/claim-safe-ui';
import { patientGet } from '@/lib/patient-api';
import {
  SHELF_EMPTY_BODY,
  SHELF_EMPTY_CTA,
  SHELF_EMPTY_TITLE,
  SPEND_SUMMARY_HONESTY,
} from '@/lib/phase5-ui-copy';
import { fetchShelfSpendSummary } from '@/lib/progress-aggregates-api';
import { shelfItemCommerceKind } from '@/lib/shelf-commerce-cta';

type ShelfRow = {
  id: string;
  product_name: string;
  usage_time?: string;
  category?: string;
  is_prescription?: boolean;
  price_usd?: number | null;
  expiry_date?: string | null;
  ingredients_text?: string | null;
  brand?: string | null;
};

function priceLabelFor(row: ShelfRow): string | undefined {
  if (row.price_usd == null || !Number.isFinite(Number(row.price_usd))) return undefined;
  return `$${Number(row.price_usd).toFixed(2)}`;
}

function formatExpires(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[Number(m[2]) - 1] || m[2];
  return `${month} ${Number(m[3])}, ${m[1]}`;
}

export default function ShelfScreen() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ShelfRow[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [spendTotal, setSpendTotal] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [shelf, spend] = await Promise.all([
        patientGet('/api/patient/shelf/products'),
        fetchShelfSpendSummary().catch(() => null),
      ]);
      setProducts(Array.isArray(shelf?.products) ? shelf.products : []);
      const total = spend?.total_price_usd;
      setSpendTotal(typeof total === 'number' && Number.isFinite(total) ? total : null);
    } catch {
      setProducts([]);
      setSpendTotal(null);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  if (checking || !ready) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator style={{ marginTop: 48 }} color={V4DesignTokens.color.red} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']} testID="shelf-screen">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void load()}
            tintColor={V4DesignTokens.color.red}
          />
        }>
        <Text style={styles.title} testID="shelf-title">
          Shelf
        </Text>
        <Text style={styles.subtitle} testID="shelf-tagline">
          What you&apos;re using — and what&apos;s in it.
        </Text>
        <Text style={styles.memberBanner} testID="shelf-member-banner">
          Member pricing unlocked at checkout — code {MEMBER_DISCOUNT_CODE}, 20% off.
        </Text>
        <Pressable
          style={styles.addLink}
          testID="shelf-add-entry"
          onPress={() => router.push(SHELF_ADD_HREF)}>
          <Text style={styles.addLinkText}>Add a product</Text>
        </Pressable>
        {spendTotal != null ? (
          <View style={styles.spendPill} testID="shelf-spend-summary">
            <Text style={styles.spendAmount}>${spendTotal.toFixed(2)}</Text>
            <Text style={styles.spendHonesty}>{SPEND_SUMMARY_HONESTY}</Text>
          </View>
        ) : null}

        {loadFailed && !loading ? (
          <LoadFailedState testID="shelf-load-failed" onRetry={() => void load()} />
        ) : products.length === 0 && !loading ? (
          <View style={styles.empty} testID="shelf-empty">
            <View style={styles.emptyRing}>
              <Text style={styles.emptyRingGlyph}>▢</Text>
            </View>
            <Text style={styles.emptyTitle} testID="shelf-empty-title">
              {SHELF_EMPTY_TITLE}
            </Text>
            <Text style={styles.emptyBody} testID="shelf-empty-body">
              {SHELF_EMPTY_BODY}
            </Text>
            <Pressable
              style={styles.cta}
              testID="shelf-scan-or-add"
              onPress={() => router.push(SHELF_ADD_HREF)}>
              <Text style={styles.ctaLabel}>{SHELF_EMPTY_CTA}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {isConflictVerdictUiEnabled() ? (
              <ShelfConflictHardNoSurface
                products={products}
                onPressProduct={(id) => router.push(verdictHref(id))}
              />
            ) : null}
            <View style={{ marginTop: 16 }} testID="shelf-inventory-actions">
              {products.map((row) => {
                const kind = shelfItemCommerceKind(row);
                return (
                  <View key={row.id} style={styles.card} testID={`shelf-row-${row.id}`}>
                    <ShelfItemActions
                      kind={kind}
                      name={row.product_name}
                      is_prescription={row.is_prescription === true}
                      category={row.category}
                      priceLabel={priceLabelFor(row)}
                      expires={formatExpires(row.expiry_date)}
                      ingredients_text={row.ingredients_text}
                      brand={row.brand}
                      onBuy={() => router.push(SHOP_HREF)}
                    />
                  </View>
                );
              })}
            </View>
          </>
        )}

        <Pressable style={styles.secondary} onPress={() => router.push(SCAN_HREF)}>
          <Text style={styles.secondaryLabel}>Scan barcode</Text>
        </Pressable>
        <Pressable
          style={styles.secondary}
          testID="shelf-rx-refill-info-link"
          onPress={() => router.push(RX_REFILL_INFO_HREF)}>
          <Text style={styles.secondaryLabel}>Refill info</Text>
        </Pressable>
        <Pressable
          style={styles.secondary}
          onPress={() =>
            router.push({ pathname: CAPTURE_2A_HREF, params: { entry: 'track' } } as never)
          }>
          <Text style={styles.secondaryLabel}>Log a prescription / product</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white },
  content: { padding: 16, paddingBottom: 100 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 22,
    color: V4DesignTokens.color.black,
  },
  subtitle: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    marginBottom: 8,
    marginTop: 4,
  },
  memberBanner: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    color: V4DesignTokens.color.muted,
    marginBottom: 8,
    lineHeight: 17,
  },
  addLink: { marginBottom: 12 },
  addLinkText: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 14,
    color: V4DesignTokens.color.red,
  },
  spendPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V4DesignTokens.color.line,
    marginBottom: 16,
    backgroundColor: V4DesignTokens.color.white,
  },
  spendAmount: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 18,
    color: V4DesignTokens.color.black,
  },
  spendHonesty: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
    flex: 1,
  },
  card: {
    borderWidth: 1,
    borderColor: V4DesignTokens.color.line,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: V4DesignTokens.color.white,
  },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: V4DesignTokens.color.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyRingGlyph: { fontSize: 18, color: V4DesignTokens.color.muted },
  emptyTitle: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 18,
    color: V4DesignTokens.color.black,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 15,
    color: V4DesignTokens.color.muted,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
    maxWidth: 280,
  },
  cta: {
    backgroundColor: V4DesignTokens.color.red,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    color: V4DesignTokens.color.white,
  },
  secondary: { marginTop: 16, alignItems: 'center' },
  secondaryLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    color: V4DesignTokens.color.redDeep,
    fontSize: 15,
  },
});
