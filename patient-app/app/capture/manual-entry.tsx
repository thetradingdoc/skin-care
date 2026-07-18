/**
 * P7.35 — Screen 2m manual entry — template-driven fields per tag/subtype.
 */
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { TemplateFieldsForm } from '@/components/capture/TemplateFieldsForm';
import {
  SecondTierChrome,
  TierPrimary,
} from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { PROGRESS_HREF } from '@/constants/routes';
import { createCaptureRequestId } from '@/lib/capture-request-id';
import { captureRecordFact } from '@/lib/patient-record-capture';
import {
  getTemplate,
  templatesForTag,
  type FieldTemplate,
} from '@/lib/record-field-templates';

export const MANUAL_ENTRY_TITLE = 'Enter it yourself';
export const MANUAL_ENTRY_SUB = 'no AI · no photo needed';
export const MANUAL_TAGS = ['skin', 'bill', 'prescription', 'mark', 'lab', 'other'] as const;

export default function ManualEntryScreen() {
  const router = useRouter();
  const [tag, setTag] = useState<(typeof MANUAL_TAGS)[number]>('skin');
  const [subtypeId, setSubtypeId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({
    date: new Date().toISOString().slice(0, 10),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRequestId = React.useRef<string | null>(null);

  const tagTemplates = useMemo(() => templatesForTag(tag), [tag]);
  const template: FieldTemplate | null = useMemo(() => {
    if (tag === 'prescription' || tag === 'lab') {
      const id =
        subtypeId ||
        (tag === 'prescription' ? 'prescription.other' : 'lab.result');
      return getTemplate(id);
    }
    // APP-04 — skin/bill/mark/other all catalog-driven (no hardcoded field fallback)
    if (tag === 'bill') return getTemplate('bill.default');
    if (tag === 'skin') return getTemplate('skin.default');
    if (tag === 'mark') return getTemplate('mark.default');
    if (tag === 'other') return getTemplate('other.default');
    return null;
  }, [tag, subtypeId]);

  const selectTag = (t: (typeof MANUAL_TAGS)[number]) => {
    setTag(t);
    setSubtypeId(
      t === 'prescription' ? 'prescription.other' : t === 'lab' ? 'lab.result' : null,
    );
    setDraft({ date: new Date().toISOString().slice(0, 10) });
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    if (!pendingRequestId.current) pendingRequestId.current = createCaptureRequestId();
    const requestId = pendingRequestId.current;
    try {
      const note =
        typeof draft.note === 'string'
          ? draft.note
          : typeof draft.drug === 'string'
            ? draft.drug
            : typeof draft.title === 'string'
              ? draft.title
              : undefined;
      await captureRecordFact({
        tag: tag === 'prescription' ? 'prescription' : tag,
        date: String(draft.date || new Date().toISOString().slice(0, 10)),
        note: note ? String(note).trim() || undefined : undefined,
        drug: draft.drug != null ? String(draft.drug) : undefined,
        label: draft.label != null ? String(draft.label) : undefined,
        body_area: draft.body_area != null ? String(draft.body_area) : undefined,
        body_location: draft.body_location != null ? String(draft.body_location) : undefined,
        ai_or_manual: 'manual',
        request_id: requestId,
        // Extra template fields travel via structured_json merge on server through note/drug;
        // pass template_id via label channel is wrong — extend capture API below
      } as Parameters<typeof captureRecordFact>[0] & Record<string, unknown>);
      pendingRequestId.current = null;
      router.replace(PROGRESS_HREF);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  // Prefer structured capture with full draft when template is active
  const saveTemplated = async () => {
    setBusy(true);
    setError(null);
    if (!pendingRequestId.current) pendingRequestId.current = createCaptureRequestId();
    const requestId = pendingRequestId.current;
    try {
      const { captureRecordFactTemplated } = await import('@/lib/patient-record-capture');
      if (typeof captureRecordFactTemplated === 'function') {
        await captureRecordFactTemplated({
          tag: tag === 'prescription' ? 'prescription' : tag,
          template_id: template?.id,
          structured: {
            ...draft,
            template_id: template?.id,
            rx_kind: template?.tag === 'prescription' ? template.subtype : undefined,
            lab_kind: template?.tag === 'lab' ? template.subtype : undefined,
          },
          ai_or_manual: 'manual',
          request_id: requestId,
        });
      } else {
        await save();
        return;
      }
      pendingRequestId.current = null;
      router.replace(PROGRESS_HREF);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SecondTierChrome testID="screen-2m-manual-entry">
      <View>
        <Text style={styles.title} testID="manual-entry-title">
          {MANUAL_ENTRY_TITLE}
        </Text>
        <Text style={styles.sub}>{MANUAL_ENTRY_SUB}</Text>
        <View style={styles.tags} testID="manual-entry-tags">
          {MANUAL_TAGS.map((t) => (
            <Pressable
              key={t}
              onPress={() => selectTag(t)}
              style={[styles.tag, tag === t && styles.tagOn]}
              testID={`manual-tag-${t}`}>
              <Text style={styles.tagLabel}>{t}</Text>
            </Pressable>
          ))}
        </View>

        {tagTemplates.length > 1 ? (
          <View style={styles.tags} testID="manual-subtype-tags">
            {tagTemplates.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => {
                  setSubtypeId(t.id);
                  setDraft((d) => ({ date: d.date || new Date().toISOString().slice(0, 10) }));
                }}
                style={[styles.tag, subtypeId === t.id && styles.tagOn]}
                testID={`manual-subtype-${t.subtype}`}>
                <Text style={styles.tagLabel}>{t.subtype}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {template ? (
          <TemplateFieldsForm
            template={template}
            draft={draft}
            fieldsAbsent={editableFieldsAbsent(template, draft)}
            onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))}
          />
        ) : (
          <>
            <Text style={styles.label}>what happened / what is it</Text>
            <TextInput
              style={styles.input}
              value={String(draft.note || '')}
              onChangeText={(v) => setDraft((d) => ({ ...d, note: v }))}
              placeholder="Describe it"
              testID="manual-entry-note"
            />
            <Text style={styles.label}>date</Text>
            <TextInput
              style={styles.input}
              value={String(draft.date || '')}
              onChangeText={(v) => setDraft((d) => ({ ...d, date: v }))}
              placeholder="YYYY-MM-DD"
              testID="manual-entry-date"
            />
          </>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <TierPrimary
        label={busy ? 'Saving…' : 'Save'}
        testID="manual-entry-save"
        onPress={() => void (template ? saveTemplated() : save())}
      />
    </SecondTierChrome>
  );
}

function editableFieldsAbsent(
  template: FieldTemplate,
  draft: Record<string, unknown>,
): string[] {
  return template.fields
    .filter((f) => !f.system)
    .filter((f) => draft[f.key] == null || draft[f.key] === '')
    .map((f) => f.key);
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 6 },
  sub: { fontSize: 15, color: AppTokens.color.muted, marginBottom: 16 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: AppTokens.color.cream,
  },
  tagOn: { backgroundColor: AppTokens.color.infoBlue },
  tagLabel: { fontSize: 13, fontWeight: '600', color: AppTokens.color.ink },
  label: { fontSize: 13, color: AppTokens.color.muted, marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: AppTokens.color.ink,
  },
  error: { color: AppTokens.color.danger, marginTop: 8 },
});
