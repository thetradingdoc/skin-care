import '@/lib/capture-fatal';
import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { BillingFeedbackProvider } from '@/components/billing-feedback';
import { AppFontsProvider } from '@/components/ui/AppFontsProvider';
import { SkinCareNavigationTheme } from '@/constants/navigationTheme';
import { patientPostPublic } from '@/lib/patient-api';
import { setPatientSession } from '@/lib/patient-session';
import { SIGN_IN_HREF } from '@/constants/routes';
import { resolvePostAuthRoute } from '@/hooks/useOnboardingGate';
import { registerSessionExpiredHandler } from '@/lib/patient-auth';

// Do NOT call preventAutoHideAsync — that left the logo splash stuck on device.
void SplashScreen.hideAsync().catch(() => undefined);

export const unstable_settings = {
  anchor: '(tabs)',
};

function useSessionExpiryRedirect() {
  const router = useRouter();
  useEffect(() => {
    return registerSessionExpiredHandler(() => {
      router.replace(SIGN_IN_HREF);
    });
  }, [router]);
}

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
          router.replace(await resolvePostAuthRoute());
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
  useSessionExpiryRedirect();
  useAppDeepLinks();

  useEffect(() => {
    let cancelled = false;
    const hide = () => {
      if (cancelled) return;
      void SplashScreen.hideAsync().catch(() => undefined);
    };
    hide();
    // Fonts / first paint can race native splash — force-dismiss shortly after.
    const t1 = setTimeout(hide, 500);
    const t2 = setTimeout(hide, 2000);
    const t3 = setTimeout(hide, 4000);
    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Always light navigation chrome — DarkTheme + empty root looked like a black
  // screen on dark-mode iPhones when JS stalled.
  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <AppFontsProvider>
        <ThemeProvider value={SkinCareNavigationTheme}>
          <BillingFeedbackProvider>
            <Stack
              screenOptions={{
                contentStyle: { backgroundColor: '#FFFFFF' },
                headerStyle: { backgroundColor: '#FFFFFF' },
              }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen
                name="sign-in"
                options={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }}
              />
              <Stack.Screen name="checkout-chat" options={{ presentation: 'modal', title: 'Checkout chat' }} />
              <Stack.Screen name="scan-entry" options={{ presentation: 'modal', title: 'Quick capture' }} />
              <Stack.Screen name="capture-scan" options={{ presentation: 'modal', title: 'Scan receipt' }} />
              <Stack.Screen name="capture-upload" options={{ presentation: 'modal', title: 'Upload EOB/PDF' }} />
              <Stack.Screen name="capture-manual-bill" options={{ presentation: 'modal', title: 'Add bill manually' }} />
              <Stack.Screen name="capture-manual-payment" options={{ presentation: 'modal', title: 'Add payment manually' }} />
              <Stack.Screen name="capture-review" options={{ presentation: 'modal', title: 'Review extraction' }} />
              <Stack.Screen name="capture-complete" options={{ presentation: 'modal', title: 'Saved' }} />
              <Stack.Screen name="routine" options={{ headerShown: false }} />
              <Stack.Screen name="track" options={{ headerShown: false }} />
              <Stack.Screen name="verdict" options={{ headerShown: false }} />
              <Stack.Screen name="compare" options={{ presentation: 'modal', title: 'Compare photos' }} />
            </Stack>
            <StatusBar style="dark" />
          </BillingFeedbackProvider>
        </ThemeProvider>
      </AppFontsProvider>
    </View>
  );
}
