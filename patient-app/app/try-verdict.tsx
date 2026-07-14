/**
 * TOUCH-013 path + TOUCH-015 UI — anonymous "Check a product" entry.
 * Not the face-age funnel. Wired evaluate in TOUCH-016.
 */
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ToucheMarkCompact } from '@/components/ToucheMarkCompact';
import { AppTokens } from '@/constants/appTokens';
import { TRY_ALLERGENS_HREF } from '@/constants/routes';
import { setPendingTryProduct } from '@/lib/try-verdict-session';

export default function TryVerdictScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [barcodeMode, setBarcodeMode] = useState(false);

  const onGetVerdict = () => {
    const trimmed = query.trim();
    if (!trimmed && !barcodeMode) return;
    void setPendingTryProduct({
      product_name: barcodeMode ? undefined : trimmed || undefined,
      barcode: barcodeMode ? trimmed || 'scan_pending' : undefined,
      query: trimmed,
      source: barcodeMode ? 'barcode' : 'search',
    }).then(() => {
      router.push(TRY_ALLERGENS_HREF);
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.inner}>
        <ToucheMarkCompact height={24} />
        <Text style={styles.title}>Check a product</Text>

        <View style={styles.field}>
          <Text style={styles.fieldIcon} accessibilityLabel="search">
            ⌕
          </Text>
          <TextInput
            style={styles.input}
            placeholder="search"
            placeholderTextColor={AppTokens.color.muted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            testID="try-verdict-search"
            accessibilityLabel="Search product"
          />
        </View>

        <Pressable
          style={styles.barcode}
          onPress={() => setBarcodeMode((v) => !v)}
          testID="try-verdict-barcode"
          accessibilityRole="button"
          accessibilityLabel="Scan barcode">
          <Text style={styles.barcodeText}>
            {barcodeMode ? 'barcode mode on — enter code above' : 'scan barcode'}
          </Text>
        </Pressable>

        <View style={styles.spacer} />

        <Pressable
          style={[styles.cta, !query.trim() && !barcodeMode ? styles.ctaDisabled : null]}
          onPress={onGetVerdict}
          disabled={!query.trim() && !barcodeMode}
          testID="try-verdict-cta"
          accessibilityRole="button"
          accessibilityLabel="Get my verdict">
          <Text style={styles.ctaText}>Get my verdict</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  inner: { flex: 1, padding: AppTokens.spacing.lg, gap: AppTokens.spacing.md },
  title: {
    fontFamily: AppTokens.font.display,
    fontSize: 28,
    color: AppTokens.color.ink,
    marginTop: 8,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppTokens.color.line,
    borderRadius: AppTokens.radius.sm,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  fieldIcon: { color: AppTokens.color.muted, marginRight: 8, fontSize: 16 },
  input: {
    flex: 1,
    fontFamily: AppTokens.font.body,
    fontSize: 16,
    color: AppTokens.color.ink,
    paddingVertical: 10,
  },
  barcode: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: AppTokens.color.line,
    borderRadius: AppTokens.radius.sm,
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barcodeText: {
    fontFamily: AppTokens.font.body,
    fontSize: 13,
    color: AppTokens.color.muted,
  },
  spacer: { flex: 1 },
  cta: {
    backgroundColor: AppTokens.color.fabBg,
    borderRadius: AppTokens.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: {
    fontFamily: AppTokens.font.body,
    fontWeight: '600',
    fontSize: 16,
    color: '#fff',
  },
});
