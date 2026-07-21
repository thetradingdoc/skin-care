/**
 * Confirm rx — clones Step 17 chrome; fields from prescription.* templates + shelf Yes/No.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CaptureDiscardDialog } from '@/components/capture/CaptureDiscardDialog';
import { ConfirmTagChrome, confirmTagStyles } from '@/components/capture/ConfirmTagChrome';
import { ExactDuplicateWarning } from '@/components/capture/ExactDuplicateWarning';
import { TemplateFieldsForm } from '@/components/capture/TemplateFieldsForm';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { addRxToShelfPrompt } from '@/lib/phase5-ui-copy';
import { getTemplateForDraft } from '@/lib/record-field-templates';
import { useCaptureConfirm } from '@/lib/use-capture-confirm';

export default function ConfirmRxScreen() {
  const { draft, busy, error, setField, submitLooksRight, cancelCapture, loaded, possible_duplicate } =
    useCaptureConfirm('rx');
  const [discardOpen, setDiscardOpen] = useState(false);
  const template = getTemplateForDraft('prescription', draft);
  const absent = Array.isArray(draft.fields_absent) ? (draft.fields_absent as string[]) : [];
  const [addToShelf, setAddToShelf] = useState<boolean | null>(null);
  const drugName = useMemo(() => {
    const d = draft.drug || draft.practice || draft.note;
    return String(d || '').trim() || 'this prescription';
  }, [draft.drug, draft.practice, draft.note]);

  return (
    <>
      <ConfirmTagChrome
        screenTestID="confirm-5-rx"
        backTestID="confirm-rx-back"
        looksRightTestID="confirm-rx-looks-right"
        cancelTestID="confirm-rx-cancel"
        eyebrow="PRESCRIPTION"
        eyebrowTestID="confirm-rx-eyebrow"
        busy={busy}
        error={error}
        onLooksRight={() =>
          void submitLooksRight(addToShelf === true ? { add_to_shelf: true } : undefined)
        }
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

        <View style={styles.shelfPrompt} testID="confirm-rx-shelf-prompt">
          <Text style={styles.shelfQ}>{addRxToShelfPrompt(drugName)}</Text>
          <View style={styles.shelfRow}>
            <Pressable
              testID="confirm-rx-shelf-yes"
              accessibilityRole="button"
              accessibilityState={{ selected: addToShelf === true }}
              style={[styles.choice, addToShelf === true && styles.choiceOn]}
              onPress={() => setAddToShelf(true)}>
              <Text style={[styles.choiceText, addToShelf === true && styles.choiceTextOn]}>Yes</Text>
            </Pressable>
            <Pressable
              testID="confirm-rx-shelf-no"
              accessibilityRole="button"
              accessibilityState={{ selected: addToShelf === false }}
              style={[styles.choice, addToShelf === false && styles.choiceOn]}
              onPress={() => setAddToShelf(false)}>
              <Text style={[styles.choiceText, addToShelf === false && styles.choiceTextOn]}>No</Text>
            </Pressable>
          </View>
          <Text style={styles.shelfHint}>
            One tap — nothing is added until you choose and confirm.
          </Text>
        </View>
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

const styles = StyleSheet.create({
  shelfPrompt: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: V4DesignTokens.color.line,
  },
  shelfQ: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.black,
    marginBottom: 12,
  },
  shelfRow: { flexDirection: 'row', gap: 12 },
  choice: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: V4DesignTokens.color.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceOn: {
    backgroundColor: V4DesignTokens.color.black,
    borderColor: V4DesignTokens.color.black,
  },
  choiceText: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.black,
  },
  choiceTextOn: { color: V4DesignTokens.color.white },
  shelfHint: {
    marginTop: 10,
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
    lineHeight: 18,
  },
});
