/**
 * Step 14 — Tag picker (v4.1 frame 14). Canonical 6-tag enum matching API RECORD_TAGS.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { CAPTURE_2A_HREF, CAPTURE_LOADING_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { mapCaptureTagChip } from '@/lib/capture-state-machine';

/** UI chips — must match API/DB enum (prescription not rx). */
export const CAPTURE_TAGS = ['skin', 'mark', 'prescription', 'lab', 'bill', 'other'] as const;

const TAG_META: Record<(typeof CAPTURE_TAGS)[number], { title: string; sub: string }> = {
  skin: { title: 'Skin', sub: 'Default for photos' },
  mark: { title: 'Mark', sub: 'Tracking a spot over time' },
  prescription: { title: 'Prescription', sub: 'Optical or medication' },
  lab: { title: 'Lab', sub: 'Reports, results, imaging' },
  bill: { title: 'Bill', sub: 'Invoices, receipts' },
  other: { title: 'Other', sub: 'Anything else medical' },
};

export default function CaptureTagScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ entry?: string }>();
  const entry = params.entry === 'track' ? 'track' : 'onboarding';
  const [tag, setTag] = useState<(typeof CAPTURE_TAGS)[number]>('skin');
  const [describe, setDescribe] = useState('');

  return (
    <SafeAreaView style={styles.root} testID="capture-3-tag" edges={['top', 'bottom']}>
      <BackNavHeader
        label="Cancel"
        testID="capture-tag-back"
        onBack={() => router.replace(CAPTURE_2A_HREF as never)}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title} testID="capture-tag-title">
          What is this?
        </Text>
        <Text style={styles.sub}>All six tags, not collapsed — matches the API.</Text>
        <View style={styles.tags}>
          {CAPTURE_TAGS.map((t) => {
            const on = tag === t;
            const meta = TAG_META[t];
            return (
              <Pressable
                key={t}
                style={[styles.row, on && styles.rowOn]}
                onPress={() => setTag(t)}
                testID={`capture-tag-${t}`}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={meta.title}>
                <View style={[styles.swatch, on && styles.swatchOn]} />
                <View style={styles.meta}>
                  <Text style={[styles.rowTitle, on && styles.rowTitleOn]}>{meta.title}</Text>
                  <Text style={styles.rowSub}>{meta.sub}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          style={styles.input}
          placeholder='or describe it — e.g. "eye exam"'
          placeholderTextColor={V4DesignTokens.color.muted}
          value={describe}
          onChangeText={setDescribe}
          testID="capture-tag-describe"
        />
      </ScrollView>
      <Pressable
        style={styles.cta}
        testID="capture-tag-continue"
        onPress={() => {
          const mapped = mapCaptureTagChip(tag);
          router.push({
            pathname: CAPTURE_LOADING_HREF,
            params: { tag: mapped, entry },
          } as never);
        }}
        accessibilityRole="button"
        accessibilityLabel="Continue">
        <Text style={styles.ctaLabel}>Continue</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white, paddingHorizontal: 18 },
  content: { paddingTop: 8, paddingBottom: 16 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 20,
    color: V4DesignTokens.color.black,
    marginBottom: 6,
  },
  sub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    marginBottom: 16,
  },
  tags: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: V4DesignTokens.color.line,
  },
  rowOn: {},
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#333333',
  },
  swatchOn: { backgroundColor: V4DesignTokens.color.red },
  meta: { flex: 1 },
  rowTitle: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 15,
    color: V4DesignTokens.color.black,
  },
  rowTitleOn: { color: V4DesignTokens.color.redDeep },
  rowSub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    color: V4DesignTokens.color.muted,
    marginTop: 2,
  },
  input: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: V4DesignTokens.color.line,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    fontFamily: V4DesignTokens.font.body,
    color: V4DesignTokens.color.black,
  },
  cta: {
    backgroundColor: V4DesignTokens.color.black,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ctaLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.white,
  },
});
