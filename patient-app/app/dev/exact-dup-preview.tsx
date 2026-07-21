/**
 * Dev-only harness: confirm chrome + ExactDuplicateWarning with live prod payload.
 * Route: /dev/exact-dup-preview — not linked from nav.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';

import { ExactDuplicateWarning } from '@/components/capture/ExactDuplicateWarning';
import { TemplateFieldsForm } from '@/components/capture/TemplateFieldsForm';
import { SecondTierChrome, TierPrimary } from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { getTemplateForDraft } from '@/lib/record-field-templates';
import { setPendingCaptureDraft } from '@/lib/pending-capture-draft';

const DRAFT = {
  date: '2026-07-18',
  label: 'prod content-hash 2',
  free_text_facts: 'dup live',
};

const DUP = {
  fact_id: 'prf_c388e79b-cb23-48d4-94a6-cce76024f0ab',
  logged_on: '2026-07-18',
  tag: 'other' as const,
  entry_date: '2026-07-18',
  request_id: 'prod-dup-req-1',
};

export default function ExactDupPreviewScreen() {
  useEffect(() => {
    if (!__DEV__) return;
    void setPendingCaptureDraft({
      factId: 'prf_7069faa9-e57f-45d8-9cf0-1f8aefe228f3',
      tag: 'other',
      apiTag: 'other',
      draft: DRAFT,
      request_id: 'prod-dup-req-2',
      via: 'authenticated_capture',
      ai_or_manual: 'manual',
      possible_duplicate: DUP,
    });
  }, []);

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  const template = getTemplateForDraft('other', DRAFT);

  return (
    <SecondTierChrome testID="confirm-exact-dup-preview">
      <View>
        <Text style={styles.h}>Here&apos;s what we found</Text>
        <Text style={styles.tag}>other</Text>
        <ExactDuplicateWarning possibleDuplicate={DUP} />
        {template ? (
          <TemplateFieldsForm template={template} draft={DRAFT} fieldsAbsent={[]} onChange={() => {}} />
        ) : null}
      </View>
      <TierPrimary label="Looks right" testID="confirm-exact-dup-looks-right" onPress={() => {}} />
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  h: { fontSize: 22, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 8 },
  tag: { fontSize: 13, color: AppTokens.color.muted, marginBottom: 12 },
});
