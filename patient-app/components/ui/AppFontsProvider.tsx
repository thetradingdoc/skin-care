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
import React, { useEffect } from 'react';

type Props = { children: React.ReactNode };

export const AppFontFamilies = {
  display: 'Gloock_400Regular',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemiBold: 'DMSans_600SemiBold',
  bodyBold: 'DMSans_700Bold',
} as const;

/** Never gate first paint on fonts — load in background. */
export function AppFontsProvider({ children }: Props) {
  const [loaded, error] = useFonts({
    Gloock_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  useEffect(() => {
    if (error) console.warn('[AppFontsProvider] font load error', error);
    if (loaded) console.log('[AppFontsProvider] fonts ready');
  }, [loaded, error]);

  return <>{children}</>;
}
