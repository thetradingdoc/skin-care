/**
 * Shared Confirm chrome — clone of Step 17 (confirm/skin) for all tag variants.
 * Do not freehand per-tag layouts; swap only eyebrow / extras / template id.
 */
import React, { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { V4DesignTokens } from '@/constants/v4DesignTokens';

type Props = {
  screenTestID: string;
  backTestID: string;
  looksRightTestID: string;
  cancelTestID: string;
  eyebrow: string;
  eyebrowTestID?: string;
  busy: boolean;
  error: string | null;
  onLooksRight: () => void;
  onCancel: () => void;
  children: ReactNode;
  /** Optional tertiary under Cancel (e.g. manual entry). */
  footerExtra?: ReactNode;
};

export function ConfirmTagChrome({
  screenTestID,
  backTestID,
  looksRightTestID,
  cancelTestID,
  eyebrow,
  eyebrowTestID,
  busy,
  error,
  onLooksRight,
  onCancel,
  children,
  footerExtra,
}: Props) {
  return (
    <SafeAreaView style={styles.root} testID={screenTestID} edges={['top', 'bottom']}>
      <BackNavHeader label="Cancel" testID={backTestID} onBack={onCancel} />
      <ScrollView
        style={styles.main}
        contentContainerStyle={styles.mainContent}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow} testID={eyebrowTestID}>
          {eyebrow}
        </Text>
        <Text style={styles.h}>Here&apos;s what we found</Text>
        {children}
        {error ? <Text style={styles.err}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={styles.primary}
          testID={looksRightTestID}
          onPress={onLooksRight}
          accessibilityRole="button"
          accessibilityLabel={busy ? 'Saving…' : 'Looks right'}>
          <Text style={styles.primaryLabel}>{busy ? 'Saving…' : 'Looks right'}</Text>
        </Pressable>
        {footerExtra}
        <Pressable
          style={styles.secondary}
          testID={cancelTestID}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel">
          <Text style={styles.secondaryLabel}>Cancel</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export const confirmTagStyles = StyleSheet.create({
  hint: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    marginBottom: 8,
  },
  note: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    marginTop: 8,
    lineHeight: 20,
  },
  prompt: {
    marginTop: 12,
    fontFamily: V4DesignTokens.font.body,
    fontSize: 15,
    color: V4DesignTokens.color.muted,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white, paddingHorizontal: 18 },
  main: { flex: 1 },
  mainContent: { paddingTop: 4, paddingBottom: 16 },
  eyebrow: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.7,
    color: V4DesignTokens.color.redDeep,
    marginBottom: 4,
  },
  h: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 22,
    color: V4DesignTokens.color.black,
    marginBottom: 8,
  },
  err: { color: V4DesignTokens.color.redDeep, marginTop: 8, fontFamily: V4DesignTokens.font.body },
  footer: { paddingBottom: 8 },
  primary: {
    backgroundColor: V4DesignTokens.color.black,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.white,
  },
  secondary: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontFamily: V4DesignTokens.font.bodyMedium,
    fontSize: 15,
    color: V4DesignTokens.color.muted,
  },
});
