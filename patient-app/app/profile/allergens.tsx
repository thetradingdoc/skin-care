/**
 * P7.40 — Profile allergens management (dedicated screen).
 */
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  SecondTierChrome,
  TierPrimary,
} from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { PROFILE_HREF } from '@/constants/routes';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { patientGet, patientPost } from '@/lib/patient-api';

const PRESETS = [
  { allergen_class: 'acrylates', label: 'acrylates' },
  { allergen_class: 'fragrance', label: 'fragrance' },
  { allergen_class: 'essential_oils', label: 'essential oils' },
  { allergen_class: 'alcohol', label: 'alcohol' },
];

export default function ProfileAllergensScreen() {
  const { ready } = useRequirePatientSession();
  const router = useRouter();
  const [selected, setSelected] = useState<Array<{ allergen_class: string; label: string }>>([]);
  const [freeform, setFreeform] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const al = await patientGet('/api/patient/allergens').catch(() => null);
    const list = Array.isArray(al?.allergens) ? al.allergens : [];
    setSelected(
      list.map((a: { allergen_class: string; label?: string }) => ({
        allergen_class: a.allergen_class,
        label: a.label || a.allergen_class,
      })),
    );
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const toggle = (item: { allergen_class: string; label: string }) => {
    setSelected((prev) => {
      const hit = prev.some((p) => p.allergen_class === item.allergen_class);
      return hit
        ? prev.filter((p) => p.allergen_class !== item.allergen_class)
        : [...prev, item];
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await patientPost('/api/patient/allergens', { allergens: selected });
      router.replace(PROFILE_HREF);
    } catch {
      /* stay on screen */
    } finally {
      setSaving(false);
    }
  };

  return (
    <SecondTierChrome testID="screen-profile-allergens">
      <View>
        <Text style={styles.title} testID="profile-allergens-title">
          Allergens
        </Text>
        <Text style={styles.sub}>Things you want ruled out of product checks.</Text>
        <View style={styles.chips}>
          {PRESETS.map((p) => {
            const on = selected.some((s) => s.allergen_class === p.allergen_class);
            return (
              <Pressable
                key={p.allergen_class}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => toggle(p)}
                testID={`profile-allergen-${p.allergen_class}`}>
                <Text style={styles.chipLabel}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          style={styles.input}
          value={freeform}
          onChangeText={setFreeform}
          placeholder="Add another"
          testID="profile-allergen-freeform"
          onSubmitEditing={() => {
            const label = freeform.trim();
            if (!label) return;
            const allergen_class = label.toLowerCase().replace(/\s+/g, '_').slice(0, 64);
            toggle({ allergen_class, label });
            setFreeform('');
          }}
        />
      </View>
      <TierPrimary
        label={saving ? 'Saving…' : 'Save allergens'}
        testID="profile-allergens-save"
        onPress={() => void save()}
      />
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 8 },
  sub: { fontSize: 15, color: AppTokens.color.muted, marginBottom: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: AppTokens.color.cream,
  },
  chipOn: { backgroundColor: AppTokens.color.cardRed },
  chipLabel: { fontWeight: '600', color: AppTokens.color.ink },
  input: {
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    borderRadius: 10,
    padding: 12,
  },
});
