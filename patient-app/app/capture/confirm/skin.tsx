/**
 * P7.05 / APP-04 — Confirm 5-skin — TemplateFieldsForm SSOT + zone overlay + AI SUGGESTS.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ObservationZoneOverlay } from '@/components/capture/ObservationZoneOverlay';
import { TemplateFieldsForm } from '@/components/capture/TemplateFieldsForm';
import { SecondTierChrome, TierPrimary, TierSecondary } from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { getTemplateForDraft } from '@/lib/record-field-templates';
import { aiSuggestionText, useCaptureConfirm } from '@/lib/use-capture-confirm';
import { visualPointerFromDraft } from '@/lib/visual-observation-pointer';

export default function ConfirmSkinScreen() {
  const { pending, draft, busy, error, setField, submitLooksRight, goManual, loaded } =
    useCaptureConfirm('skin');
  const template = getTemplateForDraft('skin', draft);
  const suggestion = aiSuggestionText(draft);
  const pointer = visualPointerFromDraft(draft);
  const previewUri = pending?.preview_uri || null;
  const absent = Array.isArray(draft.fields_absent)
    ? (draft.fields_absent as string[])
    : [];

  return (
    <SecondTierChrome testID="confirm-5-skin">
      <View>
        <Text style={styles.h}>Here&apos;s what we found</Text>
        <Text style={styles.tag}>skin</Text>
        {!loaded ? <Text style={styles.hint}>Loading draft…</Text> : null}
        <ObservationZoneOverlay
          imageUri={previewUri}
          pointer={pointer}
          testID="confirm-skin-zone-overlay"
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
        <Text style={styles.ai} testID="confirm-skin-ai-suggests">
          AI SUGGESTS
        </Text>
        <Text style={styles.body} testID="confirm-skin-suggestion">
          {suggestion || 'AI suggestion pending confirm'}
        </Text>
        {error ? (
          <Text style={styles.err} testID="confirm-skin-error">
            {error}
          </Text>
        ) : null}
      </View>
      <View>
        <TierPrimary
          label={busy ? 'Saving…' : 'Looks right'}
          testID="confirm-skin-looks-right"
          onPress={() => void submitLooksRight()}
        />
        <TierSecondary
          label="enter this one manually instead"
          testID="confirm-skin-manual"
          onPress={goManual}
        />
      </View>
    </SecondTierChrome>
  );
}
const styles = StyleSheet.create({
  h: { fontSize: 22, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 8 },
  tag: { fontSize: 13, color: AppTokens.color.muted, marginBottom: 12 },
  hint: { fontSize: 14, color: AppTokens.color.muted, marginBottom: 8 },
  ai: { marginTop: 12, fontWeight: '700', color: AppTokens.color.fabBg },
  body: { fontSize: 15, color: AppTokens.color.muted, marginTop: 4, lineHeight: 22 },
  err: { color: '#D93A3A', marginTop: 8 },
});
