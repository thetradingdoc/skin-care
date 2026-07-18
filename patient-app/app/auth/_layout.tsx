import { Stack } from 'expo-router';

import { AppTokens } from '@/constants/appTokens';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: AppTokens.color.pageBg },
      }}>
      <Stack.Screen name="otp-entry" />
      <Stack.Screen name="otp-error" />
    </Stack>
  );
}
