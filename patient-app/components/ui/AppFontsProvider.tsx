import {
  useFonts,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import {
  Gloock_400Regular,
} from '@expo-google-fonts/gloock';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import React, { useEffect } from 'react';

import { V4DesignTokens } from '@/constants/v4DesignTokens';

type Props = { children: React.ReactNode };

/** v4.1 primary families (Poppins display / Manrope body). Legacy DMSans/Gloock still loaded for unmigrated screens. */
export const AppFontFamilies = {
  display: V4DesignTokens.font.display,
  body: V4DesignTokens.font.body,
  bodyMedium: V4DesignTokens.font.bodyMedium,
  bodySemiBold: V4DesignTokens.font.bodySemiBold,
  bodyBold: V4DesignTokens.font.bodyBold,
  legacyDisplay: 'Gloock_400Regular',
  legacyBody: 'DMSans_400Regular',
} as const;

/** Never gate first paint on fonts — load in background. */
export function AppFontsProvider({ children }: Props) {
  const [loaded, error] = useFonts({
    Poppins_800ExtraBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Gloock_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  useEffect(() => {
    if (error) console.warn('[AppFontsProvider] font load error', error);
    if (loaded) console.log('[AppFontsProvider] fonts ready (Poppins + Manrope + legacy)');
  }, [loaded, error]);

  return <>{children}</>;
}
