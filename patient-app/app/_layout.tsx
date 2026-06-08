import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { BillingFeedbackProvider } from '@/components/billing-feedback';
import { SkinCareNavigationTheme } from '@/constants/navigationTheme';
import { patientPostPublic } from '@/lib/patient-api';
import { setPatientSession } from '@/lib/patient-session';
import { patientGet } from '@/lib/patient-api';
import { SIGN_IN_HREF, INDEX_HREF, TODAY_HREF } from '@/constants/routes';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

function useAppDeepLinks() {
  const router = useRouter();
  useEffect(() => {
    const handle = async (url: string | null) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      const path = String(parsed.path || '');
      const ticket = typeof parsed.queryParams?.ticket === 'string' ? parsed.queryParams.ticket : null;

      if (path === 'auth' || path.includes('auth')) {
        if (!ticket) return;
        try {
          const exchanged = await patientPostPublic('/api/patient/auth/handoff/exchange', { ticket });
          const sid = String(exchanged.session_id || '');
          if (!sid) return;
          await setPatientSession(sid);
          const template = await patientGet('/api/patient/routine/template').catch(() => ({ has_template: false }));
          if (template?.has_template) {
            router.replace(TODAY_HREF);
          } else {
            router.replace(INDEX_HREF);
          }
        } catch {
          router.replace(SIGN_IN_HREF);
        }
        return;
      }

      if (path === 'subscription/success' || path.includes('subscription/success')) {
        router.replace({ pathname: '/(tabs)/account', params: { subscription: 'success' } });
        return;
      }
      if (path === 'subscription/cancel' || path.includes('subscription/cancel')) {
        router.replace({ pathname: '/(tabs)/account', params: { subscription: 'cancel' } });
        return;
      }

      if (path !== 'routine/setup' && !path.includes('routine/setup')) return;
      const concern = typeof parsed.queryParams?.concern === 'string' ? parsed.queryParams.concern : 'acne';
      router.push({ pathname: '/routine/setup', params: { concern } });
    };
    void Linking.getInitialURL().then((u) => void handle(u));
    const sub = Linking.addEventListener('url', ({ url }) => void handle(url));
    return () => sub.remove();
  }, [router]);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useAppDeepLinks();

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : SkinCareNavigationTheme}>
      <BillingFeedbackProvider>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen name="checkout-chat" options={{ presentation: 'modal', title: 'Checkout chat' }} />
          <Stack.Screen name="scan-entry" options={{ presentation: 'modal', title: 'Quick capture' }} />
          <Stack.Screen name="capture-scan" options={{ presentation: 'modal', title: 'Scan receipt' }} />
          <Stack.Screen name="capture-upload" options={{ presentation: 'modal', title: 'Upload EOB/PDF' }} />
          <Stack.Screen name="capture-manual-bill" options={{ presentation: 'modal', title: 'Add bill manually' }} />
          <Stack.Screen name="capture-manual-payment" options={{ presentation: 'modal', title: 'Add payment manually' }} />
          <Stack.Screen name="capture-review" options={{ presentation: 'modal', title: 'Review extraction' }} />
          <Stack.Screen name="capture-complete" options={{ presentation: 'modal', title: 'Saved' }} />
          <Stack.Screen name="routine" options={{ headerShown: false }} />
          <Stack.Screen name="compare" options={{ presentation: 'modal', title: 'Compare photos' }} />
        </Stack>
        <StatusBar style="auto" />
      </BillingFeedbackProvider>
    </ThemeProvider>
  );
}
