/**
 * TOUCH-017 — Screen 4 allergen qualifier.
 */
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppTokens } from '@/constants/appTokens';
import { TRY_REVEAL_HREF, TRY_VERDICT_HREF } from '@/constants/routes';
import { publicEvaluateProducts } from '@/lib/conflict-api';
import {
  getPendingTryProduct,
  setPendingAllergens,
  type PendingAllergen,
} from '@/lib/try-verdict-session';
import { setTryRevealPayload } from '@/lib/try-reveal-store';

const PRESETS: PendingAllergen[] = [
  { allergen_class: 'acrylates', label: 'acrylates' },
  { allergen_class: 'fragrance', label: 'fragrance' },
  { allergen_class: 'essential_oils', label: 'essential oils' },
  { allergen_class: 'alcohol', label: 'alcohol' },
];

export default function TryAllergensScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<PendingAllergen[]>([]);
  const [freeform, setFreeform] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (item: PendingAllergen) => {
    setSelected((prev) => {
      const hit = prev.some((p) => p.allergen_class === item.allergen_class);
      return hit ? prev.filter((p) => p.allergen_class !== item.allergen_class) : [...prev, item];
    });
  };

  const addFreeform = () => {
    const label = freeform.trim();
    if (!label) return;
    // TOUCH-055 — map freeform phrases to evaluate class IDs (server also normalizes).
    const lower = label.toLowerCase();
    let allergen_class = lower.replace(/\s+/g, '_').slice(0, 64);
    if (/acrylat/.test(lower)) allergen_class = 'acrylates';
    else if (/fragrance|parfum|perfume/.test(lower)) allergen_class = 'fragrance';
    else if (/essential\s*oil/.test(lower)) allergen_class = 'essential_oils';
    else if (/\balcohol\b|ethanol/.test(lower)) allergen_class = 'alcohol';
    if (!selected.some((s) => s.allergen_class === allergen_class)) {
      setSelected((prev) => [...prev, { allergen_class, label }]);
    }
    setFreeform('');
    setAdding(false);
  };

  const runEvaluateAndContinue = async (allergens: PendingAllergen[]) => {
    setBusy(true);
    setError(null);
    try {
      await setPendingAllergens(allergens);
      const product = await getPendingTryProduct();
      const products = [
        {
          product_name: product?.product_name || product?.query || 'Unknown product',
          barcode: product?.barcode,
          ingredients_text: product?.ingredients_text,
        },
      ];
      // TOUCH-016/054 — public evaluate with allergen classes for hard_no.
      const verdict = await publicEvaluateProducts(products, undefined, allergens);
      await setTryRevealPayload({
        product: products[0],
        allergens,
        verdict,
      });
      router.replace(TRY_REVEAL_HREF);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not get a verdict');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.inner}>
        <Pressable onPress={() => router.replace(TRY_VERDICT_HREF)} accessibilityRole="button">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Rule anything out?</Text>

        <View style={styles.chips}>
          {PRESETS.map((p) => {
            const on = selected.some((s) => s.allergen_class === p.allergen_class);
            return (
              <Pressable
                key={p.allergen_class}
                onPress={() => toggle(p)}
                style={[styles.chip, on ? styles.chipOn : null]}
                testID={`allergen-chip-${p.allergen_class}`}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}>
                <Text style={[styles.chipText, on ? styles.chipTextOn : null]}>{p.label}</Text>
              </Pressable>
            );
          })}
          {selected
            .filter((s) => !PRESETS.some((p) => p.allergen_class === s.allergen_class))
            .map((s) => (
              <Pressable
                key={s.allergen_class}
                onPress={() => toggle(s)}
                style={[styles.chip, styles.chipOn]}
                accessibilityRole="button">
                <Text style={[styles.chipText, styles.chipTextOn]}>{s.label}</Text>
              </Pressable>
            ))}
          <Pressable
            style={styles.chip}
            onPress={() => setAdding(true)}
            testID="allergen-add"
            accessibilityRole="button"
            accessibilityLabel="Add freeform allergen">
            <Text style={styles.chipText}>+ add</Text>
          </Pressable>
        </View>

        {adding ? (
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              placeholder="e.g. niacinamide"
              placeholderTextColor={AppTokens.color.muted}
              value={freeform}
              onChangeText={setFreeform}
              autoFocus
              testID="allergen-freeform"
            />
            <Pressable style={styles.addBtn} onPress={addFreeform}>
              <Text style={styles.addBtnText}>Add</Text>
            </Pressable>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.spacer} />

        <Pressable
          style={styles.cta}
          disabled={busy}
          onPress={() => void runEvaluateAndContinue(selected)}
          testID="allergen-continue"
          accessibilityRole="button">
          <Text style={styles.ctaText}>{busy ? 'Checking…' : 'Continue'}</Text>
        </Pressable>
        <Pressable
          style={styles.skip}
          disabled={busy}
          onPress={() => void runEvaluateAndContinue([])}
          testID="allergen-skip"
          accessibilityRole="button">
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  inner: { flex: 1, padding: AppTokens.spacing.lg, gap: 12 },
  back: { fontFamily: AppTokens.font.body, color: AppTokens.color.muted, fontSize: 14 },
  title: {
    fontFamily: AppTokens.font.display,
    fontSize: 28,
    color: AppTokens.color.ink,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppTokens.color.line,
    borderRadius: AppTokens.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: {
    backgroundColor: AppTokens.color.hardNo,
    borderColor: AppTokens.color.hardNo,
  },
  chipText: { fontFamily: AppTokens.font.body, fontSize: 13, color: AppTokens.color.ink },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppTokens.color.line,
    borderRadius: AppTokens.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: AppTokens.font.body,
    color: AppTokens.color.ink,
  },
  addBtn: {
    backgroundColor: AppTokens.color.fabBg,
    borderRadius: AppTokens.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addBtnText: { color: '#fff', fontWeight: '600' },
  error: { color: AppTokens.color.danger, fontFamily: AppTokens.font.body },
  spacer: { flex: 1 },
  cta: {
    backgroundColor: AppTokens.color.fabBg,
    borderRadius: AppTokens.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  skip: { alignItems: 'center', paddingVertical: 10 },
  skipText: { color: AppTokens.color.muted, fontFamily: AppTokens.font.body, fontSize: 15 },
});
