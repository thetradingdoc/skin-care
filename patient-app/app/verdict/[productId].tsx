import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CompatibilityScoreCard,
  ConflictCard,
  ContraindicationCard,
  EvidenceSnippetCard,
  GraphUnavailableBanner,
  ProductInsightCard,
  SpacingTimer,
  SuggestedFixCard,
  VerdictActions,
} from '@/components/conflict';
import { ShelfItemActions } from '@/components/shelf/ShelfItemActions';
import { useToast } from '@/components/billing-feedback';
import { AppTokens } from '@/constants/appTokens';
import { JournalTokens } from '@/constants/journalTokens';
import { SCAN_HREF, SHOP_HREF } from '@/constants/routes';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import {
  fetchEvaluatePair,
  fetchProductInsight,
  patchShelfProduct,
  shelfVerdictAction,
} from '@/lib/conflict-api';
import type { EvaluateResult, ProductInsight } from '@/lib/conflict-types';
import { patientGet } from '@/lib/patient-api';
import { shelfItemCommerceKind } from '@/lib/shelf-commerce-cta';

type ShelfRowLite = {
  id?: string;
  product_name?: string;
  category?: string;
  is_prescription?: boolean;
  price_usd?: number | null;
  expiry_date?: string | null;
  cost_per_use?: number | null;
};

