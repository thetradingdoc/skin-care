/**
 * PIH v2 — Shelf add / scan (design ID: shelf-add).
 *
 * Catalog name search is not wired (OBF is barcode-only). UI is honest:
 * scan barcode or add manually — no fake "Search" that always nomatches.
 */
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { SCAN_HREF, SHELF_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { addProductManual } from '@/lib/conflict-api';

export const SHELF_ADD_SEARCH_COMING_SOON =
  'Search coming soon — scan a barcode or add manually.';

export default function ShelfAddScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addManual = async () => {
    const productName = name.trim();
    if (!productName) {
      setError('Enter a product name to add manually.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addProductManual({ product_name: productName });
      router.replace(SHELF_HREF);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not add product');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} testID="screen-shelf-add" edges={['top', 'bottom']}>
      <BackNavHeader label="Back" onBack={() => router.replace(SHELF_HREF)} />
      <View style={styles.body}>
        <Text style={styles.title}>Add a product</Text>
        <Text style={styles.sub} testID="shelf-add-search-coming-soon">
          {SHELF_ADD_SEARCH_COMING_SOON}
        </Text>
        <TextInput
          style={styles.field}
          placeholder="Product name (manual add)"
          placeholderTextColor={V4DesignTokens.color.muted}
          value={name}
          onChangeText={setName}
          testID="shelf-add-manual-name"
          editable={!busy}
        />
        {error ? (
          <Text style={styles.err} testID="shelf-add-error">
            {error}
          </Text>
        ) : null}
      </View>
      <View style={styles.footer}>
        <Pressable style={styles.cta} testID="shelf-add-scan" onPress={() => router.push(SCAN_HREF)}>
          <Text style={styles.ctaLabel}>Scan barcode</Text>
        </Pressable>
        <Pressable
          style={[styles.secondary, busy && { opacity: 0.6 }]}
          testID="shelf-add-manual-cta"
          disabled={busy}
          onPress={() => void addManual()}>
          <Text style={styles.secondaryLabel}>{busy ? 'Adding…' : 'Add manually'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.ground },
  body: { flex: 1, paddingHorizontal: 22, paddingTop: 12, gap: 10 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 22,
    color: V4DesignTokens.color.wine,
  },
  sub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    lineHeight: 20,
  },
  field: {
    marginTop: 8,
    backgroundColor: V4DesignTokens.color.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: V4DesignTokens.color.line,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 14,
    color: V4DesignTokens.color.wine,
  },
  err: { color: V4DesignTokens.color.red, fontSize: 13 },
  footer: { padding: 22, gap: 10 },
  cta: {
    backgroundColor: V4DesignTokens.color.wine,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 15,
    color: V4DesignTokens.color.white,
  },
  secondary: {
    backgroundColor: V4DesignTokens.color.white,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: V4DesignTokens.color.line,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 14,
    color: V4DesignTokens.color.wine,
  },
});
