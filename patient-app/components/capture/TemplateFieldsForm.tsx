/**
 * Renders ConfirmEditableField rows from a field template (SSOT).
 * money_cents: display major units, store integer cents in draft.
 * Scrolling for large templates (optical 14+, imaging Findings/Conclusion) is
 * owned by SecondTierChrome — sticky footer + ScrollView around main content.
 *
 * Absent-field copy is tag-aware: document tags (rx/lab/bill) say "not found in
 * document"; photo tags (skin/mark) never use document-extraction language.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ConfirmEditableField } from '@/components/capture/ConfirmEditableField';
import { AppTokens } from '@/constants/appTokens';
import { absentFieldAffordance } from '@/lib/absent-field-affordance';
import {
  editableFields,
  type FieldDef,
  type FieldTemplate,
} from '@/lib/record-field-templates';

export { absentFieldAffordance };

type Props = {
  template: FieldTemplate;
  draft: Record<string, unknown>;
  onChange: (key: string, value: string | number | boolean) => void;
  /** Keys extraction could not fill — show explicit absent affordance */
  fieldsAbsent?: string[];
};

function displayForField(field: FieldDef, raw: unknown): string {
  if (raw == null || raw === '') return '';
  if (field.type === 'money_cents') {
    const n = Number(raw);
    if (!Number.isFinite(n)) return '';
    return (n / 100).toFixed(2);
  }
  if (typeof raw === 'boolean') return raw ? 'yes' : 'no';
  return String(raw);
}

function parseMoneyCentsInput(v: string): number | '' {
  const cleaned = String(v).replace(/[^0-9.]/g, '');
  if (!cleaned) return '';
  const major = Number(cleaned);
  if (!Number.isFinite(major)) return '';
  return Math.round(major * 100);
}

export function TemplateFieldsForm({ template, draft, onChange, fieldsAbsent = [] }: Props) {
  const absent = new Set(fieldsAbsent.map(String));
  const fields = editableFields(template);

  return (
    <View testID={`template-fields-${template.id}`}>
      <Text style={styles.templateLabel}>{template.label}</Text>
      {fields.map((field) => {
        const raw = draft[field.key];
        const isAbsent = absent.has(field.key) || raw == null || raw === '';
        const display = displayForField(field, raw);
        const label = field.unit ? `${field.label} (${field.unit})` : field.label;
        return (
          <View key={field.key}>
            <ConfirmEditableField
              label={label}
              value={display}
              testID={`confirm-field-${field.key}`}
              keyboardType={field.type === 'money_cents' || field.type === 'number' ? 'decimal-pad' : 'default'}
              onChange={(v) => {
                if (field.type === 'money_cents') {
                  onChange(field.key, parseMoneyCentsInput(v));
                  return;
                }
                if (field.type === 'boolean') {
                  const s = String(v).trim().toLowerCase();
                  onChange(field.key, s === 'yes' || s === 'true' || s === '1');
                  return;
                }
                onChange(field.key, v);
              }}
            />
            {isAbsent ? (
              <Text style={styles.absent} testID={`field-absent-${field.key}`}>
                {absentFieldAffordance(template.tag, field.key)}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  templateLabel: {
    fontSize: 13,
    color: AppTokens.color.muted,
    marginBottom: 12,
  },
  absent: {
    fontSize: 12,
    color: AppTokens.color.muted,
    marginTop: -4,
    marginBottom: 8,
    marginLeft: 2,
  },
});
