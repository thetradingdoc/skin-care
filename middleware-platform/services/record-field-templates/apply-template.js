'use strict';

/**
 * Validate / coerce values against a field template.
 * Marks template keys that are missing as fields_absent (never silent omit).
 */

const { getTemplate, editableFields } = require('./catalog');

const DIOPTER_RE = /^[+-]?\d+(?:\.\d+)?$/;
const AXIS_RE = /^(?:0?[0-9]{1,2}|1[0-7][0-9]|180)$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function coerceDiopter(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).replace(/\s+/g, '').replace(/D$/i, '');
  if (!DIOPTER_RE.test(s)) return { error: 'diopter_invalid', value: null };
  const n = Number(s);
  if (!Number.isFinite(n) || Math.abs(n) > 30) return { error: 'diopter_out_of_range', value: null };
  return { value: s.startsWith('+') || s.startsWith('-') ? s : String(n), error: null };
}

function coerceAxis(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).replace(/\s+/g, '').replace(/°/g, '');
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 180) return { error: 'axis_invalid', value: null };
  return { value: String(Math.round(n)).padStart(3, '0'), error: null };
}

function coerceNumber(raw, field) {
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).replace(/[^\d.+-]/g, ''));
  if (!Number.isFinite(n)) return { error: 'number_invalid', value: null };
  if (field.key === 'pd' && (n < 40 || n > 80)) return { error: 'pd_out_of_range', value: null };
  return { value: n, error: null };
}

/**
 * Canonical bill money: always integer minor units (cents).
 * - number / integer string → cents as-is (OCR + TemplateFieldsForm store cents)
 * - decimal string ("84.00") → major units × 100 (defensive if UI skipped conversion)
 */
function coerceMoneyCents(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0) return { error: 'money_invalid', value: null };
    return { value: Math.round(raw), error: null };
  }
  const s = String(raw).trim().replace(/[$,\s]/g, '');
  if (!s) return null;
  if (s.includes('.')) {
    const major = Number(s);
    if (!Number.isFinite(major) || major < 0) return { error: 'money_invalid', value: null };
    return { value: Math.round(major * 100), error: null };
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return { error: 'money_invalid', value: null };
  return { value: Math.round(n), error: null };
}

function coerceDate(raw, opts = {}) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  // Unambiguous ISO — always prefer
  if (ISO_DATE_RE.test(s)) return { value: s, error: null };
  const slash = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2}|\d{2})$/);
  if (slash) {
    let y = slash[3];
    if (y.length === 2) y = `20${y}`;
    const a = slash[1].padStart(2, '0');
    const b = slash[2].padStart(2, '0');
    // dayFirst: DD/MM/YYYY (Spanish / imaging FECHA). Default: MM/DD/YYYY (US).
    const dayFirst =
      opts.dayFirst === true ||
      String(opts.sourceLanguage || opts.source_language || '').toLowerCase() === 'es';
    const value = dayFirst ? `${y}-${b}-${a}` : `${y}-${a}-${b}`;
    // Reject impossible months
    const month = Number(dayFirst ? b : a);
    const day = Number(dayFirst ? a : b);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return { error: 'date_invalid', value: null };
    }
    return { value, error: null };
  }
  return { error: 'date_invalid', value: null };
}

function coerceEnum(raw, field) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().toLowerCase();
  const allowed = (field.enum || []).map((x) => String(x).toLowerCase());
  if (s === 'y' || s === 'true' || s === '1') {
    if (allowed.includes('yes')) return { value: 'yes', error: null };
  }
  if (s === 'n' || s === 'false' || s === '0') {
    if (allowed.includes('no')) return { value: 'no', error: null };
  }
  if (allowed.includes(s)) return { value: s, error: null };
  return { error: 'enum_invalid', value: null };
}

function coerceField(field, raw, opts = {}) {
  if (raw == null || raw === '') return { value: null, error: null, absent: true };
  switch (field.type) {
    case 'diopter':
      return { ...coerceDiopter(raw), absent: false };
    case 'axis':
      return { ...coerceAxis(raw), absent: false };
    case 'number':
      return { ...coerceNumber(raw, field), absent: false };
    case 'money_cents':
      return { ...coerceMoneyCents(raw), absent: false };
    case 'date':
      return { ...coerceDate(raw, opts), absent: false };
    case 'enum':
      return { ...coerceEnum(raw, field), absent: false };
    case 'boolean': {
      if (raw === true || raw === false) return { value: raw, error: null, absent: false };
      if (raw === 'true' || raw === '1') return { value: true, error: null, absent: false };
      if (raw === 'false' || raw === '0') return { value: false, error: null, absent: false };
      return { value: null, error: 'boolean_invalid', absent: false };
    }
    case 'text':
    case 'string':
    default: {
      const s = String(raw).trim();
      if (!s) return { value: null, error: null, absent: true };
      const max = field.type === 'text' ? 8000 : 500;
      return { value: s.slice(0, max), error: null, absent: false };
    }
  }
}

