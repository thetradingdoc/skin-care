/**
 * Step 17 — Confirm 5-skin (v4.1 frame 17).
 * TemplateFieldsForm SSOT + zone overlay + AI SUGGESTS.
 * Cancel opens Step 18 discard dialog (does not leave immediately).
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CaptureDiscardDialog } from '@/components/capture/CaptureDiscardDialog';
import { ExactDuplicateWarning } from '@/components/capture/ExactDuplicateWarning';
import { ObservationZoneOverlay } from '@/components/capture/ObservationZoneOverlay';
import { TemplateFieldsForm } from '@/components/capture/TemplateFieldsForm';
import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { getTemplateForDraft } from '@/lib/record-field-templates';
import { aiSuggestionText, useCaptureConfirm } from '@/lib/use-capture-confirm';
import { visualPointerFromDraft } from '@/lib/visual-observation-pointer';

export default function ConfirmSkinScreen() {
  const {
    pending,
    draft,
    busy,
    error,
    setField,
    submitLooksRight,
    goManual,
    cancelCapture,
    loaded,
    possible_duplicate,
  } = useCaptureConfirm('skin');
  const [discardOpen, setDiscardOpen] = useState(false);
  const [locChip, setLocChip] = useState('Face');
  const template = getTemplateForDraft('skin', draft);
  const suggestion = aiSuggestionText(draft);
  const pointer = visualPointerFromDraft(draft);
  const previewUri = pending?.preview_uri || null;
  const absent = Array.isArray(draft.fields_absent)
    ? (draft.fields_absent as string[])
    : [];

  const requestCancel = () => setDiscardOpen(true);

  return (
    <SafeAreaView style={styles.root} testID="confirm-5-skin" edges={['top', 'bottom']}>
      <BackNavHeader label="Cancel" testID="confirm-skin-back" onBack={requestCancel} />
      <ScrollView style={styles.main} contentContainerStyle={styles.mainContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow} testID="confirm-skin-eyebrow">
          SKIN
        </Text>
        <Text style={styles.h}>Here&apos;s what we found</Text>
        <ExactDuplicateWarning possibleDuplicate={possible_duplicate} />
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
        <Text style={styles.hint}>Where is this? You confirm the location — we don't guess.</Text>
        <View style={styles.locChips} testID="confirm-skin-location-chips">
          {(['Face', 'Chest', 'Back', 'Hand', 'Other'] as const).map((loc) => (
            <Pressable
              key={loc}
              onPress={() => {
                setLocChip(loc);
                setField('body_location', loc);
              }}
              style={[styles.locChip, locChip === loc && styles.locChipOn]}
              testID={`confirm-skin-loc-${loc}`}>
              <Text style={[styles.locChipText, locChip === loc && styles.locChipTextOn]}>{loc}</Text>
            </Pressable>
          ))}
        </View>
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
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={styles.primary}
          testID="confirm-skin-looks-right"
          onPress={() => void submitLooksRight()}
          accessibilityRole="button"
          accessibilityLabel={busy ? 'Saving…' : 'Looks right'}>
          <Text style={styles.primaryLabel}>{busy ? 'Saving…' : 'Looks right'}</Text>
        </Pressable>
        <Pressable
          style={styles.secondary}
          testID="confirm-skin-manual"
          onPress={goManual}
          accessibilityRole="button"
          accessibilityLabel="enter this one manually instead">
          <Text style={styles.secondaryLabel}>enter this one manually instead</Text>
        </Pressable>
        <Pressable
          style={styles.secondary}
          testID="confirm-skin-cancel"
          onPress={requestCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel">
          <Text style={styles.secondaryLabel}>Cancel</Text>
        </Pressable>
      </View>
      <CaptureDiscardDialog
        visible={discardOpen}
        onDiscard={() => {
          setDiscardOpen(false);
          void cancelCapture();
        }}
        onKeepEditing={() => setDiscardOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white, paddingHorizontal: 18 },
  main: { flex: 1 },
  mainContent: { paddingTop: 4, paddingBottom: 16 },
  eyebrow: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.7,
    color: V4DesignTokens.color.redDeep,
    marginBottom: 4,
  },
  h: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 22,
    color: V4DesignTokens.color.black,
    marginBottom: 8,
  },
  hint: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    marginBottom: 8,
  },
  locChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  locChip: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(61,0,11,0.06)',
    borderWidth: 1.5,
    borderColor: V4DesignTokens.color.line,
  },
  locChipOn: {
    backgroundColor: V4DesignTokens.color.wine,
    borderColor: V4DesignTokens.color.wine,
  },
  locChipText: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 13,
    color: V4DesignTokens.color.wine,
  },
  locChipTextOn: { color: V4DesignTokens.color.white },
  ai: {
    marginTop: 12,
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: V4DesignTokens.color.red,
  },
  body: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 15,
    color: V4DesignTokens.color.muted,
    marginTop: 4,
    lineHeight: 22,
  },
  err: { color: V4DesignTokens.color.redDeep, marginTop: 8, fontFamily: V4DesignTokens.font.body },
  footer: { paddingBottom: 8 },
  primary: {
    backgroundColor: V4DesignTokens.color.black,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.white,
  },
  secondary: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontFamily: V4DesignTokens.font.bodyMedium,
    fontSize: 15,
    color: V4DesignTokens.color.muted,
  },
});
