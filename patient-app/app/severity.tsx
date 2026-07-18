/**
 * Phase D — Severity sheet retired with Check.
 * Journal daily-entry writes no longer have a product entry path here.
 */
import { Redirect } from 'expo-router';

import { CAPTURE_2A_HREF } from '@/constants/routes';

export default function SeverityScreenRetired() {
  return <Redirect href={CAPTURE_2A_HREF} />;
}
