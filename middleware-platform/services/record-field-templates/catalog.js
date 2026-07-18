'use strict';

/**
 * Record field templates — single source of truth for tag/subtype fields.
 *
 * Consumed by:
 * - structure/validate (middleware)
 * - confirm + manual entry UI (patient-app via catalog API or mirrored module)
 * - denormalized column extractors
 *
 * Field shape:
 *   key, type, label, required?, unit?, enum?, denorm?, group?, description?
 * Types: string | number | money_cents | date | boolean | enum | diopter | axis | text
 *
 * money_cents: stored as integer minor units (amount_cents). UI displays major units.
 */

/** @typedef {'string'|'number'|'money_cents'|'date'|'boolean'|'enum'|'diopter'|'axis'|'text'} FieldType */

const YN = Object.freeze(['yes', 'no', 'unknown']);

const COMMON_META = Object.freeze([
  {
    key: 'template_id',
    type: 'string',
    label: 'Template',
    required: true,
    system: true,
    description: 'Catalog id that produced this draft',
  },
  {
    key: 'fields_absent',
    type: 'object',
    label: 'Absent fields',
    required: false,
    system: true,
    description: 'Keys the template defines but extraction could not fill',
  },
]);

const PRESCRIPTION_MEDICATION = Object.freeze({
  id: 'prescription.medication',
  tag: 'prescription',
  subtype: 'medication',
  label: 'Medication prescription',
  fields: Object.freeze([
    { key: 'date', type: 'date', label: 'Date', required: true, denorm: 'issue_date' },
    { key: 'drug', type: 'string', label: 'Drug', required: true },
    { key: 'strength', type: 'string', label: 'Strength', required: false, unit: null },
    { key: 'prescriber', type: 'string', label: 'Prescriber', required: false, denorm: 'provider' },
    { key: 'expiry', type: 'date', label: 'Expires', required: false, denorm: 'expiry_date' },
    { key: 'note', type: 'text', label: 'Notes', required: false },
    { key: 'reminder_opt_in', type: 'boolean', label: 'Remind me before expiry', required: false },
  ]),
});

/** Allerton Eye Care optical Rx — literal field set from the real form. */
const PRESCRIPTION_OPTICAL = Object.freeze({
  id: 'prescription.optical',
  tag: 'prescription',
  subtype: 'optical',
  label: 'Optical / glasses prescription',
  fields: Object.freeze([
    { key: 'date', type: 'date', label: 'Date', required: true, denorm: 'issue_date' },
    { key: 'practice', type: 'string', label: 'Practice / location', required: false, denorm: 'provider' },
    // Distance OD / OS
    { key: 'od_sph', type: 'diopter', label: 'Right (OD) SPH', required: false, unit: 'D', group: 'distance_od' },
    { key: 'od_cyl', type: 'diopter', label: 'Right (OD) CYL', required: false, unit: 'D', group: 'distance_od' },
    { key: 'od_axis', type: 'axis', label: 'Right (OD) Axis', required: false, unit: '°', group: 'distance_od' },
    { key: 'os_sph', type: 'diopter', label: 'Left (OS) SPH', required: false, unit: 'D', group: 'distance_os' },
    { key: 'os_cyl', type: 'diopter', label: 'Left (OS) CYL', required: false, unit: 'D', group: 'distance_os' },
    { key: 'os_axis', type: 'axis', label: 'Left (OS) Axis', required: false, unit: '°', group: 'distance_os' },
    { key: 'multifocal', type: 'enum', label: 'Multifocal', required: false, enum: YN },
    { key: 'tint', type: 'enum', label: 'Color / tint', required: false, enum: YN },
    { key: 'pd', type: 'number', label: 'Pupillary distance', required: false, unit: 'mm' },
    { key: 'expiry', type: 'date', label: 'Expires', required: false, denorm: 'expiry_date' },
    { key: 'note', type: 'text', label: 'Notes / remarks', required: false },
    // Compatibility aliases for shelf / reminders (display title)
    { key: 'drug', type: 'string', label: 'Type', required: false, description: 'Display title (e.g. Glasses prescription)' },
    { key: 'prescriber', type: 'string', label: 'Prescriber', required: false, description: 'Alias of practice when set' },
    { key: 'reminder_opt_in', type: 'boolean', label: 'Remind me before expiry', required: false },
  ]),
});

const PRESCRIPTION_OTHER = Object.freeze({
  id: 'prescription.other',
  tag: 'prescription',
  subtype: 'other',
  label: 'Other prescription',
  fields: Object.freeze([
    { key: 'date', type: 'date', label: 'Date', required: true, denorm: 'issue_date' },
    { key: 'drug', type: 'string', label: 'What is it', required: true },
    { key: 'prescriber', type: 'string', label: 'Prescriber / clinic', required: false, denorm: 'provider' },
    { key: 'expiry', type: 'date', label: 'Expires', required: false, denorm: 'expiry_date' },
    { key: 'note', type: 'text', label: 'Notes', required: false },
  ]),
});

