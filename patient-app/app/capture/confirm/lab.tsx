/**
 * P7.05 — Confirm 5-lab — fields from record-field-templates SSOT.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TemplateFieldsForm } from '@/components/capture/TemplateFieldsForm';
import { SecondTierChrome, TierPrimary } from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { getTemplateForDraft } from '@/lib/record-field-templates';
import { useCaptureConfirm } from '@/lib/use-capture-confirm';

export default function ConfirmLabScreen() {
  const { draft, busy, error, setField, submitLooksRight, loaded } = useCaptureConfirm('lab');
  const template = getTemplateForDraft('lab', draft);
  const absent = Array.isArray(draft.fields_absent)
    ? (draft.fields_absent as string[])
    : [];
  const isImaging = String(draft.lab_kind || '') === 'imaging_report';

  return (
    <SecondTierChrome testID="confirm-5-lab">
      <View>
        <Text style={styles.h}>Here&apos;s what we found</Text>
        <Text style={styles.tag}>{isImaging ? 'lab · imaging report' : 'lab'}</Text>
        {!loaded ? <Text style={styles.hint}>Loading draft…</Text> : null}
        {template ? (
          <TemplateFieldsForm
            template={template}
            draft={draft}
            fieldsAbsent={absent}
            onChange={(k, v) => {
              setField(k, v);
              if (k === 'source_language') setField('display_language', v);
              if (k === 'study_type') setField('title', v);
            }}
          />
        ) : null}
        <Text style={styles.note}>
          {isImaging
            ? 'Findings and Conclusion are from your document — not touche. Translation is coming; for now we keep them as written.'
            : 'we save it as written. translation is coming — for now, results are kept as detected.'}
        </Text>
        {error ? <Text style={styles.err}>{error}</Text> : null}
      </View>
      <TierPrimary
        label={busy ? 'Saving…' : 'Looks right'}
        testID="confirm-lab-looks-right"
        onPress={() => void submitLooksRight()}
      />
    </SecondTierChrome>
  );
}
const styles = StyleSheet.create({
  h: { fontSize: 22, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 8 },
  tag: { fontSize: 13, color: AppTokens.color.muted, marginBottom: 12 },
  hint: { fontSize: 14, color: AppTokens.color.muted, marginBottom: 8 },
  note: { fontSize: 14, color: AppTokens.color.muted, marginTop: 8, lineHeight: 20 },
  err: { color: '#D93A3A', marginTop: 8 },
});
