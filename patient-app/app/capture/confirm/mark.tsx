/**
 * P7.05 / APP-04 — Confirm 5-mark — TemplateFieldsForm SSOT + zone overlay.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ObservationZoneOverlay } from '@/components/capture/ObservationZoneOverlay';
import { TemplateFieldsForm } from '@/components/capture/TemplateFieldsForm';
import { SecondTierChrome, TierPrimary } from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { getTemplateForDraft } from '@/lib/record-field-templates';
import { useCaptureConfirm } from '@/lib/use-capture-confirm';
import { visualPointerFromDraft } from '@/lib/visual-observation-pointer';

export default function ConfirmMarkScreen() {
  const { pending, draft, busy, error, setField, submitLooksRight, loaded } =
    useCaptureConfirm('mark');
  const template = getTemplateForDraft('mark', draft);
  const pointer = visualPointerFromDraft(draft);
  const previewUri = pending?.preview_uri || null;
  const absent = Array.isArray(draft.fields_absent)
    ? (draft.fields_absent as string[])
    : [];

  return (
    <SecondTierChrome testID="confirm-5-mark">
      <View>
        <Text style={styles.h}>Here&apos;s what we found</Text>
        <Text style={styles.tag}>mark</Text>
        {!loaded ? <Text style={styles.hint}>Loading draft…</Text> : null}
        <ObservationZoneOverlay
          imageUri={previewUri}
          pointer={pointer}
          testID="confirm-mark-zone-overlay"
        />
        {template ? (
          <TemplateFieldsForm
            template={template}
            draft={draft}
            fieldsAbsent={absent}
            onChange={(k, v) => setField(k, v)}
          />
        ) : (
          <Text style={styles.hint}>No template for this draft.</Text>
        )}
        <Text style={styles.prompt}>new mark, or is this the same one as before?</Text>
        {error ? <Text style={styles.err}>{error}</Text> : null}
      </View>
      <TierPrimary
        label={busy ? 'Saving…' : 'Looks right'}
        testID="confirm-mark-looks-right"
        onPress={() => void submitLooksRight()}
      />
    </SecondTierChrome>
  );
}
const styles = StyleSheet.create({
  h: { fontSize: 22, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 8 },
  tag: { fontSize: 13, color: AppTokens.color.muted, marginBottom: 12 },
  hint: { fontSize: 14, color: AppTokens.color.muted, marginBottom: 8 },
  prompt: { marginTop: 12, fontSize: 15, color: AppTokens.color.muted },
  err: { color: '#D93A3A', marginTop: 8 },
});
