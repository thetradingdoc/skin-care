/**
 * Phase D — Legacy spot detail retired.
 * Deep links `/track/:spotId` redirect into marks compare-group (facts SSOT).
 * spotId is treated as compare_group_id (same id space after dual-write era).
 */
import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';

import { MARK_COMPARE_HREF, TRACK_HREF } from '@/constants/routes';

export default function SpotDetailRetired() {
  const { spotId } = useLocalSearchParams<{ spotId: string }>();
  const id = typeof spotId === 'string' ? spotId.trim() : '';
  if (!id) {
    return <Redirect href={TRACK_HREF} />;
  }
  return (
    <Redirect
      href={{
        pathname: MARK_COMPARE_HREF,
        params: { compareGroupId: id },
      }}
    />
  );
}
