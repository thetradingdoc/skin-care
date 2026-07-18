import { Stack } from 'expo-router';
import React from 'react';

/** Nested shop routes inherit headerShown:false — SSR must match client (React #418). */
export default function ShopLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }} />;
}
