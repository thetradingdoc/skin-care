/**
 * Client mirror of middleware `record-field-templates` catalog (SSOT on server).
 * Keep keys/labels/required in sync — middleware
 * `__tests__/record-field-templates.test.js` fails on any key drift.
 */

export type FieldType =
  | 'string'
  | 'number'
  | 'money_cents'
  | 'date'
  | 'boolean'
  | 'enum'
  | 'diopter'
  | 'axis'
  | 'text';

export type FieldDef = {
  key: string;
  type: FieldType;
  label: string;
  required?: boolean;
  unit?: string | null;
  enum?: readonly string[];
  group?: string;
  system?: boolean;
  description?: string;
  denorm?: string;
};

export type FieldTemplate = {
  id: string;
  tag: string;
  subtype: string;
  label: string;
  fields: readonly FieldDef[];
};

const YN = ['yes', 'no', 'unknown'] as const;

export const PRESCRIPTION_MEDICATION: FieldTemplate = {
  id: 'prescription.medication',
  tag: 'prescription',
  subtype: 'medication',
  label: 'Medication prescription',
  fields: [
    { key: 'date', type: 'date', label: 'Date', required: true, denorm: 'issue_date' },
    { key: 'drug', type: 'string', label: 'Drug', required: true },
    { key: 'strength', type: 'string', label: 'Strength' },
    { key: 'prescriber', type: 'string', label: 'Prescriber', denorm: 'provider' },
    { key: 'expiry', type: 'date', label: 'Expires', denorm: 'expiry_date' },
    { key: 'note', type: 'text', label: 'Notes' },
    { key: 'reminder_opt_in', type: 'boolean', label: 'Remind me before expiry' },
  ],
};

export const PRESCRIPTION_OPTICAL: FieldTemplate = {
  id: 'prescription.optical',
  tag: 'prescription',
  subtype: 'optical',
  label: 'Optical / glasses prescription',
  fields: [
    { key: 'date', type: 'date', label: 'Date', required: true, denorm: 'issue_date' },
    { key: 'practice', type: 'string', label: 'Practice / location', denorm: 'provider' },
    { key: 'od_sph', type: 'diopter', label: 'Right (OD) SPH', unit: 'D', group: 'distance_od' },
    { key: 'od_cyl', type: 'diopter', label: 'Right (OD) CYL', unit: 'D', group: 'distance_od' },
    { key: 'od_axis', type: 'axis', label: 'Right (OD) Axis', unit: '°', group: 'distance_od' },
    { key: 'os_sph', type: 'diopter', label: 'Left (OS) SPH', unit: 'D', group: 'distance_os' },
    { key: 'os_cyl', type: 'diopter', label: 'Left (OS) CYL', unit: 'D', group: 'distance_os' },
    { key: 'os_axis', type: 'axis', label: 'Left (OS) Axis', unit: '°', group: 'distance_os' },
    { key: 'multifocal', type: 'enum', label: 'Multifocal', enum: YN },
    { key: 'tint', type: 'enum', label: 'Color / tint', enum: YN },
    { key: 'pd', type: 'number', label: 'Pupillary distance', unit: 'mm' },
    { key: 'expiry', type: 'date', label: 'Expires', denorm: 'expiry_date' },
    { key: 'note', type: 'text', label: 'Notes / remarks' },
    {
      key: 'drug',
      type: 'string',
      label: 'Type',
      description: 'Display title (e.g. Glasses prescription)',
    },
    {
      key: 'prescriber',
      type: 'string',
      label: 'Prescriber',
      description: 'Alias of practice when set',
    },
    { key: 'reminder_opt_in', type: 'boolean', label: 'Remind me before expiry' },
  ],
};

export const PRESCRIPTION_OTHER: FieldTemplate = {
  id: 'prescription.other',
  tag: 'prescription',
  subtype: 'other',
  label: 'Other prescription',
  fields: [
    { key: 'date', type: 'date', label: 'Date', required: true, denorm: 'issue_date' },
    { key: 'drug', type: 'string', label: 'What is it', required: true },
    { key: 'prescriber', type: 'string', label: 'Prescriber / clinic', denorm: 'provider' },
    { key: 'expiry', type: 'date', label: 'Expires', denorm: 'expiry_date' },
    { key: 'note', type: 'text', label: 'Notes' },
  ],
};

export const LAB_RESULT: FieldTemplate = {
  id: 'lab.result',
  tag: 'lab',
  subtype: 'lab',
  label: 'Lab result',
  fields: [
    { key: 'date', type: 'date', label: 'Date', required: true, denorm: 'issue_date' },
    { key: 'title', type: 'string', label: 'Test name' },
    { key: 'provider', type: 'string', label: 'Provider / lab', denorm: 'provider' },
    { key: 'findings', type: 'text', label: 'Results / findings' },
    { key: 'free_text', type: 'text', label: 'Full text' },
    { key: 'source_language', type: 'string', label: 'Document language' },
    { key: 'display_language', type: 'string', label: 'Display language' },
  ],
};

