/**
 * Step 22 — Mark compare (v4.1 frame 22).
 * Consumes P5.12 `/api/patient/marks/compare-group/:id`.
 * Photos + approximate named-zone markers when visual_pointer is present.
 * No AI narrative prose; no percentage scores.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ObservationZoneOverlay } from '@/components/capture/ObservationZoneOverlay';
import { LoadFailedState } from '@/components/LoadFailedState';
import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { PROGRESS_HREF, TRACK_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import {
  fetchCompareGroupTimeline,
  type CompareTimelineEntry,
} from '@/lib/marks-api';
import { parseVisualPointer, VISUAL_POINTER_ZONES, type VisualPointer } from '@/lib/visual-observation-pointer';

export const MARK_COMPARE_TITLE = 'Compare over time';
export const MARK_COMPARE_TAGLINE = 'Same spot, side by side. No score, no %.';
/** Exact approved honesty — assert presence in design-parity suite. */
export const MARK_COMPARE_HONESTY =
  'Placed for visual comparison only. No improvement percentage is calculated or implied.';
/** @deprecated Prefer MARK_COMPARE_TAGLINE + MARK_COMPARE_HONESTY. */
export const MARK_COMPARE_NO_NARRATIVE = MARK_COMPARE_TAGLINE;

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
  const [loadFailed, setLoadFailed] = useState(false);
  const [entries, setEntries] = useState<CompareTimelineEntry[]>([]);

  const load = useCallback(async () => {
    if (!compareGroupId) {
      setEntries([]);
      setLoadFailed(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadFailed(false);
    try {
      const payload = await fetchCompareGroupTimeline(compareGroupId);
      setEntries(payload.entries);
    } catch {
      setEntries([]);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [compareGroupId]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const shared = useMemo(() => sharedPointer(entries), [entries]);
  const headingLoc = entries[0]?.body_location?.trim() || null;
  const title = headingLoc ? `${headingLoc}` : MARK_COMPARE_TITLE;

  return (
    <SafeAreaView style={styles.root} testID="screen-mark-compare-over-time" edges={['top', 'bottom']}>
      <BackNavHeader
        label="Back"
        testID="mark-compare-back"
        onBack={() => router.replace(TRACK_HREF as never)}
      />
      <View style={styles.main}>
        <Text style={styles.title} testID="mark-compare-title">
          {title}
        </Text>
        <Text style={styles.sub} testID="mark-compare-tagline">
          {MARK_COMPARE_TAGLINE}
        </Text>
        {loading ? (
          <ActivityIndicator color={V4DesignTokens.color.red} />
        ) : loadFailed ? (
          <LoadFailedState testID="mark-compare-load-failed" onRetry={() => void load()} />
        ) : (
          <ScrollView testID="mark-compare-timeline">
            {entries.length === 0 ? (
              <Text style={styles.empty} testID="mark-compare-empty">
                No photos in this compare group yet.
              </Text>
            ) : (
              <View style={styles.rowPhotos} testID="mark-compare-side-by-side">
                {entries.map((e) => {
                  const entryPointer = parseVisualPointer(e.visual_pointer) || shared;
                  return (
                    <View key={e.id} style={styles.col} testID={`mark-compare-entry-${e.id}`}>
                      <ObservationZoneOverlay
                        imageUri={e.media_url}
                        pointer={entryPointer}
                        compact
                        testID={`mark-compare-overlay-${e.id}`}
                      />
                      <Text style={styles.rowTitle}>{e.date || 'undated'}</Text>
                      {e.narrative != null ? (
                        <Text testID="mark-compare-narrative-leak">LEAK</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
            <Text style={styles.honesty} testID="mark-compare-honesty">
              {MARK_COMPARE_HONESTY}
            </Text>
          </ScrollView>
        )}
      </View>
      <Pressable
        style={styles.cta}
        testID="mark-compare-done"
        onPress={() => router.replace(PROGRESS_HREF)}
        accessibilityRole="button"
        accessibilityLabel="Done">
        <Text style={styles.ctaLabel}>Done</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white, paddingHorizontal: 18 },
  main: { flex: 1, paddingTop: 4 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 19,
    color: V4DesignTokens.color.black,
    marginBottom: 6,
  },
  sub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    marginBottom: 12,
  },
  empty: {
    fontFamily: V4DesignTokens.font.body,
    color: V4DesignTokens.color.muted,
    marginTop: 16,
  },
  rowPhotos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    justifyContent: 'flex-start',
  },
  col: {
    width: '47%',
    minWidth: 140,
    paddingVertical: 4,
  },
  rowTitle: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 10.5,
    color: V4DesignTokens.color.black,
    marginTop: 5,
  },
  honesty: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    lineHeight: 19,
    color: V4DesignTokens.color.muted,
    marginTop: 12,
    marginBottom: 16,
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
