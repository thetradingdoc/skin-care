import { Redirect } from 'expo-router';
import React from 'react';

import { PROGRESS_HREF } from '@/constants/routes';

/** Legacy billing tab — hidden from consumer v3 shell. */
export default function MoneyRedirect() {
  return <Redirect href={PROGRESS_HREF} />;
}