export const LAB_IMAGING: FieldTemplate = {
  id: 'lab.imaging_report',
  tag: 'lab',
  subtype: 'imaging_report',
  label: 'Imaging / radiology report',
  fields: [
    { key: 'date', type: 'date', label: 'Date', required: true, denorm: 'issue_date' },
    { key: 'study_type', type: 'string', label: 'Study / test name' },
    { key: 'body_region', type: 'string', label: 'Body region' },
    { key: 'provider', type: 'string', label: 'Reading physician', denorm: 'provider' },
    { key: 'facility', type: 'string', label: 'Facility' },
    { key: 'findings', type: 'text', label: 'Findings (from your document)' },
    { key: 'conclusion', type: 'text', label: 'Conclusion (from your document)' },
    { key: 'images_available_externally', type: 'boolean', label: 'Images available externally' },
    { key: 'external_images_note', type: 'text', label: 'External images note' },
    { key: 'title', type: 'string', label: 'Title' },
    { key: 'source_language', type: 'string', label: 'Document language' },
    { key: 'display_language', type: 'string', label: 'Display language' },
  ],
};

export const SKIN_DEFAULT: FieldTemplate = {
  id: 'skin.default',
  tag: 'skin',
  subtype: 'default',
  label: 'Skin log',
  fields: [
    { key: 'date', type: 'date', label: 'Date', required: true, denorm: 'issue_date' },
    { key: 'body_area', type: 'string', label: 'Body area' },
    { key: 'note', type: 'text', label: 'Note' },
  ],
};

export const BILL_DEFAULT: FieldTemplate = {
  id: 'bill.default',
  tag: 'bill',
  subtype: 'default',
  label: 'Bill / receipt',
  fields: [
    { key: 'date', type: 'date', label: 'Date', required: true, denorm: 'issue_date' },
    { key: 'provider', type: 'string', label: 'Provider', denorm: 'provider' },
    // Canonical: integer minor units. UI shows dollars via money_cents type.
    { key: 'amount_cents', type: 'money_cents', label: 'Amount' },
    { key: 'currency', type: 'string', label: 'Currency' },
    { key: 'doc_type', type: 'string', label: 'Document type' },
  ],
};

export const MARK_DEFAULT: FieldTemplate = {
  id: 'mark.default',
  tag: 'mark',
  subtype: 'default',
  label: 'Mark',
  fields: [
    { key: 'date', type: 'date', label: 'Date', required: true, denorm: 'issue_date' },
    { key: 'body_location', type: 'string', label: 'Location', required: true },
    { key: 'note', type: 'text', label: 'Note' },
  ],
};

export const OTHER_DEFAULT: FieldTemplate = {
  id: 'other.default',
  tag: 'other',
  subtype: 'default',
  label: 'Other',
  fields: [
    { key: 'date', type: 'date', label: 'Date', required: true, denorm: 'issue_date' },
    { key: 'label', type: 'string', label: 'Label', required: true },
    { key: 'free_text_facts', type: 'text', label: 'Notes' },
  ],
};

const ALL: FieldTemplate[] = [
  PRESCRIPTION_MEDICATION,
  PRESCRIPTION_OPTICAL,
  PRESCRIPTION_OTHER,
  LAB_RESULT,
  LAB_IMAGING,
  SKIN_DEFAULT,
  BILL_DEFAULT,
  MARK_DEFAULT,
  OTHER_DEFAULT,
];

export function listTemplates(): FieldTemplate[] {
  return ALL.slice();
}

export function getTemplate(id: string): FieldTemplate | null {
  return ALL.find((t) => t.id === id) || null;
}

export function getTemplateForDraft(
  tag: string,
  draft: Record<string, unknown>,
): FieldTemplate | null {
  const templateId = String(draft.template_id || '');
  if (templateId) {
    const t = getTemplate(templateId);
    if (t) return t;
  }
  if (tag === 'rx' || tag === 'prescription') {
    const kind = String(draft.rx_kind || 'other');
    if (kind === 'optical') return PRESCRIPTION_OPTICAL;
    if (kind === 'medication') return PRESCRIPTION_MEDICATION;
    return PRESCRIPTION_OTHER;
  }
  if (tag === 'lab') {
    if (String(draft.lab_kind) === 'imaging_report') return LAB_IMAGING;
    return LAB_RESULT;
  }
  if (tag === 'skin') return SKIN_DEFAULT;
  if (tag === 'bill') return BILL_DEFAULT;
  if (tag === 'mark') return MARK_DEFAULT;
  if (tag === 'other') return OTHER_DEFAULT;
  return null;
}

export function templatesForTag(tag: string): FieldTemplate[] {
  const t = tag === 'rx' ? 'prescription' : tag;
  return ALL.filter((x) => x.tag === t);
}

export function editableFields(template: FieldTemplate): FieldDef[] {
  return template.fields.filter((f) => !f.system);
}
