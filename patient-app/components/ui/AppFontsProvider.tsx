import {
  useFonts,
  Gloock_400Regular,
} from '@expo-google-fonts/gloock';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import React from 'react';
import { View } from 'react-native';

type Props = { children: React.ReactNode };

export const AppFontFamilies = {
  display: 'Gloock_400Regular',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemiBold: 'DMSans_600SemiBold',
  bodyBold: 'DMSans_700Bold',
} as const;

export function AppFontsProvider({ children }: Props) {
  const [loaded] = useFonts({
    Gloock_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  if (!loaded) {
    return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;
  }

  return <>{children}</>;
}
