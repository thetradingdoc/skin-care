import { Redirect } from 'expo-router';

/** Legacy route — redirects to Home tab. */
export default function TodayRedirect() {
  return <Redirect href="/(tabs)/home" />;
}
