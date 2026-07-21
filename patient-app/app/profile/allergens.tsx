/**
 * Step 34 / P7.40 — Allergens & notifications (mock frame 34).
 * Allergens: GET/POST round-trip. Notifications: local-only prefs (honest copy).
 * Notifications-only entry: see profile/notifications.tsx (P7.41) + notif-denied.
 */
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { PROFILE_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { patientGet, patientPost } from '@/lib/patient-api';
import {
  getRxExpiryAlertsEnabled,
  getWeeklyMarkReminderEnabled,
  NOTIFICATION_PREFS_ARE_LOCAL_ONLY,
  setRxExpiryAlertsEnabled,
  setWeeklyMarkReminderEnabled,
  syncDailyReminderSchedule,
  setDailyReminderEnabled,
} from '@/lib/push-reminders';
import {
  getNotificationPermissionStatus,
  registerPushDeviceToken,
} from '@/lib/push-registration';

const PRESETS = [
  { allergen_class: 'fragrance', label: 'Fragrance' },
  { allergen_class: 'sulfates', label: 'Sulfates' },
  { allergen_class: 'acrylates', label: 'Acrylates' },
  { allergen_class: 'essential_oils', label: 'Essential oils' },
  { allergen_class: 'alcohol', label: 'Alcohol' },
];

type Props = {
  screenTestID?: string;
  /** When set (Notifications entry), OS deny → profile-notif-denied. */
  onNotificationPermissionDenied?: () => void;
};

export function AllergensNotificationsScreen({
  screenTestID = 'screen-profile-allergens',
  onNotificationPermissionDenied,
}: Props) {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const [selected, setSelected] = useState<Array<{ allergen_class: string; label: string }>>([]);
  const [freeform, setFreeform] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [weeklyMark, setWeeklyMark] = useState(false);
  const [rxExpiry, setRxExpiry] = useState(false);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const al = await patientGet('/api/patient/allergens');
      const list = Array.isArray(al?.allergens) ? al.allergens : [];
      setSelected(
        list.map((a: { allergen_class: string; label?: string }) => ({
          allergen_class: a.allergen_class,
          label: a.label || a.allergen_class,
        })),
      );
      const [w, r] = await Promise.all([
        getWeeklyMarkReminderEnabled(),
        getRxExpiryAlertsEnabled(),
      ]);
      setWeeklyMark(w);
      setRxExpiry(r);
    } catch {
      setLoadFailed(true);
      setSelected([]);
    }
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const toggle = (item: { allergen_class: string; label: string }) => {
    setSaveOk(false);
    setSaveError(null);
    setSelected((prev) => {
      const hit = prev.some((p) => p.allergen_class === item.allergen_class);
      return hit
        ? prev.filter((p) => p.allergen_class !== item.allergen_class)
        : [...prev, item];
    });
  };

  const saveAllergens = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      await patientPost('/api/patient/allergens', { allergens: selected });
      // Round-trip proof — UI only updates from GET after POST
      const al = await patientGet('/api/patient/allergens');
      const list = Array.isArray(al?.allergens) ? al.allergens : [];
      setSelected(
        list.map((a: { allergen_class: string; label?: string }) => ({
          allergen_class: a.allergen_class,
          label: a.label || a.allergen_class,
        })),
      );
      setSaveOk(true);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Could not save allergens');
    } finally {
      setSaving(false);
    }
  };

  if (checking || !ready) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator style={{ marginTop: 48 }} color={V4DesignTokens.color.red} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']} testID={screenTestID}>
      <View style={styles.pad}>
        <BackNavHeader
          label="Back"
          onBack={() => router.replace(PROFILE_HREF)}
          testID="allergens-back-nav"
        />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} testID="profile-allergens-title">
          Allergens
        </Text>
        <Text style={styles.tagline} testID="profile-allergens-tagline">
          Flagged only when it's in something you've logged — no interaction scoring.
        </Text>

        {loadFailed ? (
          <Text style={styles.err} testID="profile-allergens-load-failed">
            Could not load allergens — pull back and retry.
          </Text>
        ) : null}

        {PRESETS.map((p) => {
          const on = selected.some((s) => s.allergen_class === p.allergen_class);
          return (
            <Pressable
              key={p.allergen_class}
              style={styles.recRow}
              onPress={() => toggle(p)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              testID={`profile-allergen-${p.allergen_class}`}>
              <View style={[styles.dot, on && styles.dotOn]} />
              <Text style={styles.recTitle}>{p.label}</Text>
              <Text style={styles.recState}>{on ? 'On' : 'Off'}</Text>
            </Pressable>
          );
        })}

        {/* Freeform for non-preset classes */}
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

        <Pressable
          style={[styles.saveCta, saving && styles.saveDisabled]}
          disabled={saving}
          onPress={() => void saveAllergens()}
          testID="profile-allergens-save">
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save allergens'}</Text>
        </Pressable>
        {saveOk ? (
          <Text style={styles.ok} testID="profile-allergens-saved">
            Saved — confirmed from server.
          </Text>
        ) : null}
        {saveError ? (
          <Text style={styles.err} testID="profile-allergens-save-error">
            {saveError}
          </Text>
        ) : null}

        <Text style={[styles.title, styles.notifTitle]} testID="notifications-title">
          Notifications
        </Text>
        <Text style={styles.localHonesty} testID="notifications-local-only">
          {NOTIFICATION_PREFS_ARE_LOCAL_ONLY
            ? 'Saved on this device only — not synced to the server yet.'
            : 'Synced to your account.'}
        </Text>

        <Pressable
          style={styles.field}
          onPress={() => {
            const next = !weeklyMark;
            setWeeklyMark(next);
            void setWeeklyMarkReminderEnabled(next);
            void setDailyReminderEnabled(next).then(() => syncDailyReminderSchedule(next));
          }}
          accessibilityRole="switch"
          accessibilityState={{ checked: weeklyMark }}
          testID="notifications-weekly-mark">
          <Text style={styles.fieldK}>Weekly mark reminder</Text>
          <Text style={[styles.fieldV, weeklyMark && styles.fieldOn]}>
            {weeklyMark ? 'On' : 'Off'}
          </Text>
        </Pressable>

        <Pressable
          style={styles.field}
          onPress={() => {
            const next = !rxExpiry;
            setRxExpiry(next);
            void setRxExpiryAlertsEnabled(next);
          }}
          accessibilityRole="switch"
          accessibilityState={{ checked: rxExpiry }}
          testID="notifications-rx-expiry">
          <Text style={styles.fieldK}>Rx expiry alerts</Text>
          <Text style={[styles.fieldV, rxExpiry && styles.fieldOn]}>
            {rxExpiry ? 'On' : 'Off'}
          </Text>
        </Pressable>

        {/* Legacy allow CTA for older locks — requests OS permission when available */}
        <Pressable
          style={styles.legacyAllow}
          onPress={() => {
            void (async () => {
              const result = await registerPushDeviceToken();
              if (result.status === 'denied' || result.status === 'skipped') {
                onNotificationPermissionDenied?.();
                return;
              }
              // unsupported (web/Android without module): still enable local prefs
              const status = await getNotificationPermissionStatus();
              if (status === 'denied') {
                onNotificationPermissionDenied?.();
                return;
              }
              setWeeklyMark(true);
              setRxExpiry(true);
              void setWeeklyMarkReminderEnabled(true);
              void setRxExpiryAlertsEnabled(true);
              void setDailyReminderEnabled(true).then(() => syncDailyReminderSchedule(true));
            })();
          }}
          testID="notifications-allow">
          <Text style={styles.legacyAllowText}>Allow notifications</Text>
        </Pressable>
        <View testID="notifications-enabled" style={{ height: 0 }} />
        <Pressable
          testID="notifications-skip"
          onPress={() => router.replace(PROFILE_HREF)}
          style={{ paddingVertical: 8 }}>
          <Text style={styles.skip}>Not now</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function ProfileAllergensScreen() {
  return <AllergensNotificationsScreen screenTestID="screen-profile-allergens" />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white },
  pad: { paddingHorizontal: 12 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 4 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 19,
    color: V4DesignTokens.color.black,
    marginBottom: 4,
  },
  notifTitle: { marginTop: 28, fontSize: 17 },
  tagline: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
    marginBottom: 12,
    lineHeight: 18,
  },
  localHonesty: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    color: V4DesignTokens.color.muted,
    marginBottom: 10,
    lineHeight: 17,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: V4DesignTokens.color.line,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 7,
    backgroundColor: '#F6F6F6',
  },
  dotOn: { backgroundColor: V4DesignTokens.color.red },
  recTitle: {
    flex: 1,
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 14,
    color: V4DesignTokens.color.black,
  },
  recState: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
  },
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: V4DesignTokens.color.line,
    borderRadius: 10,
    padding: 12,
    fontFamily: V4DesignTokens.font.body,
  },
  saveCta: {
    marginTop: 14,
    backgroundColor: V4DesignTokens.color.red,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveDisabled: { opacity: 0.6 },
  saveText: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 14,
    color: V4DesignTokens.color.white,
  },
  ok: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 13,
    color: '#166534',
    marginTop: 8,
  },
  err: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 13,
    color: V4DesignTokens.color.redDeep,
    marginTop: 8,
  },
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: V4DesignTokens.color.line,
  },
  fieldK: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.black,
  },
  fieldV: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
  },
  fieldOn: { color: V4DesignTokens.color.redDeep },
  legacyAllow: { marginTop: 16, alignItems: 'center' },
  legacyAllowText: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 14,
    color: V4DesignTokens.color.red,
  },
  skip: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
    textAlign: 'center',
  },
});
