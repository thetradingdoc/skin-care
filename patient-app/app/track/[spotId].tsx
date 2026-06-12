import { useLocalSearchParams, useRouter } from 'expo-router';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';



import {

  DoctorAlertCard,

  GrowthSummaryCard,

  SpotTimelineStrip,

} from '@/components/v3';

import { AppTokens } from '@/constants/appTokens';
import { trackCaptureHref } from '@/constants/routes';

import {

  fetchSpotTimeline,

  getSpot,

  growthBarMetrics,

  spotDayCount,

  type Spot,

  type SpotSnapshot,

} from '@/lib/spot-store';



export default function SpotTimelineScreen() {

  const router = useRouter();

  const { spotId } = useLocalSearchParams<{ spotId: string }>();

  const [spot, setSpot] = useState<Spot | null>(null);

  const [snapshots, setSnapshots] = useState<SpotSnapshot[]>([]);



  const load = useCallback(async () => {

    if (typeof spotId !== 'string') return;

    const [spotRes, timelineRes] = await Promise.all([getSpot(spotId), fetchSpotTimeline(spotId)]);

    setSpot(spotRes);

    if (timelineRes?.snapshots?.length) {

      setSnapshots(timelineRes.snapshots);

    } else if (spotRes?.photos?.length) {

      setSnapshots(

        spotRes.photos.map((p) => ({

          date: p.date,

          uri: p.thumbnail_url || p.uri,

          thumbnail_url: p.thumbnail_url || p.uri,

          change_tag: p.change_tag ?? null,

          size_signal: p.size_signal ?? null,

        })),

      );

    } else {

      setSnapshots([]);

    }

  }, [spotId]);



  useEffect(() => {

    void load();

  }, [load]);



  const barMetrics = useMemo(() => growthBarMetrics(snapshots), [snapshots]);



  if (!spot) {

    return (

      <SafeAreaView style={styles.root}>

        <Text style={styles.loading}>Loading…</Text>

      </SafeAreaView>

    );

  }



  const days = spotDayCount(spot);

  const growthTitle = days < 7 ? 'Still gathering photos' : 'Size appears stable';

  const growthStatus = days < 7 ? 'watch' : days >= 14 ? 'stable' : 'watch';

  const growthNote =

    days < 7

      ? 'Take a few more photos on different days. Changes become visible over weeks, not days.'

      : 'No significant size change in recent photos. Colour may shift slightly. Keep tracking — compare photos side by side when you visit your doctor.';



  return (

    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>

      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.header}>

          <Pressable onPress={() => router.back()} accessibilityRole="button">

            <Text style={styles.back}>← Back</Text>

          </Pressable>

          <Text style={styles.kicker}>

            {spot.label} · {days} days

          </Text>

        </View>



        <Text style={styles.sectionTitle}>How has it changed?</Text>

        <SpotTimelineStrip photos={snapshots} />



        <GrowthSummaryCard

          title={growthTitle}

          days={days}

          status={growthStatus}

          note={growthNote}

          dayOnePct={barMetrics.dayOnePct}

          todayPct={barMetrics.todayPct}

          dayOneEndLabel={barMetrics.dayOneEndLabel}

          todayEndLabel={barMetrics.todayEndLabel}

        />



        {days >= 7 ? (

          <DoctorAlertCard

            days={days}

            onFindDoctor={() => void Linking.openURL('https://www.aad.org/public/diseases')}

          />

        ) : null}



        <Pressable

          style={styles.addBtn}

          onPress={() => router.push(trackCaptureHref(spot.id))}

          accessibilityRole="button">

          <Text style={styles.addBtnText}>Add another photo</Text>

        </Pressable>

      </ScrollView>

    </SafeAreaView>

  );

}



const styles = StyleSheet.create({

  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },

  content: { paddingBottom: 40 },

  loading: { padding: 20, color: AppTokens.color.muted },

  header: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    paddingHorizontal: 14,

    paddingTop: 8,

  },

  back: { fontSize: 12, color: AppTokens.color.muted },

  kicker: { fontSize: 12, color: AppTokens.color.muted },

  sectionTitle: {

    fontSize: 14,

    fontWeight: '600',

    color: AppTokens.color.ink,

    paddingHorizontal: 14,

    paddingVertical: 10,

  },

  addBtn: {

    marginHorizontal: 14,

    marginTop: 8,

    paddingVertical: 13,

    backgroundColor: AppTokens.color.fabBg,

    borderRadius: 14,

    alignItems: 'center',

    minHeight: AppTokens.minTap,

    justifyContent: 'center',

  },

  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },

});

