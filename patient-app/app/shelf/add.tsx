/**
 * Shelf add — barcode scan and manual add only.
 * Catalog name search is not wired (OBF is barcode-only); UI stays honest.
 */
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  SecondTierChrome,
  TierPrimary,
  TierSecondary,
} from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { SCAN_HREF, SHELF_HREF } from '@/constants/routes';
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
    <SecondTierChrome testID="screen-shelf-add">
      <Pressable
        onPress={() => router.replace(SHELF_HREF)}
        testID="shelf-add-back"
        style={styles.back}>
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>
      <Text style={styles.title}>Add a product</Text>
      <Text style={styles.sub} testID="shelf-add-search-coming-soon">
        {SHELF_ADD_SEARCH_COMING_SOON}
      </Text>
      <TextInput
        style={styles.field}
        placeholder="Product name (manual add)"
        placeholderTextColor={AppTokens.color.muted}
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
      <View>
        <TierPrimary
          label="Scan barcode"
          testID="shelf-add-scan"
          onPress={() => router.push(SCAN_HREF)}
        />
        <View style={{ height: 10 }} />
        <TierSecondary
          label={busy ? 'Adding…' : 'Add manually'}
          testID="shelf-add-manual-cta"
          onPress={() => {
            if (!busy) void addManual();
          }}
        />
      </View>
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', marginBottom: 8 },
  backLabel: { color: AppTokens.color.muted, fontWeight: '600' },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: AppTokens.color.ink,
    marginBottom: 8,
  },
  sub: {
    fontSize: 14,
    color: AppTokens.color.muted,
    lineHeight: 20,
    marginBottom: 12,
  },
  field: {
    backgroundColor: AppTokens.color.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: AppTokens.color.line,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 14,
    color: AppTokens.color.ink,
    marginBottom: 8,
  },
  err: { color: AppTokens.color.danger, fontSize: 13, marginBottom: 8 },
});
