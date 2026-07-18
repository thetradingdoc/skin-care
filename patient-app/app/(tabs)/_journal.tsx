/**
 * Phase D — Journal tab RETIRED.
 *
 * Decision: remove from all product paths. Calendar (facts), Track (marks),
 * and Progress (aggregates) cover the history surfaces this tab owned.
 * Deep links to `/_journal` redirect to Calendar — they must not silently
 * keep serving the legacy journal UI.
 */
import { Redirect } from 'expo-router';

import { CALENDAR_HREF } from '@/constants/routes';

export default function JournalTabRetired() {
  return <Redirect href={CALENDAR_HREF} />;
}
