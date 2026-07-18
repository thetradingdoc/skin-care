/**
 * P7.08 / P7.46 / P8.07 — Shelf Buy vs Rx + Ask/Learn LLM depth.
 * Buy vs never-Buy is driven by shelf-commerce-cta SSOT from real item fields.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppTokens } from '@/constants/appTokens';
import { RX_REFILL_INFO_HREF } from '@/constants/routes';
import { patientPost } from '@/lib/patient-api';
import {
  SHELF_RX_NEVER_BUY,
  canShowBuyCta,
  isPrescriptionShelfItem,
  shelfItemCommerceKind,
  type ShelfCommerceKind,
} from '@/lib/shelf-commerce-cta';

export type ShelfItemKind = ShelfCommerceKind;

type Props = {
  /** @deprecated Prefer is_prescription + category from GET /shelf/products */
  kind?: ShelfItemKind;
  name: string;
  priceLabel?: string;
  expires?: string;
  is_prescription?: boolean;
  category?: string;
  onBuy?: () => void;
};

export { SHELF_RX_NEVER_BUY };

export function ShelfItemActions({
  kind,
  name,
  priceLabel,
  expires,
  is_prescription,
  category,
  onBuy,
}: Props) {
  const router = useRouter();
  const item = { kind, is_prescription, category };
  const isRx = isPrescriptionShelfItem(item);
  const resolvedKind = shelfItemCommerceKind(item);
  const showBuy = canShowBuyCta(item);
  const [askReply, setAskReply] = useState<string | null>(null);
  const [learnReply, setLearnReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runAskLearn = async (mode: 'ask' | 'learn') => {
    setBusy(true);
    try {
      const res = await patientPost('/api/patient/shelf/ask-learn', {
        kind: mode,
        product_name: name,
        question: mode === 'ask' ? `Is ${name} okay with my routine?` : '',
      });
      const text = String(res?.ai_suggestion?.text || '');
      if (mode === 'ask') setAskReply(text);
      else setLearnReply(text);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'unavailable';
      if (mode === 'ask') setAskReply(msg);
      else setLearnReply(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap} testID={`shelf-item-actions-${resolvedKind}`}>
      <Text style={styles.name}>{name}</Text>
      {isRx && expires ? <Text style={styles.meta}>expires {expires}</Text> : null}

      <Pressable
        testID="shelf-ask-action"
        style={styles.ghost}
        disabled={busy}
        onPress={() => void runAskLearn('ask')}>
        <Text style={styles.ghostLabel}>ask a question about this</Text>
      </Pressable>
      {askReply ? (
        <Text style={styles.reply} testID="shelf-ask-reply">
          {askReply}
        </Text>
      ) : null}
      <Pressable
        testID="shelf-learn-action"
        style={styles.ghost}
        disabled={busy}
        onPress={() => void runAskLearn('learn')}>
        <Text style={styles.ghostLabel}>
          {isRx ? 'ask a question about this' : 'learn about this ingredient'}
        </Text>
      </Pressable>
      {learnReply ? (
        <Text style={styles.reply} testID="shelf-learn-reply">
          {learnReply}
        </Text>
      ) : null}

      {isRx || !showBuy ? (
        <>
          {isRx ? (
            <>
              <Pressable
                testID="shelf-rx-refill-cta"
                style={styles.secondary}
                onPress={() =>
                  router.push({
                    pathname: RX_REFILL_INFO_HREF,
                    params: { drug: name, expires: expires || '' },
                  } as never)
                }>
                <Text style={styles.secondaryLabel}>refill info — contact your prescriber</Text>
              </Pressable>
              <Text style={styles.never} testID="shelf-rx-never-buy">
                {SHELF_RX_NEVER_BUY}
              </Text>
            </>
          ) : null}
        </>
      ) : !(priceLabel && String(priceLabel).trim()) ? (
        <Text style={styles.priceUnavailable} testID="shelf-buy-price-unavailable">
          Price unavailable — buy hidden until a real price loads.
        </Text>
      ) : (
        <Pressable testID="shelf-skincare-buy" style={styles.buy} onPress={onBuy}>
          <Text style={styles.buyLabel}>buy · {String(priceLabel).trim()}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, paddingVertical: 8 },
  name: { fontSize: 17, fontWeight: '600', color: AppTokens.color.ink },
  meta: { fontSize: 13, color: AppTokens.color.muted },
  ghost: { paddingVertical: 6 },
  ghostLabel: { color: AppTokens.color.muted, fontSize: 14 },
  reply: { fontSize: 13, color: AppTokens.color.ink, lineHeight: 18 },
  secondary: { paddingVertical: 10 },
  secondaryLabel: { color: AppTokens.color.fabBg, fontWeight: '600' },
  never: {
    fontSize: 13,
    color: AppTokens.color.cardRedText,
    backgroundColor: AppTokens.color.cardRed,
    padding: 10,
    borderRadius: 8,
  },
  buy: {
    backgroundColor: AppTokens.color.fabBg,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buyLabel: { color: '#fff', fontWeight: '600' },
  priceUnavailable: {
    fontSize: 13,
    color: AppTokens.color.muted,
    paddingVertical: 8,
  },
});
