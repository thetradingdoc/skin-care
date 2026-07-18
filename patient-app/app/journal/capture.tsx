/**
 * Phase D — Journal capture retired (legacy daily photo → journal API).
 * Redirect into canonical /capture; do not write journal daily-entry.
 */
import { Redirect } from 'expo-router';

import { CAPTURE_2A_HREF } from '@/constants/routes';

export default function JournalCaptureRetired() {
  return <Redirect href={CAPTURE_2A_HREF} />;
}
