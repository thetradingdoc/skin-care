/**
 * Confirm mark — clones Step 17 chrome; fields from mark.default + zone overlay.
 */
import React, { useState } from 'react';
import { Text } from 'react-native';

import { CaptureDiscardDialog } from '@/components/capture/CaptureDiscardDialog';
import { ConfirmTagChrome, confirmTagStyles } from '@/components/capture/ConfirmTagChrome';
import { ExactDuplicateWarning } from '@/components/capture/ExactDuplicateWarning';
import { ObservationZoneOverlay } from '@/components/capture/ObservationZoneOverlay';
import { TemplateFieldsForm } from '@/components/capture/TemplateFieldsForm';
import { getTemplateForDraft } from '@/lib/record-field-templates';
import { useCaptureConfirm } from '@/lib/use-capture-confirm';
import { visualPointerFromDraft } from '@/lib/visual-observation-pointer';

export default function ConfirmMarkScreen() {
  const {
    pending,
    draft,
    busy,
    error,
    setField,
    submitLooksRight,
    cancelCapture,
    loaded,
    possible_duplicate,
  } = useCaptureConfirm('mark');
  const [discardOpen, setDiscardOpen] = useState(false);
  const template = getTemplateForDraft('mark', draft);
  const pointer = visualPointerFromDraft(draft);
  const previewUri = pending?.preview_uri || null;
  const absent = Array.isArray(draft.fields_absent) ? (draft.fields_absent as string[]) : [];

  return (
    <>
      <ConfirmTagChrome
        screenTestID="confirm-5-mark"
        backTestID="confirm-mark-back"
        looksRightTestID="confirm-mark-looks-right"
        cancelTestID="confirm-mark-cancel"
        eyebrow="MARK"
        eyebrowTestID="confirm-mark-eyebrow"
        busy={busy}
        error={error}
        onLooksRight={() => void submitLooksRight()}
        onCancel={() => setDiscardOpen(true)}>
        <ExactDuplicateWarning possibleDuplicate={possible_duplicate} />
        {!loaded ? <Text style={confirmTagStyles.hint}>Loading draft…</Text> : null}
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
          <Text style={confirmTagStyles.hint}>No template for this draft.</Text>
        )}
        <Text style={confirmTagStyles.prompt} testID="confirm-mark-prompt">
          new mark, or is this the same one as before?
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
