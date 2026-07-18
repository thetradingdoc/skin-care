/**
 * P7.36 — Screen 9 OPQRST-lite (skin, skippable wellness questions).
 */
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import {
  SecondTierChrome,
  TierPrimary,
  TierSecondary,
} from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { PROGRESS_HREF, ROUTINE_NUDGE_HREF } from '@/constants/routes';

export const OPQRST_TITLE = 'A few quick questions';
export const OPQRST_SUB = 'only shown when you tag a skin issue · skippable';

export default function OpqrstLiteScreen() {
  const router = useRouter();
  const [onset, setOnset] = useState('');
  const [betterWorse, setBetterWorse] = useState('');
  const [describe, setDescribe] = useState('');

  return (
    <SecondTierChrome testID="screen-9-opqrst-lite">
      <View>
        <Text style={styles.title} testID="opqrst-title">
          {OPQRST_TITLE}
        </Text>
        <Text style={styles.sub}>{OPQRST_SUB}</Text>
        <Text style={styles.q}>When did you first notice it?</Text>
        <TextInput
          style={styles.input}
          value={onset}
          onChangeText={setOnset}
          testID="opqrst-onset"
        />
        <Text style={styles.q}>Anything that makes it better or worse?</Text>
        <TextInput
          style={styles.input}
          value={betterWorse}
          onChangeText={setBetterWorse}
          testID="opqrst-better-worse"
        />
        <Text style={styles.q}>How would you describe it?</Text>
        <TextInput
          style={styles.input}
          value={describe}
          onChangeText={setDescribe}
          testID="opqrst-describe"
        />
      </View>
      <View>
        <TierPrimary
          label="Continue"
          testID="opqrst-continue"
          onPress={() => router.push(ROUTINE_NUDGE_HREF)}
        />
        <TierSecondary
          label="skip this"
          testID="opqrst-skip"
          onPress={() => router.replace(PROGRESS_HREF)}
        />
      </View>
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 6 },
  sub: { fontSize: 15, color: AppTokens.color.muted, marginBottom: 16 },
  q: { fontSize: 14, fontWeight: '600', color: AppTokens.color.ink, marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
});
