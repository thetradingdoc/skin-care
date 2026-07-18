/**
 * P7.44 — Track AI-reads-left chip (distinct from Profile meter / T6/T8).
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppTokens } from '@/constants/appTokens';
import { patientGet } from '@/lib/patient-api';

export const AI_READS_CHIP_API = '/api/patient/ai/usage';

export function TrackAiReadsChip() {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const usage = await patientGet(AI_READS_CHIP_API);
        const used = Number(usage?.monthly_used ?? usage?.used ?? 0);
        const limit = Number(usage?.monthly_limit ?? usage?.limit ?? 20);
        const left = Math.max(0, limit - used);
        setLabel(`${left} AI reads left`);
      } catch {
        setLabel(null);
      }
    })();
  }, []);

  if (!label) return null;

  return (
    <View style={styles.chip} testID="track-ai-reads-left-chip">
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: AppTokens.color.infoBlue,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  label: { fontSize: 13, fontWeight: '600', color: AppTokens.color.infoBlueText },
});
