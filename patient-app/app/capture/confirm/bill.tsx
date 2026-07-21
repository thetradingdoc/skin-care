/**
 * Confirm bill — clones Step 17 chrome; fields from bill.default template SSOT.
 */
import React, { useState } from 'react';
import { Text } from 'react-native';

import { CaptureDiscardDialog } from '@/components/capture/CaptureDiscardDialog';
import { ConfirmTagChrome, confirmTagStyles } from '@/components/capture/ConfirmTagChrome';
import { ExactDuplicateWarning } from '@/components/capture/ExactDuplicateWarning';
import { TemplateFieldsForm } from '@/components/capture/TemplateFieldsForm';
import { getTemplateForDraft } from '@/lib/record-field-templates';
import { useCaptureConfirm } from '@/lib/use-capture-confirm';

export default function ConfirmBillScreen() {
  const { draft, busy, error, setField, submitLooksRight, cancelCapture, loaded, possible_duplicate } =
    useCaptureConfirm('bill');
  const [discardOpen, setDiscardOpen] = useState(false);
  const template = getTemplateForDraft('bill', draft);
  const absent = Array.isArray(draft.fields_absent) ? (draft.fields_absent as string[]) : [];

  return (
    <>
      <ConfirmTagChrome
        screenTestID="confirm-5-bill"
        backTestID="confirm-bill-back"
        looksRightTestID="confirm-bill-looks-right"
        cancelTestID="confirm-bill-cancel"
        eyebrow="BILL"
        eyebrowTestID="confirm-bill-eyebrow"
        busy={busy}
        error={error}
        onLooksRight={() => void submitLooksRight()}
        onCancel={() => setDiscardOpen(true)}>
        <ExactDuplicateWarning possibleDuplicate={possible_duplicate} />
        {!loaded ? <Text style={confirmTagStyles.hint}>Loading draft…</Text> : null}
        {template ? (
          <TemplateFieldsForm
            template={template}
            draft={draft}
            fieldsAbsent={absent}
            onChange={(k, v) => setField(k, v)}
          />
        ) : (
          <Text style={confirmTagStyles.hint}>No template for this draft.</Text>
        )}
      </ConfirmTagChrome>
      <CaptureDiscardDialog
        visible={discardOpen}
        onDiscard={() => {
          setDiscardOpen(false);
          void cancelCapture();
        }}
        onKeepEditing={() => setDiscardOpen(false)}
      />
    </>
  );
}
