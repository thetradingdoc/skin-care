import { Redirect } from 'expo-router';
import React from 'react';

import { PROGRESS_HREF } from '@/constants/routes';

/** Legacy billing quick-capture entry — not in consumer v3. */
export default function ScanEntryRedirect() {
  return <Redirect href={PROGRESS_HREF} />;
}
