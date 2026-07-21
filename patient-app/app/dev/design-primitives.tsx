/**
 * STEP 0b evidence sheet — all Wave 0 primitives on one screen for MATCH verification.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { TabLineIcon } from '@/components/v4/TabLineIcon';
import { ToucheTulipMark } from '@/components/v4/ToucheTulipMark';
import { TrackFab } from '@/components/v4/TrackFab';
import { ToucheMarkCompact } from '@/components/ToucheMarkCompact';
import { V4DesignTokens, RETIRED_BRAND_ORANGES } from '@/constants/v4DesignTokens';

export default function DesignPrimitivesSheet() {
  return (
    <SafeAreaView style={styles.root} testID="screen-design-primitives" edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} testID="primitives-title">
          Wave 0 primitives
        </Text>
        <Text style={styles.meta}>
          red {V4DesignTokens.color.red} · black {V4DesignTokens.color.black} · white{' '}
          {V4DesignTokens.color.white}
        </Text>
        <Text style={styles.meta} testID="primitives-retired-oranges">
          retired (must not appear): {RETIRED_BRAND_ORANGES.join(', ')}
        </Text>

        <Text style={styles.section}>Tulip mark (color prop)</Text>
        <View style={styles.row} testID="primitives-tulip-row">
          <ToucheTulipMark color={V4DesignTokens.color.red} width={64} />
          <View style={styles.redHero}>
            <ToucheTulipMark color={V4DesignTokens.color.white} width={64} />
          </View>
          <ToucheMarkCompact height={28} />
        </View>

        <Text style={styles.section}>Typography</Text>
        <Text style={styles.display} testID="primitives-font-display">
          Be Bold. (Poppins ExtraBold)
        </Text>
        <Text style={styles.body} testID="primitives-font-body">
          Manrope body — Track your skin & care
        </Text>

        <Text style={styles.section}>Back-nav header</Text>
        <BackNavHeader label="Back" testID="primitives-back-nav" />

        <Text style={styles.section}>Track FAB (white ring visible on dark strip)</Text>
        <View style={styles.fabStrip} testID="primitives-track-fab-strip">
          <TrackFab size={64} testID="primitives-track-fab" />
        </View>

        <Text style={styles.section}>Tab line-icons</Text>
        <View style={styles.row} testID="primitives-tab-icons">
          <TabLineIcon name="calendar" color={V4DesignTokens.color.black} />
          <TabLineIcon name="shelf" color={V4DesignTokens.color.black} />
          <TabLineIcon name="progress" color={V4DesignTokens.color.black} />
          <TabLineIcon name="profile" color={V4DesignTokens.color.black} />
        </View>

        <View style={styles.swatches} testID="primitives-swatches">
          <View style={[styles.swatch, { backgroundColor: V4DesignTokens.color.red }]} />
          <View style={[styles.swatch, { backgroundColor: V4DesignTokens.color.black }]} />
          <View
            style={[
              styles.swatch,
              { backgroundColor: V4DesignTokens.color.white, borderWidth: 1, borderColor: '#ccc' },
            ]}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white },
  content: { padding: 24, gap: 12, paddingBottom: 48 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 28,
    color: V4DesignTokens.color.black,
  },
  meta: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
  },
  section: {
    marginTop: 16,
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 14,
    color: V4DesignTokens.color.black,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  redHero: {
    backgroundColor: V4DesignTokens.color.red,
    padding: 12,
    borderRadius: 8,
  },
  display: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 32,
    color: V4DesignTokens.color.black,
  },
  body: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 16,
    color: V4DesignTokens.color.black,
  },
  fabStrip: {
    alignSelf: 'flex-start',
    backgroundColor: V4DesignTokens.color.black,
    padding: 20,
    borderRadius: 12,
  },
  swatches: { flexDirection: 'row', gap: 12, marginTop: 24 },
  swatch: { width: 48, height: 48, borderRadius: 8 },
});
