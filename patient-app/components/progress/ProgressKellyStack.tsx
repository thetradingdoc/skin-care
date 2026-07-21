/**
 * Progress Kelly message stack — design "assistant-row" pattern.
 * client_action:
 *   render | render_fallback → show bubble
 *   suppress → render nothing
 *
 * Body only renders when payloadMarkId === selectedMarkId (and not loading).
 * A stale payload from mark A under mark B's pill must never paint.
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { V4DesignTokens } from '@/constants/v4DesignTokens';
import type { ProgressKellyPayload } from '@/lib/progress-kelly-api';
import { resolveProgressKellyViewMode } from '@/lib/progress-kelly-view-mode';

type Props = {
  loading: boolean;
  payload: ProgressKellyPayload | null;
  /** Mark id the current payload was fetched for (compare_group_id). */
  payloadMarkId: string | null;
  /** Currently selected mark in the switcher. */
  selectedMarkId: string | null;
  onCompare?: () => void;
  onDismiss?: () => void;
};

export function ProgressKellyStack({
  loading,
  payload,
  payloadMarkId,
  selectedMarkId,
  onCompare,
  onDismiss,
}: Props) {
  const mode = resolveProgressKellyViewMode({
    loading,
    payload,
    payloadMarkId,
    selectedMarkId,
  });

  if (mode === 'loading') {
    return (
      <View style={styles.row} testID="progress-kelly-loading">
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>K</Text>
        </View>
        <View style={styles.bubble}>
          <Text style={styles.title}>Kelly</Text>
          <ActivityIndicator color={V4DesignTokens.color.red} style={{ marginVertical: 8 }} />
          <Text style={styles.sub}>Checking your records…</Text>
        </View>
      </View>
    );
  }

  if (mode === 'empty' || !payload) return null;

  const action = payload.client_action;
  const body = payload.message?.body?.trim();
  if (!body) return null;

  const showActions =
    action === 'render' &&
    payload.message?.action?.type === 'compare' &&
    typeof onCompare === 'function';

  return (
    <View
      style={styles.row}
      testID={payload.fallback ? 'progress-kelly-fallback' : 'progress-kelly-message'}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>K</Text>
      </View>
      <View style={styles.bubble}>
        <Text style={styles.title}>Kelly</Text>
        <Text style={styles.body} testID="progress-kelly-body">
          {body}
        </Text>
        {showActions ? (
          <View style={styles.actions}>
            <Pressable
              onPress={onCompare}
              style={[styles.btn, styles.btnPrimary]}
              accessibilityRole="button"
              accessibilityLabel="Compare"
              testID="progress-kelly-compare">
              <Text style={styles.btnPrimaryText}>
                {payload.message?.action?.label?.trim() || 'Compare'}
              </Text>
            </Pressable>
            {onDismiss ? (
              <Pressable
                onPress={onDismiss}
                style={[styles.btn, styles.btnGhost]}
                accessibilityRole="button"
                accessibilityLabel="Not now"
                testID="progress-kelly-dismiss">
                <Text style={styles.btnGhostText}>Not now</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 4,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    // Downloads HTML `.savatar` uses --green; match that (not brand-ink).
    backgroundColor: V4DesignTokens.color.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 14,
    color: V4DesignTokens.color.white,
  },
  bubble: {
    flex: 1,
    backgroundColor: '#F6F6F6',
    borderRadius: 14,
    padding: 14,
  },
  title: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 13,
    color: V4DesignTokens.color.black,
    marginBottom: 4,
  },
  body: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.black,
    lineHeight: 20,
  },
  sub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    color: V4DesignTokens.color.muted,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  btn: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  btnPrimary: {
    backgroundColor: V4DesignTokens.color.green,
  },
  btnPrimaryText: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 13,
    color: V4DesignTokens.color.white,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: V4DesignTokens.color.lineStrong,
  },
  btnGhostText: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
  },
});
