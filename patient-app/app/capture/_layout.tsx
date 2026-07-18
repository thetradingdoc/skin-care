import { Stack } from 'expo-router';

import { AppTokens } from '@/constants/appTokens';

export default function CaptureLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: AppTokens.color.pageBg },
      }}
    />
  );
}
