/**
 * Confirm lab — clones Step 17 chrome; fields from lab.result / lab.imaging_report SSOT.
 */
import React, { useState } from 'react';
import { Text } from 'react-native';

import { CaptureDiscardDialog } from '@/components/capture/CaptureDiscardDialog';
import { ConfirmTagChrome, confirmTagStyles } from '@/components/capture/ConfirmTagChrome';
import { ExactDuplicateWarning } from '@/components/capture/ExactDuplicateWarning';
import { TemplateFieldsForm } from '@/components/capture/TemplateFieldsForm';
import { getTemplateForDraft } from '@/lib/record-field-templates';
import { useCaptureConfirm } from '@/lib/use-capture-confirm';

export default function ConfirmLabScreen() {
  const { draft, busy, error, setField, submitLooksRight, cancelCapture, loaded, possible_duplicate } =
    useCaptureConfirm('lab');
  const [discardOpen, setDiscardOpen] = useState(false);
  const template = getTemplateForDraft('lab', draft);
  const absent = Array.isArray(draft.fields_absent) ? (draft.fields_absent as string[]) : [];
  const isImaging = String(draft.lab_kind || '') === 'imaging_report';

  return (
    <>
      <ConfirmTagChrome
        screenTestID="confirm-5-lab"
        backTestID="confirm-lab-back"
        looksRightTestID="confirm-lab-looks-right"
        cancelTestID="confirm-lab-cancel"
        eyebrow={isImaging ? 'LAB · IMAGING' : 'LAB'}
        eyebrowTestID="confirm-lab-eyebrow"
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
            onChange={(k, v) => {
              setField(k, v);
              if (k === 'source_language') setField('display_language', v);
              if (k === 'study_type') setField('title', v);
            }}
          />
        ) : null}
        <Text style={confirmTagStyles.note} testID="confirm-lab-note">
          {isImaging
            ? 'Findings and Conclusion are from your document — not touche. Translation is coming; for now we keep them as written.'
            : 'we save it as written. translation is coming — for now, results are kept as detected.'}
        </Text>
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
