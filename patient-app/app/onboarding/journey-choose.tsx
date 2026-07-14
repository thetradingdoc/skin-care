// PR1 soft-launch safety — 2026-07-12
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ToucheMarkCompact } from '@/components/ToucheMarkCompact';
import { ConsumerPrimaryButton } from '@/components/billing-ui';
import { JourneyModeCard } from '@/components/v3';
import { AppTokens } from '@/constants/appTokens';
import type { JourneyMode } from '@/lib/journey-mode-storage';
import { setJourneyProfile } from '@/lib/journey-mode-storage';
import { resolvePostAuthRoute } from '@/hooks/useOnboardingGate';
import { useToast } from '@/components/billing-feedback';
import { trackPortalEvent } from '@/lib/trackPortalEvent';

export default function JourneyChooseScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  // soft-launch default: routine. Revert when JOURNAL_MODE_STANDALONE=1 confirmed in prod.
  const [selected, setSelected] = useState<Set<JourneyMode>>(new Set(['routine']));
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
      const primary = modes.includes('watch')
        ? 'watch'
        : modes.includes('routine')
          ? 'routine'
          : modes.includes('spot')
            ? 'spot'
            : 'watch';
      const saved = await setJourneyProfile({
        modes,
        primary,
        chosenAt: new Date().toISOString(),
      });
      if (!saved) {
        showToast('Could not save your journey choice. Try again.', 'error');
        return;
      }
      trackPortalEvent('journey_choose_completed', { modes: modes.join(',') });
      router.replace(await resolvePostAuthRoute({ journeyModes: modes }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <ToucheMarkCompact height={28} style={styles.logo} />
          <Text style={styles.title}>What brings you here?</Text>
          <Text style={styles.sub}>Pick what fits — you can change it anytime.</Text>
        </View>

        <JourneyModeCard
          variant="watch"
          title="Keep a skin diary"
          subtitle={"One photo a day. See what's changing and find your triggers — no routine needed."}
          selected={selected.has('watch')}
          onPress={() => toggle('watch')}
        />
        <JourneyModeCard
          variant="routine"
          title="Improve my skin routine"
          subtitle="Product conflicts and a guided 12-week program."
          selected={selected.has('routine')}
          onPress={() => toggle('routine')}
        />
        <JourneyModeCard
          variant="spot"
          title="Watch a spot or mark"
          subtitle="Track a mole, growth, or area of concern over time."
          selected={selected.has('spot')}
          onPress={() => toggle('spot')}
        />

        <Text style={styles.footer}>You can enable more than one.</Text>

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
