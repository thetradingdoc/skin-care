/**
 * Phase D / 0b — Legacy journal/routine compare retired.
 * Deep links to `/compare` redirect into facts mark-compare (or Track if no id).
 */
import { Redirect, useLocalSearchParams } from 'expo-router';

import { MARK_COMPARE_HREF, MARK_PICKER_HREF } from '@/constants/routes';

export default function CompareScreenRetired() {
  const params = useLocalSearchParams<{ compareGroupId?: string; spotId?: string }>();
  const id = String(params.compareGroupId || params.spotId || '').trim();
  if (id) {
    return (
      <Redirect
        href={{
          pathname: MARK_COMPARE_HREF,
          params: { compareGroupId: id },
        }}
      />
    );
  }
  return <Redirect href={MARK_PICKER_HREF} />;
}
