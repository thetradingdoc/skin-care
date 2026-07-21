/**
 * Step 18 — Discard confirmation (v4.1 frame 18).
 * Shown when Cancel is pressed on confirm (and optionally loading).
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { V4DesignTokens } from '@/constants/v4DesignTokens';

export const DISCARD_TITLE = 'Discard this capture?';
export const DISCARD_BODY = 'Nothing has been saved yet.';
export const DISCARD_CONFIRM_LABEL = 'Discard';
export const DISCARD_KEEP_LABEL = 'Keep editing';

type Props = {
  visible: boolean;
  onDiscard: () => void;
  onKeepEditing: () => void;
};

export function CaptureDiscardDialog({ visible, onDiscard, onKeepEditing }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeepEditing}>
      <View style={styles.backdrop} testID="capture-discard-dialog">
        <View style={styles.card}>
          <View style={styles.ring}>
            <Text style={styles.x}>✕</Text>
          </View>
          <Text style={styles.title}>{DISCARD_TITLE}</Text>
          <Text style={styles.body}>{DISCARD_BODY}</Text>
          <Pressable
            style={styles.discard}
            onPress={onDiscard}
            testID="capture-discard-confirm"
            accessibilityRole="button"
            accessibilityLabel={DISCARD_CONFIRM_LABEL}>
            <Text style={styles.discardLabel}>{DISCARD_CONFIRM_LABEL}</Text>
          </Pressable>
          <Pressable
            style={styles.keep}
            onPress={onKeepEditing}
            testID="capture-discard-keep"
            accessibilityRole="button"
            accessibilityLabel={DISCARD_KEEP_LABEL}>
            <Text style={styles.keepLabel}>{DISCARD_KEEP_LABEL}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,11,12,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: V4DesignTokens.color.white,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
  },
  ring: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: V4DesignTokens.color.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  x: {
    fontSize: 18,
    color: V4DesignTokens.color.black,
    fontFamily: V4DesignTokens.font.bodyBold,
  },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 17,
    color: V4DesignTokens.color.black,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    textAlign: 'center',
    maxWidth: 240,
    marginBottom: 20,
    lineHeight: 20,
  },
  discard: {
    alignSelf: 'stretch',
    backgroundColor: V4DesignTokens.color.red,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },
  discardLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.white,
  },
  keep: {
    alignSelf: 'stretch',
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: V4DesignTokens.color.lineStrong,
    backgroundColor: V4DesignTokens.color.white,
  },
  keepLabel: {
    fontFamily: V4DesignTokens.font.bodyMedium,
    fontSize: 16,
    color: V4DesignTokens.color.black,
  },
});
