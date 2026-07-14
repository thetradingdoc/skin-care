import { Redirect } from 'expo-router';

import { CHECK_HREF } from '@/constants/routes';

/** Legacy route — redirects to Check (sole home). */
export default function TodayRedirect() {
  return <Redirect href={CHECK_HREF} />;
}
