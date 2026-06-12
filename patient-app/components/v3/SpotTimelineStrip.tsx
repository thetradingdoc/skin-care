import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SessionImage } from '@/components/SessionImage';
import { AppTokens } from '@/constants/appTokens';
import type { SpotChangeTag, SpotSnapshot } from '@/lib/spot-store';

type Props = {
  photos: SpotSnapshot[];
};

function formatDayLabel(date: string, isLast: boolean): string {
  if (isLast) return 'Today';
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date.slice(5) || '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function tagStyle(variant: SpotChangeTag, isLast: boolean) {
  if (variant === 'alert') return { bg: 'rgba(163,45,45,0.85)', label: 'Day 1' };
  if (variant === 'watch') return { bg: 'rgba(239,159,39,0.85)', label: 'Check' };
  return { bg: 'rgba(29,158,117,0.85)', label: isLast ? 'Today' : 'Same' };
}

function resolveTag(p: SpotSnapshot, idx: number, total: number): SpotChangeTag {
  if (p.change_tag) return p.change_tag;
  if (idx === 0) return 'alert';
  if (idx === total - 1) return 'same';
  return 'watch';
}

export function SpotTimelineStrip({ photos }: Props) {
  const cells = photos.length ? photos.slice(-4) : [];
  const padded = cells.length
    ? cells
    : ([null, null, null, null] as (SpotSnapshot | null)[]);

  return (
    <View style={styles.strip}>
      {(photos.length ? cells : padded).map((p, idx) => {
        const list = photos.length ? cells : [];
        const isLast = photos.length > 0 && idx === list.length - 1;
        const variant = p ? resolveTag(p, idx, list.length) : 'watch';
        const tag = tagStyle(variant, isLast);
        const imageUri = p?.thumbnail_url || p?.uri;
        return (
          <View key={p?.id ?? p?.date ?? `empty-${idx}`} style={styles.col}>
            <View style={[styles.cell, !p && styles.cellEmpty]}>
              {imageUri ? (
                <SessionImage uri={imageUri} style={styles.image} contentFit="cover" />
              ) : null}
              {p ? (
                <View style={[styles.tag, { backgroundColor: tag.bg }]}>
                  <Text style={styles.tagText}>{isLast ? 'Today' : idx === 0 ? 'Day 1' : 'Check'}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.day}>{p ? formatDayLabel(p.date, isLast) : '—'}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingBottom: 4 },
  col: { flex: 1, gap: 2 },
  cell: {
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: AppTokens.color.photoBg,
    position: 'relative',
    overflow: 'hidden',
  },
  cellEmpty: { backgroundColor: AppTokens.color.cream },
  image: { ...StyleSheet.absoluteFillObject, borderRadius: 8 },
  tag: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    zIndex: 2,
  },
  tagText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  day: { fontSize: 9, color: AppTokens.color.muted, textAlign: 'center' },
});
