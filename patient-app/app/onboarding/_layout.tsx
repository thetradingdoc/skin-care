import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="journey-choose" />
      <Stack.Screen name="scan" />
      <Stack.Screen name="reveal" />
      <Stack.Screen name="concerns" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="bio-calibration" />
    </Stack>
  );
}