/**
 * @param {object} template
 * @param {object} draft - raw extracted / user values
 * @returns {{ valid: boolean, errors: string[], normalized: object, fields_absent: string[] }}
 */
function applyTemplate(template, draft = {}) {
  if (!template) {
    return { valid: false, errors: ['template_required'], normalized: null, fields_absent: [] };
  }
  const input = draft && typeof draft === 'object' ? draft : {};
  const errors = [];
  const normalized = {
    template_id: template.id,
    tag: template.tag,
    // subtype aliases used across the codebase
    rx_kind: template.tag === 'prescription' ? template.subtype : undefined,
    lab_kind: template.tag === 'lab' ? template.subtype : undefined,
  };
  if (template.tag === 'prescription') normalized.rx_kind = template.subtype;
  if (template.tag === 'lab') normalized.lab_kind = template.subtype;

  const sourceLanguage = String(
    input.source_language || input.display_language || '',
  ).toLowerCase();
  const dayFirst =
    template.id === 'lab.imaging_report' ||
    sourceLanguage === 'es' ||
    Boolean(input._day_first_dates);

  const absent = [];
  for (const field of editableFields(template)) {
    const raw = input[field.key];
    const coerced = coerceField(field, raw, {
      dayFirst,
      sourceLanguage,
    });
    if (coerced.error) {
      errors.push(`${field.key}_${coerced.error}`);
      absent.push(field.key);
      normalized[field.key] = null;
      continue;
    }
    if (coerced.absent || coerced.value == null) {
      if (field.required) errors.push(`${field.key}_required`);
      absent.push(field.key);
      normalized[field.key] = null;
    } else {
      normalized[field.key] = coerced.value;
    }
  }

  // Bill: legacy major-unit `amount` → amount_cents when template key still empty
  if (
    template.id === 'bill.default' &&
    (normalized.amount_cents == null || normalized.amount_cents === '') &&
    input.amount != null &&
    input.amount !== ''
  ) {
    const major = Number(input.amount);
    if (Number.isFinite(major) && major >= 0) {
      normalized.amount_cents = Math.round(major * 100);
      normalized.fields_absent = (normalized.fields_absent || []).filter((k) => k !== 'amount_cents');
      const ai = absent.indexOf('amount_cents');
      if (ai >= 0) absent.splice(ai, 1);
    }
  }
  if (template.id === 'bill.default' && !normalized.currency) {
    normalized.currency = input.currency || 'USD';
  }

  // Carry reminder keys when present. field_provenance is server-only (parsers / confirm recompute).
  if (input.reminder_opt_in != null && normalized.reminder_opt_in == null) {
    normalized.reminder_opt_in = Boolean(input.reminder_opt_in);
  }
  // Only keep provenance stamped by extract parsers in this bag — never from client hints
  // (extractFieldsForTemplate already deleted hints.field_provenance before merge).
  if (
    input.field_provenance &&
    typeof input.field_provenance === 'object' &&
    !Array.isArray(input.field_provenance)
  ) {
    normalized.field_provenance = input.field_provenance;
  }

  normalized.fields_absent = absent;

  // Optical: keep practice → prescriber alias for reminders/shelf
  if (template.id === 'prescription.optical') {
    if (!normalized.prescriber && normalized.practice) normalized.prescriber = normalized.practice;
    if (!normalized.drug) normalized.drug = 'Glasses prescription';
    // Drug was optional and may have been marked absent before default — clear stale markers
    normalized.fields_absent = (normalized.fields_absent || []).filter((k) => k !== 'drug');
    for (let i = errors.length - 1; i >= 0; i--) {
      if (errors[i] === 'drug_required' || String(errors[i]).startsWith('drug_')) {
        // only drop required-missing, keep type errors if any
        if (errors[i] === 'drug_required') errors.splice(i, 1);
      }
    }
    // Compact strength summary when OD/OS filled (backward-compatible confirm/shelf)
    if (normalized.od_sph != null && normalized.os_sph != null) {
      const od = `${normalized.od_sph}/${normalized.od_cyl || '—'}x${normalized.od_axis || '—'}`;
      const os = `${normalized.os_sph}/${normalized.os_cyl || '—'}x${normalized.os_axis || '—'}`;
      normalized.strength = `OD ${od}; OS ${os}${normalized.pd != null ? `; PD ${normalized.pd}` : ''}`.slice(
        0,
        80,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized,
    fields_absent: absent,
  };
}

function applyTemplateById(templateId, draft) {
  return applyTemplate(getTemplate(templateId), draft);
}

module.exports = {
  applyTemplate,
  applyTemplateById,
  coerceField,
  coerceDate,
  coerceDiopter,
  coerceAxis,
  coerceMoneyCents,
  DIOPTER_RE,
  AXIS_RE,
};
