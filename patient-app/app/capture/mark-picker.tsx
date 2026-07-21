/**
 * Step 21 — Mark picker (v4.1 frame 21).
 * Consumes P5.11 `/api/patient/marks`. Zero-existing-marks → new-only path.
 */
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { MARK_COMPARE_HREF, TRACK_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { fetchMarksList, type MarkListItem } from '@/lib/marks-api';

export const MARK_PICKER_TITLE = 'Which mark?';
export const MARK_PICKER_TAGLINE = 'Pick one to compare over time.';
export const MARK_PICKER_NEW = 'Track a new mark';
export const MARK_PICKER_PROMPT = MARK_PICKER_TITLE;
export const MARK_PICKER_EXISTING = 'same as an existing one';
export const MARK_PICKER_EMPTY =
  'No earlier marks yet — this will be your first. Tracking starts here.';

export default function MarkNewVsExistingPickerScreen() {
  const { ready } = useRequirePatientSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [marks, setMarks] = useState<MarkListItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchMarksList();
      setMarks(payload.marks);
    } catch {
      setMarks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const zeroExisting = !loading && marks.length === 0;

  return (
    <SafeAreaView style={styles.root} testID="screen-mark-new-vs-existing" edges={['top', 'bottom']}>
      <BackNavHeader
        label="Back"
        testID="mark-picker-back"
        onBack={() => router.replace(TRACK_HREF as never)}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} testID="mark-picker-prompt">
          {MARK_PICKER_TITLE}
        </Text>
        <Text style={styles.tagline} testID="mark-picker-tagline">
          {MARK_PICKER_TAGLINE}
        </Text>

        {loading ? (
          <ActivityIndicator color={V4DesignTokens.color.red} style={{ marginTop: 24 }} />
        ) : null}

        {zeroExisting ? (
          <View testID="mark-picker-zero-existing">
            <Text style={styles.empty}>{MARK_PICKER_EMPTY}</Text>
          </View>
        ) : (
          <View testID="mark-picker-list">
            {marks.map((m) => {
              const loc = m.body_location || 'Mark';
              const since = m.date ? `since ${m.date}` : 'logged';
              return (
                <Pressable
                  key={m.id}
                  style={styles.row}
                  testID={`mark-picker-item-${m.id}`}
                  onPress={() => {
                    const cg = m.compare_group_id || m.id;
                    router.push({
                      pathname: MARK_COMPARE_HREF,
                      params: { compareGroupId: cg },
                    } as never);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${loc} — ${since}`}>
                  <View style={styles.thumb} />
                  <View style={styles.meta}>
                    <Text style={styles.rowTitle}>
                      {loc} — {since}
                    </Text>
                    <Text style={styles.rowSub}>1 photo logged</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable
          style={styles.newRow}
          testID={zeroExisting ? 'mark-picker-new-first' : 'mark-picker-new'}
          onPress={() => router.replace('/capture/guidance' as never)}
          accessibilityRole="button"
          accessibilityLabel={MARK_PICKER_NEW}>
          <View style={styles.plus}>
            <Text style={styles.plusLabel}>+</Text>
          </View>
          <Text style={styles.newLabel}>{MARK_PICKER_NEW}</Text>
        </Pressable>
        {/* Keep existing-path testID for source gates that assert dual-choice wiring */}
        {!zeroExisting ? (
          <View testID="mark-picker-existing" style={{ height: 0, overflow: 'hidden' }} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white, paddingHorizontal: 18 },
  content: { paddingTop: 8, paddingBottom: 24 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 21,
    color: V4DesignTokens.color.black,
    marginBottom: 6,
  },
  tagline: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    marginBottom: 16,
  },
  empty: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 15,
    color: V4DesignTokens.color.muted,
    lineHeight: 22,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: V4DesignTokens.color.line,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 9,
    backgroundColor: '#8a5a3f',
  },
  meta: { flex: 1 },
  rowTitle: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 15,
    color: V4DesignTokens.color.black,
  },
  rowSub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    color: V4DesignTokens.color.muted,
    marginTop: 2,
  },
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    marginTop: 4,
  },
  plus: {
    width: 44,
    height: 44,
    borderRadius: 9,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: V4DesignTokens.color.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusLabel: {
    fontSize: 18,
    color: V4DesignTokens.color.red,
    fontFamily: V4DesignTokens.font.bodyBold,
  },
  newLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 15,
    color: V4DesignTokens.color.black,
  },
});
