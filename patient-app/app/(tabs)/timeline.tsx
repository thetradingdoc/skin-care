import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';

import { CHECK_HREF, PROGRESS_HREF } from '@/constants/routes';

/** Legacy journal route — redirect to Proof/Progress (or Check for a specific day). */
export default function TimelineRedirect() {
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const raw = Array.isArray(params.date) ? params.date[0] : params.date;
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return <Redirect href={`${CHECK_HREF}?date=${raw}` as typeof CHECK_HREF} />;
  }
  return <Redirect href={PROGRESS_HREF} />;
}
