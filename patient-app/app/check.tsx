/**
 * Phase D — Check is retired as home / camera shell.
 * Deep links and stale CTAs redirect into the canonical capture path.
 */
import { Redirect } from 'expo-router';

import { CAPTURE_2A_HREF } from '@/constants/routes';

export default function CheckScreenRetired() {
  return <Redirect href={CAPTURE_2A_HREF} />;
}
