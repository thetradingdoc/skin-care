/**
 * P7.08 / P7.46 / P8.07 — Shelf Buy vs Rx + Ask/Learn LLM depth.
 * Buy vs never-Buy is driven by shelf-commerce-cta SSOT from real item fields.
 * Rx must never render shelf-skincare-buy — shared component suppresses purchase for Rx.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { RX_REFILL_INFO_HREF } from '@/constants/routes';
import { patientPost } from '@/lib/patient-api';
import {
  SHELF_RX_BADGE,
  SHELF_RX_REFILL_CTA,
} from '@/lib/phase5-ui-copy';
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
  brand?: string | null;
  /** Phase 5 — display-only ingredient list (no scores / allergen verdict). */
  ingredients_text?: string | null;
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
  brand,
  ingredients_text,
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
  const [ingredientsOpen, setIngredientsOpen] = useState(Boolean(String(ingredients_text || '').trim()));
  const ingredients = String(ingredients_text || '').trim();
  const brandLine = String(brand || '').trim();

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
    <View
      style={styles.wrap}
      testID={isRx ? 'shelf-item-actions-prescription' : `shelf-item-actions-${resolvedKind}`}>
      <Text style={styles.name} testID="shelf-item-name">
        {name}
      </Text>
      {brandLine ? (
        <Text style={styles.meta} testID="shelf-item-brand">
          {brandLine}
        </Text>
      ) : null}
      {isRx && expires ? <Text style={styles.meta}>expires {expires}</Text> : null}
      {!isRx && priceLabel ? <Text style={styles.meta}>{priceLabel}</Text> : null}

      {isRx ? (
        <Text style={styles.rxBadge} testID="shelf-rx-badge">
          {SHELF_RX_BADGE}
        </Text>
      ) : null}

      {ingredients ? (
        <View style={styles.ingredients} testID="shelf-ingredients-panel">
          <Text style={styles.ingrK}>INGREDIENTS (FROM CATALOG)</Text>
          <Pressable
            testID="shelf-ingredients-toggle"
            accessibilityRole="button"
            accessibilityLabel={ingredientsOpen ? 'Hide ingredients' : 'Show ingredients'}
            onPress={() => setIngredientsOpen((v) => !v)}
            style={styles.ghost}>
            <Text style={styles.ghostLabel}>{ingredientsOpen ? 'Hide' : 'Show'} ingredients</Text>
          </Pressable>
          {ingredientsOpen ? (
            <Text style={styles.ingredientsBody} testID="shelf-ingredients-text">
              {ingredients}
            </Text>
          ) : null}
        </View>
      ) : null}

      {!isRx ? (
        <>
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
            <Text style={styles.ghostLabel}>learn about this ingredient</Text>
          </Pressable>
          {learnReply ? (
            <Text style={styles.reply} testID="shelf-learn-reply">
              {learnReply}
            </Text>
          ) : null}
        </>
      ) : null}

      {isRx || !showBuy ? (
        <>
          {isRx ? (
            <>
              <Pressable
                testID="shelf-rx-refill-cta"
                style={styles.refill}
                onPress={() =>
                  router.push({
                    pathname: RX_REFILL_INFO_HREF,
                    params: { drug: name, expires: expires || '' },
                  } as never)
                }
                accessibilityRole="button"
                accessibilityLabel={SHELF_RX_REFILL_CTA}>
                <Text style={styles.refillLabel}>{SHELF_RX_REFILL_CTA}</Text>
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
  wrap: { gap: 8 },
  name: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 17,
    color: V4DesignTokens.color.black,
  },
  meta: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
  },
  rxBadge: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: V4DesignTokens.color.redDeep,
    marginTop: 4,
  },
  ghost: { paddingVertical: 6 },
  ghostLabel: {
    fontFamily: V4DesignTokens.font.body,
    color: V4DesignTokens.color.muted,
    fontSize: 14,
  },
  reply: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.black,
    lineHeight: 18,
  },
  refill: {
    backgroundColor: V4DesignTokens.color.black,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  refillLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    color: V4DesignTokens.color.white,
    fontSize: 16,
  },
  never: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.redDeep,
    backgroundColor: '#FCEBEB',
    padding: 10,
    borderRadius: 8,
  },
  buy: {
    backgroundColor: V4DesignTokens.color.red,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buyLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    color: V4DesignTokens.color.white,
  },
  priceUnavailable: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
    paddingVertical: 8,
  },
  ingredients: { gap: 4, marginTop: 4 },
  ingrK: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: V4DesignTokens.color.muted,
  },
  ingredientsBody: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.black,
    lineHeight: 19,
    paddingVertical: 6,
  },
});
