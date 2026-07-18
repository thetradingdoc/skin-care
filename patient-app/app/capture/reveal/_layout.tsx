import { Stack } from 'expo-router';

import { AppTokens } from '@/constants/appTokens';

/** P7.18–23 — six separate reveal routes (not one tag-switch template). */
export default function CaptureRevealLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: AppTokens.color.pageBg },
      }}>
      <Stack.Screen name="skin" />
      <Stack.Screen name="bill" />
      <Stack.Screen name="rx" />
      <Stack.Screen name="mark" />
      <Stack.Screen name="lab" />
      <Stack.Screen name="other" />
    </Stack>
  );
}
