import { Stack } from 'expo-router';
import { AppTokens } from '@/constants/appTokens';
export default function ConfirmLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: AppTokens.color.pageBg } }} />;
}
