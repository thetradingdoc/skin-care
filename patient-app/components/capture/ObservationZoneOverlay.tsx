/**
 * Approximate named-zone overlay on a capture photo.
 * Face landmarks are layout anchors — not model pixel boxes.
 * Props accept VisualPointer only (no score/% fields exist on the type).
 */
import React, { useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
} from 'react-native';

import { AppTokens } from '@/constants/appTokens';
import {
  APPROXIMATE_REGION_CAPTION,
  FACE_ZONE_LAYOUT,
  type VisualPointer,
  type VisualPointerZone,
} from '@/lib/visual-observation-pointer';

type Props = {
  imageUri: string | null | undefined;
  pointer: VisualPointer | null | undefined;
  testID?: string;
  /** Side-by-side compare uses a shorter frame */
  compact?: boolean;
  imageStyle?: StyleProp<ImageStyle>;
};

function ZoneEllipses({
  zones,
  width,
  height,
}: {
  zones: VisualPointerZone[];
  width: number;
  height: number;
}) {
  if (width <= 0 || height <= 0) return null;
  return (
    <>
      {zones.map((zone) => {
        const layout = FACE_ZONE_LAYOUT[zone];
        if (!layout) return null;
        const w = layout.rx * 2 * width;
        const h = layout.ry * 2 * height;
        const left = layout.cx * width - w / 2;
        const top = layout.cy * height - h / 2;
        return (
          <View
            key={zone}
            testID={`zone-marker-${zone}`}
            pointerEvents="none"
            style={[
              styles.ellipse,
              {
                left,
                top,
                width: w,
                height: h,
                borderRadius: Math.max(w, h) / 2,
              },
            ]}
          />
        );
      })}
    </>
  );
}

export function ObservationZoneOverlay({
  imageUri,
  pointer,
  testID = 'observation-zone-overlay',
  compact = false,
  imageStyle,
}: Props) {
  const frameH = compact ? 160 : 220;
  const [frameW, setFrameW] = useState(compact ? 140 : 280);
  const zones = pointer?.zones?.length ? pointer.zones : [];
  const labels = pointer?.zone_labels?.length ? pointer.zone_labels : [];
  // Face ellipses only when we have face-named zones — never invent landmarks on body photos.
  const faceZones = zones.filter((z) => Boolean(FACE_ZONE_LAYOUT[z]));
  const showFaceEllipses = faceZones.length > 0;
  const showCenterFallback = Boolean(pointer && !showFaceEllipses && (labels.length > 0 || zones.length === 0));
  const hasPointer = Boolean(pointer && (faceZones.length || labels.length || showCenterFallback));

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - frameW) > 0.5) setFrameW(w);
  };

  if (!imageUri) {
    return (
      <View style={[styles.frame, { height: frameH, width: '100%' }]} testID={testID}>
        <Text style={styles.missing}>Photo preview unavailable</Text>
        {hasPointer ? (
          <Text style={styles.caption} testID={`${testID}-caption`}>
            {APPROXIMATE_REGION_CAPTION}
            {labels.length ? ` · ${labels.join(', ')}` : ''}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={[styles.frame, { height: frameH }]} onLayout={onLayout}>
        <Image
          source={{ uri: imageUri }}
          style={[styles.image, { height: frameH }, imageStyle]}
          resizeMode="cover"
          testID={`${testID}-image`}
        />
        {showFaceEllipses ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none" testID={`${testID}-markers`}>
            <ZoneEllipses zones={faceZones} width={frameW} height={frameH} />
          </View>
        ) : null}
        {showCenterFallback ? (
          <View style={styles.centerMark} testID={`${testID}-center-mark`} pointerEvents="none">
            <View style={styles.centerRing} />
          </View>
        ) : null}
      </View>
      {hasPointer ? (
        <Text style={styles.caption} testID={`${testID}-caption`}>
          {APPROXIMATE_REGION_CAPTION}
          {labels.length ? ` · ${labels.slice(0, 3).join(', ')}` : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  frame: {
    width: '100%',
    maxWidth: 280,
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: AppTokens.color.line,
    position: 'relative',
  },
  image: { width: '100%' },
  ellipse: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: AppTokens.color.fabBg,
    backgroundColor: 'rgba(45, 106, 79, 0.18)',
  },
  centerMark: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: AppTokens.color.fabBg,
    backgroundColor: 'rgba(45, 106, 79, 0.18)',
  },
  caption: {
    marginTop: 6,
    fontSize: 12,
    color: AppTokens.color.muted,
    textAlign: 'center',
  },
  missing: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: AppTokens.color.muted,
    padding: 16,
    fontSize: 13,
  },
});
