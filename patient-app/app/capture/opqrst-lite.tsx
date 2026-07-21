/**
 * OPQRST-lite — restyle only (clone Steps 19–20 reveal/thesis chrome). Keep scoped.
 */
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { PROGRESS_HREF, ROUTINE_NUDGE_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';

export const OPQRST_TITLE = 'A few quick questions';
export const OPQRST_SUB = 'only shown when you tag a skin issue · skippable';

export default function OpqrstLiteScreen() {
  const router = useRouter();
  const [onset, setOnset] = useState('');
  const [betterWorse, setBetterWorse] = useState('');
  const [describe, setDescribe] = useState('');

  return (
    <SafeAreaView style={styles.root} testID="screen-9-opqrst-lite" edges={['top', 'bottom']}>
      <BackNavHeader
        label="Back"
        testID="opqrst-back"
        onBack={() => router.replace(PROGRESS_HREF)}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={styles.primary}
          testID="opqrst-continue"
          onPress={() => router.push(ROUTINE_NUDGE_HREF)}
          accessibilityRole="button">
          <Text style={styles.primaryLabel}>Continue</Text>
        </Pressable>
        <Pressable
          style={styles.secondary}
          testID="opqrst-skip"
          onPress={() => router.replace(PROGRESS_HREF)}
          accessibilityRole="button">
          <Text style={styles.secondaryLabel}>skip this</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white, paddingHorizontal: 18 },
  content: { paddingBottom: 16 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 22,
    color: V4DesignTokens.color.black,
    marginBottom: 6,
  },
  sub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    marginBottom: 16,
  },
  q: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 14,
    color: V4DesignTokens.color.black,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: V4DesignTokens.color.line,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    fontFamily: V4DesignTokens.font.body,
    color: V4DesignTokens.color.black,
  },
  footer: { paddingBottom: 12 },
  primary: {
    backgroundColor: V4DesignTokens.color.black,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  primaryLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.white,
  },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: {
    fontFamily: V4DesignTokens.font.bodyMedium,
    fontSize: 15,
    color: V4DesignTokens.color.muted,
  },
});
