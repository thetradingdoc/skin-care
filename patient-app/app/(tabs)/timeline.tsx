import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';

import { HOME_HREF, PROGRESS_HREF } from '@/constants/routes';

/** Legacy journal route — redirect to v3 Progress (or Home for a specific day). */
export default function TimelineRedirect() {
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const raw = Array.isArray(params.date) ? params.date[0] : params.date;
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return <Redirect href={`${HOME_HREF}?date=${raw}` as typeof HOME_HREF} />;
  }
  return <Redirect href={PROGRESS_HREF} />;
}
