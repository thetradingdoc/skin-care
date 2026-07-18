/**
 * P7.24 — Mark new-vs-existing picker.
 * Consumes P5.11 `/api/patient/marks`. Zero-existing-marks → new-only path.
 */
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  SecondTierChrome,
  TierPrimary,
} from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { MARK_COMPARE_HREF, REVEAL_MARK_HREF } from '@/constants/routes';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { fetchMarksList, MARKS_LIST_API, type MarkListItem } from '@/lib/marks-api';

export const MARK_PICKER_PROMPT = 'new mark, or is this the same one as before?';
export const MARK_PICKER_NEW = 'new mark';
export const MARK_PICKER_EXISTING = 'same as an existing one';
export const MARK_PICKER_EMPTY =
  'No earlier marks yet — this will be your first. Tracking starts here.';

export default function MarkNewVsExistingPickerScreen() {
  const { ready } = useRequirePatientSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [marks, setMarks] = useState<MarkListItem[]>([]);
  const [pickingExisting, setPickingExisting] = useState(false);

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
    <SecondTierChrome testID="screen-mark-new-vs-existing">
      <View>
        <Text style={styles.title} testID="mark-picker-prompt">
          {MARK_PICKER_PROMPT}
        </Text>
        <Text style={styles.api} testID="mark-picker-api-source">
          {MARKS_LIST_API}
        </Text>

        {loading ? (
          <ActivityIndicator color={AppTokens.color.fabBg} style={{ marginTop: 24 }} />
        ) : null}

        {zeroExisting ? (
          <View testID="mark-picker-zero-existing">
            <Text style={styles.empty}>{MARK_PICKER_EMPTY}</Text>
            <TierPrimary
              label={MARK_PICKER_NEW}
              testID="mark-picker-new-first"
              onPress={() => router.replace(REVEAL_MARK_HREF)}
            />
          </View>
        ) : (
          <View>
            <Pressable
              style={styles.choice}
              testID="mark-picker-new"
              onPress={() => router.replace(REVEAL_MARK_HREF)}>
              <Text style={styles.choiceLabel}>{MARK_PICKER_NEW}</Text>
            </Pressable>
            <Pressable
              style={styles.choice}
              testID="mark-picker-existing"
              onPress={() => setPickingExisting(true)}>
              <Text style={styles.choiceLabel}>{MARK_PICKER_EXISTING}</Text>
            </Pressable>
            {pickingExisting
              ? marks.map((m) => (
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
                    }}>
                    <Text style={styles.rowTitle}>
                      {m.body_location || 'Mark'} · {m.date || 'unknown date'}
                    </Text>
                  </Pressable>
                ))
              : null}
          </View>
        )}
      </View>
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 8 },
  api: { fontSize: 10, color: AppTokens.color.hint, marginBottom: 16 },
  empty: { fontSize: 15, color: AppTokens.color.muted, lineHeight: 22, marginBottom: 20 },
  choice: {
    backgroundColor: AppTokens.color.cream,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  choiceLabel: { fontSize: 16, fontWeight: '600', color: AppTokens.color.ink },
  row: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppTokens.color.line,
  },
  rowTitle: { fontSize: 15, color: AppTokens.color.ink },
});
