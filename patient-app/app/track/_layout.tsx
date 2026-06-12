import { Stack } from 'expo-router';

import { AppTokens } from '@/constants/appTokens';

export default function TrackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: AppTokens.color.pageBg },
      }}>
      <Stack.Screen name="capture" />
      <Stack.Screen name="[spotId]" />
    </Stack>
  );
}
