import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandWordmark } from '@/components/BrandWordmark';
import { ConsumerPrimaryButton } from '@/components/billing-ui';
import { JourneyModeCard } from '@/components/v3';
import { AppTokens } from '@/constants/appTokens';
import type { JourneyMode } from '@/lib/journey-mode-storage';
import { setJourneyProfile } from '@/lib/journey-mode-storage';
import { resolvePostAuthRoute } from '@/hooks/useOnboardingGate';
import { useToast } from '@/components/billing-feedback';

export default function JourneyChooseScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<Set<JourneyMode>>(new Set(['watch']));
  const [busy, setBusy] = useState(false);

  const toggle = (mode: JourneyMode) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(mode)) {
        if (next.size > 1) next.delete(mode);
      } else {
        next.add(mode);
      }
      return next;
    });
  };

  const continueNext = async () => {
    setBusy(true);
    try {
      const modes = Array.from(selected);
      const primary = modes.includes('watch') ? 'watch' : 'routine';
      const saved = await setJourneyProfile({
        modes,
        primary,
        chosenAt: new Date().toISOString(),
      });
      if (!saved) {
        showToast('Could not save your journey choice. Try again.', 'error');
        return;
      }
      router.replace(await resolvePostAuthRoute({ journeyModes: modes }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <BrandWordmark height={36} style={styles.logo} />
          <Text style={styles.title}>What brings you here?</Text>
          <Text style={styles.sub}>We&apos;ll set up the right experience for you</Text>
        </View>

        <JourneyModeCard
          variant="watch"
          title="Watch something on my skin"
          subtitle="A spot, growth, mole, or mark I want to track over time"
          selected={selected.has('watch')}
          onPress={() => toggle('watch')}
        />
        <JourneyModeCard
          variant="routine"
          title="Improve my skin routine"
          subtitle="Track acne, check if products clash, follow a program"
          selected={selected.has('routine')}
          onPress={() => toggle('routine')}
        />

        <Text style={styles.footer}>
          You can use both at the same time.{'\n'}Most people do.
        </Text>

        <ConsumerPrimaryButton
          label={busy ? 'Setting up…' : 'Continue'}
          onPress={() => void continueNext()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  content: {
    paddingHorizontal: AppTokens.spacing.lg,
    paddingTop: 72,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 4,
  },
  logo: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: AppTokens.font.display,
    fontSize: 26,
    color: AppTokens.color.ink,
    textAlign: 'center',
    marginBottom: 6,
  },
  sub: {
    fontSize: 13,
    color: AppTokens.color.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  footer: {
    fontSize: 11,
    color: AppTokens.color.muted,
    textAlign: 'center',
    lineHeight: 17,
    marginVertical: 16,
  },
});
