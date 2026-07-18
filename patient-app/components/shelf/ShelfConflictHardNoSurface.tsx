/**
 * P7.32 — Shelf conflict / hard_no surface.
 * Badges come from server evaluate + unified alerts feed — no client allergen aggregation.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ShelfProductRow } from '@/components/conflict';
import { AppTokens } from '@/constants/appTokens';
import { settleAlertsFeed } from '@/lib/alerts-empty-policy';
import {
  SHELF_ALERTS_FEED_API,
  SHELF_EVALUATE_API,
} from '@/lib/alerts-shelf-apis';
import { fetchEvaluateLineup } from '@/lib/conflict-api';
import type { EvaluateResult, ProductStatus } from '@/lib/conflict-types';
import { patientGet } from '@/lib/patient-api';

export { SHELF_ALERTS_FEED_API, SHELF_EVALUATE_API };

type ShelfRow = { id: string; product_name: string; usage_time?: string };

type FeedAlert = {
  id: string;
  severity?: string;
  kind?: string;
  title?: string;
  message?: string;
  product_id?: string | null;
};

type Props = {
  products: ShelfRow[];
  onPressProduct?: (id: string) => void;
};

export function ShelfConflictHardNoSurface({ products, onPressProduct }: Props) {
  const [evaluate, setEvaluate] = useState<EvaluateResult | null>(null);
  const [feedHard, setFeedHard] = useState<FeedAlert[]>([]);

  const load = useCallback(async () => {
    const [evalRes, feed] = await Promise.all([
      fetchEvaluateLineup().catch(() => null),
      patientGet(SHELF_ALERTS_FEED_API).catch(() => null),
    ]);
    setEvaluate(evalRes);
    const settled = settleAlertsFeed<FeedAlert>(feed?.alerts ?? feed?.items);
    const hard = settled.alerts.filter(
      (a) => a.severity === 'hard_no' || a.kind === 'hard_no' || a.kind === 'conflict',
    );
    setFeedHard(hard);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const statusFor = (id: string): ProductStatus => {
    const hit = evaluate?.product_statuses?.find((p) => p.shelf_product_id === id);
    return {
      shelf_product_id: id,
      product_name: hit?.product_name,
      status: (hit?.status as ProductStatus['status']) || 'unknown',
      usage_time: hit?.usage_time,
      note: hit?.note,
    };
  };

  const hardCount = products.filter((p) => {
    const s = statusFor(p.id).status;
    return s === 'hard_no' || s === 'conflict';
  }).length;

  return (
    <View style={styles.wrap} testID="shelf-conflict-hard-no-surface">
      {feedHard.length > 0 ? (
        <View style={styles.banner} testID="shelf-hard-no-banner">
          <Text style={styles.bannerTitle}>
            {feedHard.length} conflict{feedHard.length === 1 ? '' : 's'} / hard-no
          </Text>
          {feedHard.slice(0, 3).map((a) => (
            <Text key={a.id} style={styles.bannerLine} testID={`shelf-feed-alert-${a.id}`}>
              {a.title || a.message || a.kind}
            </Text>
          ))}
        </View>
      ) : null}

      <Text style={styles.meta} testID="shelf-hard-no-count">
        {hardCount} product{hardCount === 1 ? '' : 's'} flagged hard_no/conflict via evaluate
      </Text>

      {products.map((p) => {
        const st = statusFor(p.id);
        return (
          <View
            key={p.id}
            testID={
              st.status === 'hard_no' || st.status === 'conflict'
                ? `shelf-row-hard-${p.id}`
                : `shelf-row-${p.id}`
            }>
            <ShelfProductRow
              shelf_product_id={p.id}
              product_name={p.product_name || st.product_name}
              usage_time={p.usage_time || st.usage_time}
              status={st.status}
              note={st.note}
              onPress={onPressProduct ? () => onPressProduct(p.id) : undefined}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  banner: {
    backgroundColor: AppTokens.color.cardRed,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  bannerTitle: { fontWeight: '700', color: AppTokens.color.cardRedText, marginBottom: 4 },
  bannerLine: { fontSize: 13, color: AppTokens.color.cardRedText },
  meta: { fontSize: 12, color: AppTokens.color.muted, marginBottom: 4 },
});
