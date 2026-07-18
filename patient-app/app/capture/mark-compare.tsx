/**
 * P7.25 — Compare-over-time mark UI.
 * Consumes P5.12 `/api/patient/marks/compare-group/:id`.
 * Photos + approximate named-zone markers when visual_pointer is present.
 * No AI narrative prose; no percentage scores.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ObservationZoneOverlay } from '@/components/capture/ObservationZoneOverlay';
import {
  SecondTierChrome,
  TierPrimary,
} from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { PROGRESS_HREF } from '@/constants/routes';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import {
  fetchCompareGroupTimeline,
  type CompareTimelineEntry,
} from '@/lib/marks-api';
import { parseVisualPointer, VISUAL_POINTER_ZONES, type VisualPointer } from '@/lib/visual-observation-pointer';

export const MARK_COMPARE_TITLE = 'Compare over time';
export const MARK_COMPARE_NO_NARRATIVE =
  'dated photos — approximate region markers when available (not measured scores)';

/** Shared zone set across timeline for side-by-side consistency. */
function sharedPointer(entries: CompareTimelineEntry[]): VisualPointer | null {
  const parsed = entries
    .map((e) => parseVisualPointer(e.visual_pointer))
    .filter((p): p is VisualPointer => p != null);
  if (!parsed.length) return null;
  const zoneSet = new Set<string>();
  const labelSet = new Set<string>();
  for (const p of parsed) {
    for (const z of p.zones) zoneSet.add(z);
    for (const l of p.zone_labels) labelSet.add(l);
  }
  const allowed = new Set<string>(VISUAL_POINTER_ZONES);
  const zones = [...zoneSet].filter((z): z is VisualPointer['zones'][number] => allowed.has(z));
  return {
    zones,
    zone_labels: [...labelSet].slice(0, 12),
    labeled: 'ai_suggestion',
    not_diagnosis: true,
    compare_group_id: parsed[0].compare_group_id,
  };
}

export default function MarkCompareOverTimeScreen() {
  const { ready } = useRequirePatientSession();
  const router = useRouter();
  const params = useLocalSearchParams<{ compareGroupId?: string }>();
  const compareGroupId = String(params.compareGroupId || '').trim();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<CompareTimelineEntry[]>([]);

  const load = useCallback(async () => {
    if (!compareGroupId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const payload = await fetchCompareGroupTimeline(compareGroupId);
      setEntries(payload.entries);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [compareGroupId]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const shared = useMemo(() => sharedPointer(entries), [entries]);

  return (
    <SecondTierChrome testID="screen-mark-compare-over-time">
      <View style={{ flex: 1 }}>
        <Text style={styles.title} testID="mark-compare-title">
          {MARK_COMPARE_TITLE}
        </Text>
        <Text style={styles.sub}>{MARK_COMPARE_NO_NARRATIVE}</Text>
        {loading ? (
          <ActivityIndicator color={AppTokens.color.fabBg} />
        ) : (
          <ScrollView testID="mark-compare-timeline">
            {entries.length === 0 ? (
              <Text style={styles.empty} testID="mark-compare-empty">
                No photos in this compare group yet.
              </Text>
            ) : (
              <View style={styles.rowPhotos} testID="mark-compare-side-by-side">
                {entries.map((e) => {
                  const entryPointer =
                    parseVisualPointer(e.visual_pointer) || shared;
                  return (
                    <View key={e.id} style={styles.col} testID={`mark-compare-entry-${e.id}`}>
                      <Text style={styles.rowTitle}>{e.date || 'undated'}</Text>
                      <Text style={styles.rowBody}>{e.body_location || 'Mark'}</Text>
                      <ObservationZoneOverlay
                        imageUri={e.media_url}
                        pointer={entryPointer}
                        compact
                        testID={`mark-compare-overlay-${e.id}`}
                      />
                      {e.narrative != null ? (
                        <Text testID="mark-compare-narrative-leak">LEAK</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}
      </View>
      <TierPrimary
        label="Done"
        testID="mark-compare-done"
        onPress={() => router.replace(PROGRESS_HREF)}
      />
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 6 },
  sub: { fontSize: 14, color: AppTokens.color.muted, marginBottom: 12 },
  empty: { color: AppTokens.color.muted, marginTop: 16 },
  rowPhotos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-start',
  },
  col: {
    width: '47%',
    minWidth: 140,
    paddingVertical: 8,
  },
  rowTitle: { fontWeight: '600', color: AppTokens.color.ink },
  rowBody: { color: AppTokens.color.muted, marginTop: 4, marginBottom: 6 },
});
