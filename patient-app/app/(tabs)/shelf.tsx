/**
 * P7.32 / Phase C — Shelf tab: inventory from GET /shelf/products only.
 * Buy vs Rx is driven by each row's real classification (is_prescription / category).
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
import { AppTokens } from '@/constants/appTokens';
import {
  RX_REFILL_INFO_HREF,
  SCAN_HREF,
  SHOP_HREF,
  TRACK_CAPTURE_HREF,
  verdictHref,
} from '@/constants/routes';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { patientGet } from '@/lib/patient-api';
import { shelfItemCommerceKind } from '@/lib/shelf-commerce-cta';

type ShelfRow = {
  id: string;
  product_name: string;
  usage_time?: string;
  category?: string;
  is_prescription?: boolean;
  price_usd?: number | null;
  expiry_date?: string | null;
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const shelf = await patientGet('/api/patient/shelf/products');
      setProducts(Array.isArray(shelf?.products) ? shelf.products : []);
    } catch {
      setProducts([]);
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
        <ActivityIndicator style={{ marginTop: 48 }} color={AppTokens.color.fabBg} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']} testID="shelf-screen">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
        <Text style={styles.title}>Shelf</Text>
        <Text style={styles.subtitle}>products & meds — inventory, not a storefront</Text>

        {products.length === 0 && !loading ? (
          <View style={styles.empty} testID="shelf-empty">
            <Text style={styles.emptyTitle}>Nothing on your shelf yet</Text>
            <Text style={styles.emptyBody}>scan a barcode or add one to get a safety check</Text>
            <Pressable
              style={styles.cta}
              testID="shelf-scan-or-add"
              onPress={() => router.push(SCAN_HREF)}>
              <Text style={styles.ctaLabel}>scan or add</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ShelfConflictHardNoSurface
              products={products}
              onPressProduct={(id) => router.push(verdictHref(id))}
            />
            <View style={{ marginTop: 16 }} testID="shelf-inventory-actions">
              {products.map((row) => {
                const kind = shelfItemCommerceKind(row);
                return (
                  <View key={row.id} testID={`shelf-row-${row.id}`}>
                    <ShelfItemActions
                      kind={kind}
                      name={row.product_name}
                      is_prescription={row.is_prescription === true}
                      category={row.category}
                      priceLabel={priceLabelFor(row)}
                      expires={formatExpires(row.expiry_date)}
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
          <Text style={styles.secondaryLabel}>refill info — contact your prescriber</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => router.push(TRACK_CAPTURE_HREF)}>
          <Text style={styles.secondaryLabel}>Log a prescription / product</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  content: { padding: 16, paddingBottom: 100 },
  title: { fontSize: 22, fontWeight: '700', color: AppTokens.color.ink },
  subtitle: { fontSize: 14, color: AppTokens.color.muted, marginBottom: 16, marginTop: 4 },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 8 },
  emptyBody: {
    fontSize: 15,
    color: AppTokens.color.muted,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  cta: {
    backgroundColor: AppTokens.color.fabBg,
    borderRadius: AppTokens.radius.md,
    minHeight: AppTokens.minTap,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: { color: '#fff', fontWeight: '600' },
  secondary: { marginTop: 16, alignItems: 'center' },
  secondaryLabel: { color: AppTokens.color.fabBg, fontWeight: '600', fontSize: 15 },
});
