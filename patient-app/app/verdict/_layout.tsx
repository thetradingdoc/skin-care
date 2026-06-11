import { Stack } from 'expo-router';

export default function VerdictLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, title: 'Verdict' }}>
      <Stack.Screen name="[productId]" />
    </Stack>
  );
}