const LAB_RESULT = Object.freeze({
  id: 'lab.result',
  tag: 'lab',
  subtype: 'lab',
  label: 'Lab result',
  fields: Object.freeze([
    { key: 'date', type: 'date', label: 'Date', required: true, denorm: 'issue_date' },
    { key: 'title', type: 'string', label: 'Test name', required: false },
    { key: 'provider', type: 'string', label: 'Provider / lab', required: false, denorm: 'provider' },
    { key: 'findings', type: 'text', label: 'Results / findings', required: false },
    { key: 'free_text', type: 'text', label: 'Full text', required: false },
    { key: 'source_language', type: 'string', label: 'Document language', required: false },
    { key: 'display_language', type: 'string', label: 'Display language', required: false },
  ]),
});

const LAB_IMAGING = Object.freeze({
  id: 'lab.imaging_report',
  tag: 'lab',
  subtype: 'imaging_report',
  label: 'Imaging / radiology report',
  fields: Object.freeze([
    { key: 'date', type: 'date', label: 'Date', required: true, denorm: 'issue_date' },
    { key: 'study_type', type: 'string', label: 'Study / test name', required: false },
    { key: 'body_region', type: 'string', label: 'Body region', required: false },
    { key: 'provider', type: 'string', label: 'Reading physician', required: false, denorm: 'provider' },
    { key: 'facility', type: 'string', label: 'Facility', required: false },
    { key: 'findings', type: 'text', label: 'Findings (from your document)', required: false },
    { key: 'conclusion', type: 'text', label: 'Conclusion (from your document)', required: false },
    { key: 'images_available_externally', type: 'boolean', label: 'Images available externally', required: false },
    { key: 'external_images_note', type: 'text', label: 'External images note', required: false },
    { key: 'title', type: 'string', label: 'Title', required: false },
    { key: 'source_language', type: 'string', label: 'Document language', required: false },
    { key: 'display_language', type: 'string', label: 'Display language', required: false },
  ]),
});

/** Lightweight defaults for tags not yet fully migrated to rich templates. */
const SKIN_DEFAULT = Object.freeze({
  id: 'skin.default',
  tag: 'skin',
  subtype: 'default',
  label: 'Skin log',
  fields: Object.freeze([
    { key: 'date', type: 'date', label: 'Date', required: true, denorm: 'issue_date' },
    { key: 'body_area', type: 'string', label: 'Body area', required: false },
    { key: 'note', type: 'text', label: 'Note', required: false },
  ]),
});

const BILL_DEFAULT = Object.freeze({
  id: 'bill.default',
  tag: 'bill',
  subtype: 'default',
  label: 'Bill / receipt',
  fields: Object.freeze([
    { key: 'date', type: 'date', label: 'Date', required: true, denorm: 'issue_date' },
    { key: 'provider', type: 'string', label: 'Provider', required: false, denorm: 'provider' },
    // Canonical money: integer minor units. Never store major units in this key.
    { key: 'amount_cents', type: 'money_cents', label: 'Amount', required: false },
    { key: 'currency', type: 'string', label: 'Currency', required: false },
    { key: 'doc_type', type: 'string', label: 'Document type', required: false },
  ]),
});

const MARK_DEFAULT = Object.freeze({
  id: 'mark.default',
  tag: 'mark',
  subtype: 'default',
  label: 'Mark',
  fields: Object.freeze([
    { key: 'date', type: 'date', label: 'Date', required: true, denorm: 'issue_date' },
    { key: 'body_location', type: 'string', label: 'Location', required: true },
    { key: 'note', type: 'text', label: 'Note', required: false },
  ]),
});

const OTHER_DEFAULT = Object.freeze({
  id: 'other.default',
  tag: 'other',
  subtype: 'default',
  label: 'Other',
  fields: Object.freeze([
    { key: 'date', type: 'date', label: 'Date', required: true, denorm: 'issue_date' },
    { key: 'label', type: 'string', label: 'Label', required: true },
    { key: 'free_text_facts', type: 'text', label: 'Notes', required: false },
  ]),
});

const CATALOG = Object.freeze([
  PRESCRIPTION_MEDICATION,
  PRESCRIPTION_OPTICAL,
  PRESCRIPTION_OTHER,
  LAB_RESULT,
  LAB_IMAGING,
  SKIN_DEFAULT,
  BILL_DEFAULT,
  MARK_DEFAULT,
  OTHER_DEFAULT,
]);

const BY_ID = Object.freeze(Object.fromEntries(CATALOG.map((t) => [t.id, t])));

function listTemplates({ tag } = {}) {
  if (!tag) return CATALOG.slice();
  return CATALOG.filter((t) => t.tag === String(tag));
}

function getTemplate(templateId) {
  return BY_ID[String(templateId || '')] || null;
}

function getTemplateForTagSubtype(tag, subtype) {
  const t = String(tag || '');
  const s = String(subtype || 'default');
  return (
    CATALOG.find((x) => x.tag === t && x.subtype === s) ||
    CATALOG.find((x) => x.tag === t && x.subtype === 'default') ||
    CATALOG.find((x) => x.tag === t) ||
    null
  );
}

/** User-editable fields only (exclude system keys). */
function editableFields(template) {
  if (!template || !Array.isArray(template.fields)) return [];
  return template.fields.filter((f) => !f.system);
}

module.exports = {
  CATALOG,
  COMMON_META,
  PRESCRIPTION_MEDICATION,
  PRESCRIPTION_OPTICAL,
  PRESCRIPTION_OTHER,
  LAB_RESULT,
  LAB_IMAGING,
  listTemplates,
  getTemplate,
  getTemplateForTagSubtype,
  editableFields,
  YN,
};