export default function VerdictScreen() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const { showToast } = useToast();
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [evaluate, setEvaluate] = useState<EvaluateResult | null>(null);
  const [productInsight, setProductInsight] = useState<ProductInsight | null>(null);
  const [costPerUse, setCostPerUse] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [shelfBusy, setShelfBusy] = useState(false);
  const [shelfRow, setShelfRow] = useState<ShelfRowLite | null>(null);
  const scoreCardRef = useRef<View>(null);

  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const res = await fetchEvaluatePair(String(productId));
      setEvaluate(res);
      try {
        const shelf = await patientGet('/api/patient/shelf/products');
        const row = (Array.isArray(shelf?.products) ? shelf.products : []).find(
          (p: { id?: string }) => String(p.id) === String(productId),
        ) as ShelfRowLite | undefined;
        if (row) {
          setShelfRow(row);
          if (row.cost_per_use != null) setCostPerUse(String(row.cost_per_use));
          if (row.expiry_date) setExpiryDate(String(row.expiry_date));
        } else {
          setShelfRow(null);
        }
      } catch {
        setShelfRow(null);
      }
      try {
        const insightRes = await fetchProductInsight(String(productId));
        if (insightRes.featureEnabled && !insightRes.insight) {
          showToast('Personalized insight is not available right now.', 'error');
        }
        setProductInsight(insightRes.insight);
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : 'Could not load product insight', 'error');
        setProductInsight(null);
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not load verdict', 'error');
    } finally {
      setLoading(false);
    }
  }, [productId, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxSpacing = useMemo(() => {
    const hours = (evaluate?.conflicts || [])
      .map((c) => Number(c.spacing_hours) || 0)
      .filter((h) => h > 0);
    return hours.length ? Math.max(...hours) : 0;
  }, [evaluate]);

  const productName = useMemo(() => {
    const hit = evaluate?.product_statuses?.find((p) => p.shelf_product_id === productId);
    return hit?.product_name || 'This product';
  }, [evaluate, productId]);

  const onAction = async (action: 'remove' | 'keep') => {
    if (!productId) return;
    setBusy(true);
    try {
      await shelfVerdictAction(String(productId), action);
      showToast(action === 'remove' ? "Don't use — removed" : 'Kept on shelf', 'success');
      router.replace(SCAN_HREF);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveShelfFields = async () => {
    if (!productId) return;
    setShelfBusy(true);
    try {
      const patch: { cost_per_use?: number | null; expiry_date?: string | null } = {};
      if (costPerUse.trim() === '') patch.cost_per_use = null;
      else {
        const n = Number(costPerUse);
        if (!Number.isFinite(n) || n < 0) throw new Error('Cost per use must be a number');
        patch.cost_per_use = n;
      }
      if (expiryDate.trim() === '') patch.expiry_date = null;
      else {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate.trim())) {
          throw new Error('Expiry must be YYYY-MM-DD');
        }
        patch.expiry_date = expiryDate.trim();
      }
      await patchShelfProduct(String(productId), patch);
      showToast('Shelf details saved', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not save', 'error');
    } finally {
      setShelfBusy(false);
    }
  };

  const shareVerdict = async () => {
    if (!evaluate) return;
    const msg = `${productName}: ${evaluate.compatibility_score}/100 compatibility — ${evaluate.hero_subtitle || evaluate.overall}`;
    try {
      if (Platform.OS !== 'web' && scoreCardRef.current) {
        const { captureRef } = await import('react-native-view-shot');
        const uri = await captureRef(scoreCardRef, { format: 'png', quality: 0.9 });
        await Share.share({ url: uri, message: msg });
        return;
      }
      await Share.share({ message: msg });
    } catch {
      try {
        await Share.share({ message: msg });
      } catch {
        /* user dismissed */
      }
    }
  };

  if (checking || !ready || loading) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={JournalTokens.color.accent} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  const overall = evaluate?.overall || 'unknown';
  const score = evaluate?.compatibility_score ?? 0;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ title: 'Verdict', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroRow}>
          <Text style={styles.productName}>{productName}</Text>
          <Pressable onPress={() => void shareVerdict()} accessibilityLabel="Share verdict">
            <Text style={styles.share}>Share</Text>
          </Pressable>
        </View>

        {evaluate?.graph_unavailable ? (
          <GraphUnavailableBanner onRetry={() => void load()} />
        ) : null}

        <View ref={scoreCardRef} collapsable={false}>
          <CompatibilityScoreCard
            score={score}
            overall={overall}
            title={evaluate?.hero_title || (overall === 'safe' ? 'Looks compatible' : 'Compatibility concern')}
            subtitle={evaluate?.hero_subtitle || evaluate?.suggested_fix?.message}
          />
        </View>

        {productInsight ? <ProductInsightCard insight={productInsight} /> : null}

        {maxSpacing > 0 ? <SpacingTimer spacingHours={maxSpacing} /> : null}

        {(evaluate?.conflicts || []).length ? (
          <>
            <Text style={styles.section}>Why flagged</Text>
            {evaluate!.conflicts.map((c, i) => (
              <ConflictCard key={`${c.ingredient_a}-${c.ingredient_b}-${i}`} conflict={c} />
            ))}
          </>
        ) : null}

        {(evaluate?.evidence_snippets || []).length ? (
          <>
            <Text style={styles.section}>Evidence</Text>
            {evaluate!.evidence_snippets!.map((snippet, i) => (
              <EvidenceSnippetCard key={snippet.id || `ev-${i}`} title={snippet.title} body={snippet.body} />
            ))}
          </>
        ) : null}

        {(evaluate?.contraindication_alerts || []).length ? (
          <>
            <Text style={styles.section}>Profile alerts</Text>
            {evaluate!.contraindication_alerts!.map((a, i) => (
              <ContraindicationCard key={`${a.title}-${i}`} alert={a} />
            ))}
          </>
        ) : null}

        {evaluate?.suggested_fix || evaluate?.suggested_split ? (
          <>
            <Text style={styles.section}>The fix</Text>
            <SuggestedFixCard
              title={evaluate.suggested_fix?.title}
              message={evaluate.suggested_fix?.message}
              suggestedSplit={evaluate.suggested_split || evaluate.suggested_fix?.suggested_split}
            />
          </>
        ) : null}

        <Text style={styles.section}>Shelf details</Text>
        <View style={styles.shelfFields} testID="shelf-inventory-fields">
          <Text style={styles.fieldLabel}>Cost per use (USD)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={costPerUse}
            onChangeText={setCostPerUse}
            placeholder="e.g. 0.45"
            testID="shelf-cost-per-use"
          />
          <Text style={styles.fieldLabel}>Expiry (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={expiryDate}
            onChangeText={setExpiryDate}
            placeholder="2027-01-15"
            testID="shelf-expiry-date"
          />
          <Pressable
            style={styles.saveShelf}
            disabled={shelfBusy}
            onPress={() => void saveShelfFields()}
            testID="shelf-save-fields">
            <Text style={styles.saveShelfText}>{shelfBusy ? 'Saving…' : 'Save shelf fields'}</Text>
          </Pressable>
        </View>

        {shelfRow ? (
          <>
            <Text style={styles.section}>Buy / refill</Text>
            <View testID="verdict-commerce-cta">
              <ShelfItemActions
                kind={shelfItemCommerceKind({
                  is_prescription: shelfRow.is_prescription,
                  category: shelfRow.category,
                })}
                name={String(shelfRow.product_name || productName)}
                is_prescription={shelfRow.is_prescription === true}
                category={shelfRow.category}
                priceLabel={
                  shelfRow.price_usd != null && Number.isFinite(Number(shelfRow.price_usd))
                    ? `$${Number(shelfRow.price_usd).toFixed(2)}`
                    : undefined
                }
                expires={shelfRow.expiry_date ? String(shelfRow.expiry_date) : undefined}
                onBuy={() => router.push(SHOP_HREF)}
              />
            </View>
          </>
        ) : null}

        <VerdictActions onRemove={() => void onAction('remove')} onKeep={() => void onAction('keep')} busy={busy} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  content: { padding: JournalTokens.spacing.lg, gap: 4, paddingBottom: 40 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  productName: { fontSize: 20, fontWeight: '700', flex: 1 },
  share: { color: JournalTokens.color.accent, fontWeight: '600' },
  section: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginTop: 16, marginBottom: 8 },
  shelfFields: { gap: 8, marginBottom: 8 },
  fieldLabel: { fontSize: 12, color: AppTokens.color.muted, fontFamily: AppTokens.font.body },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppTokens.color.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: AppTokens.font.body,
  },
  saveShelf: {
    alignSelf: 'flex-start',
    backgroundColor: AppTokens.color.cream,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  saveShelfText: { fontWeight: '600', color: AppTokens.color.ink },
});
