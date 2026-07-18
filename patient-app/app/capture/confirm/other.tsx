/**
 * P7.05 / APP-04 — Confirm 5-other — TemplateFieldsForm SSOT.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TemplateFieldsForm } from '@/components/capture/TemplateFieldsForm';
import { SecondTierChrome, TierPrimary } from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { getTemplateForDraft } from '@/lib/record-field-templates';
import { useCaptureConfirm } from '@/lib/use-capture-confirm';

export default function ConfirmOtherScreen() {
  const { draft, busy, error, setField, submitLooksRight, loaded } = useCaptureConfirm('other');
  const template = getTemplateForDraft('other', draft);
  const absent = Array.isArray(draft.fields_absent)
    ? (draft.fields_absent as string[])
    : [];

  return (
    <SecondTierChrome testID="confirm-5-other">
      <View>
        <Text style={styles.h}>Here&apos;s what we found</Text>
        <Text style={styles.tag}>other</Text>
        {!loaded ? <Text style={styles.hint}>Loading draft…</Text> : null}
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
        {error ? <Text style={styles.err}>{error}</Text> : null}
      </View>
      <TierPrimary
        label={busy ? 'Saving…' : 'Looks right'}
        testID="confirm-other-looks-right"
        onPress={() => void submitLooksRight()}
      />
    </SecondTierChrome>
  );
}
const styles = StyleSheet.create({
  h: { fontSize: 22, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 8 },
  tag: { fontSize: 13, color: AppTokens.color.muted, marginBottom: 12 },
  hint: { fontSize: 14, color: AppTokens.color.muted, marginBottom: 8 },
  err: { color: '#D93A3A', marginTop: 8 },
});
