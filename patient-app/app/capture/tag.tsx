/**
 * P7.04 — Screen 3 Tag it (canonical 6-tag enum).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  SecondTierChrome,
  TierPrimary,
} from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { CAPTURE_LOADING_HREF } from '@/constants/routes';
import { mapCaptureTagChip } from '@/lib/capture-state-machine';

export const CAPTURE_TAGS = ['skin', 'bill', 'prescription', 'mark', 'lab', 'other'] as const;

export default function CaptureTagScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ entry?: string }>();
  const entry = params.entry === 'track' ? 'track' : 'onboarding';
  const [tag, setTag] = useState<(typeof CAPTURE_TAGS)[number]>('skin');
  const [describe, setDescribe] = useState('');

  return (
    <SecondTierChrome testID="capture-3-tag">
      <View>
        <Text style={styles.title}>What&apos;s this about?</Text>
        <Text style={styles.sub}>pick any that apply</Text>
        <View style={styles.tags}>
          {CAPTURE_TAGS.map((t) => (
            <Pressable
              key={t}
              style={[styles.tag, tag === t && styles.tagOn]}
              onPress={() => setTag(t)}
              testID={`capture-tag-${t}`}>
              <Text style={styles.tagLabel}>{t}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder='or describe it — e.g. "eye exam"'
          value={describe}
          onChangeText={setDescribe}
          testID="capture-tag-describe"
        />
      </View>
      <TierPrimary
        label="Continue"
        testID="capture-tag-continue"
        onPress={() => {
          const mapped = mapCaptureTagChip(tag);
          router.push({
            pathname: CAPTURE_LOADING_HREF,
            params: { tag: mapped, entry },
          } as never);
        }}
      />
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 6 },
  sub: { fontSize: 15, color: AppTokens.color.muted, marginBottom: 16 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: AppTokens.color.cream,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
  },
  tagOn: { backgroundColor: AppTokens.color.ink, borderColor: AppTokens.color.ink },
  tagLabel: { fontSize: 13, color: AppTokens.color.ink, textTransform: 'capitalize' },
  tagLabelOn: { color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: AppTokens.color.ink,
  },
});
