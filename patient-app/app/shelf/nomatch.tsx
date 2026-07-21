/**
 * PIH v2 — Shelf no catalog match (design ID: shelf-nomatch).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { SHELF_ADD_HREF, SHELF_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';

export default function ShelfNomatchScreen() {
  const router = useRouter();
  const { q } = useLocalSearchParams<{ q?: string }>();
  return (
    <SafeAreaView style={styles.root} testID="screen-shelf-nomatch" edges={['top', 'bottom']}>
      <BackNavHeader label="Back" onBack={() => router.replace(SHELF_ADD_HREF)} />
      <View style={styles.body}>
        <Text style={styles.badge}>error state</Text>
        <Text style={styles.title}>No match found</Text>
        <Text style={styles.sub}>
          {q
            ? `We couldn't match “${q}” in the catalog. Add it manually to keep tracking.`
            : "We couldn't match that product. Add it manually to keep tracking."}
        </Text>
      </View>
      <View style={styles.footer}>
        <Pressable
          style={styles.cta}
          testID="shelf-nomatch-manual"
          onPress={() => router.replace(SHELF_HREF)}>
          <Text style={styles.ctaLabel}>Add manually on Shelf</Text>
        </Pressable>
        <Pressable testID="shelf-nomatch-retry" onPress={() => router.replace(SHELF_ADD_HREF)}>
          <Text style={styles.skip}>Try another search</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.ground },
  body: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 12 },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 10,
    fontFamily: V4DesignTokens.font.bodyBold,
    color: V4DesignTokens.color.red,
    borderWidth: 1,
    borderColor: V4DesignTokens.color.red,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 22,
    color: V4DesignTokens.color.wine,
  },
  sub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    lineHeight: 21,
  },
  footer: { padding: 22, gap: 12 },
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
  skip: {
    textAlign: 'center',
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
  },
});
