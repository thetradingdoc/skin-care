'use strict';

/**
 * P2.02–P2.07 — Per-tag structured_json validators for patient_record_facts.
 * Returns { valid, errors[], normalized } — never throws.
 */

const RECORD_TAGS = Object.freeze(['skin', 'bill', 'prescription', 'mark', 'lab', 'other']);
const MEDIA_TYPES = Object.freeze(['photo', 'pdf']);
const AI_OR_MANUAL = Object.freeze(['ai', 'manual']);

function isIsoDate(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function asString(v, max = 2000) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function asNumber(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asBool(v) {
  if (v === true || v === false) return v;
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return null;
}

function requireFields(obj, fields, errors) {
  for (const f of fields) {
    if (obj[f] == null || obj[f] === '') errors.push(`${f}_required`);
  }
}

function normalizeVisualPointerField(raw, errors) {
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push('visual_pointer_invalid');
    return null;
  }
  const { assertVisualPointerShape } = require('./medical-tracker-rails/visual-observation-pointer');
  const gate = assertVisualPointerShape(raw);
  if (!gate.ok) {
    errors.push(String(gate.error_code || 'visual_pointer_invalid').toLowerCase());
    return null;
  }
  // Pass through only allowlisted keys (schema already locked — no scores/%).
  const out = {
    zones: Array.isArray(raw.zones) ? raw.zones.map((z) => String(z)).slice(0, 12) : [],
    zone_labels: Array.isArray(raw.zone_labels)
      ? raw.zone_labels.map((z) => String(z).slice(0, 80)).slice(0, 12)
      : [],
    labeled: 'ai_suggestion',
    not_diagnosis: true,
  };
  if (raw.text != null) out.text = asString(raw.text, 2000);
  if (raw.compare_group_id != null) out.compare_group_id = asString(raw.compare_group_id, 80);
  return out;
}

/** P2.02 skin */
function validateSkinStructured(raw = {}) {
  const errors = [];
  rejectForbiddenClinicalKeys(raw, errors);
  const date = asString(raw.date || raw.entry_date, 10);
  if (date && !isIsoDate(date)) errors.push('date_invalid');
  const normalized = {
    date: date && isIsoDate(date) ? date : null,
    body_area: asString(raw.body_area || raw.area || raw.bodyArea, 120),
    note: asString(raw.note, 2000),
    visual_pointer: normalizeVisualPointerField(raw.visual_pointer, errors),
    // AI suggestion kept separate — never blended into note
    ai_suggestion:
      raw.ai_suggestion != null
        ? typeof raw.ai_suggestion === 'object'
          ? raw.ai_suggestion
          : { text: asString(raw.ai_suggestion, 2000) }
        : null,
  };
  requireFields(normalized, ['date'], errors);
  return { valid: errors.length === 0, errors, normalized };
}

/** P2.03 bill — canonical money is amount_cents (integer minor units). */
function validateBillStructured(raw = {}) {
  const errors = [];
  rejectForbiddenClinicalKeys(raw, errors);
  const date = asString(raw.date || raw.service_date, 10);
  if (date && !isIsoDate(date)) errors.push('date_invalid');

  let amountCents = null;
  if (raw.amount_cents != null && raw.amount_cents !== '') {
    const n = Number(raw.amount_cents);
    if (!Number.isFinite(n)) errors.push('amount_cents_invalid');
    else {
      amountCents = Math.round(n);
      if (amountCents < 0) errors.push('amount_cents_invalid');
    }
  } else if (raw.amount != null && raw.amount !== '') {
    // Legacy major-unit input → convert once at the write boundary
    const major = Number(raw.amount);
    if (!Number.isFinite(major)) errors.push('amount_invalid');
    else {
      amountCents = Math.round(major * 100);
      if (amountCents < 0) errors.push('amount_invalid');
    }
  }

  const normalized = {
    date: date && isIsoDate(date) ? date : null,
    provider: asString(raw.provider || raw.provider_name, 200),
    amount_cents: amountCents,
    currency: asString(raw.currency || 'USD', 8) || 'USD',
    doc_type: asString(raw.doc_type || raw.document_type, 80),
    template_id: asString(raw.template_id, 80) || 'bill.default',
    fields_absent: Array.isArray(raw.fields_absent)
      ? raw.fields_absent.map((k) => String(k).slice(0, 64)).slice(0, 64)
      : null,
  };
  requireFields(normalized, ['date'], errors);
  return { valid: errors.length === 0, errors, normalized };
}

const PRESCRIPTION_COMMERCE_KEYS = Object.freeze([
  'commerce_variant_id',
  'variant_id',
  'shopify_variant_id',
  'purchase_url',
  'buy_url',
  'product_handle',
  'checkout_url',
]);

/** CF-1 — reject diagnosis-shaped keys at schema layer (fail loud, never silent strip). */
const FORBIDDEN_CLINICAL_KEYS = Object.freeze([
  'diagnosis',
  'diagnoses',
  'condition',
  'conditions',
  'disease',
  'disease_name',
  'icd',
  'icd10',
  'icd_code',
  'dx',
  'differential',
  'pathology',
]);

function rejectForbiddenClinicalKeys(raw, errors) {
  if (!raw || typeof raw !== 'object') return;
  for (const k of FORBIDDEN_CLINICAL_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, k) && raw[k] != null && raw[k] !== '') {
      errors.push('forbidden_clinical_key');
      return;
    }
  }
}

/** P2.04 prescription */
function validatePrescriptionStructured(raw = {}) {
  const errors = [];
  const input = raw && typeof raw === 'object' ? raw : {};
  rejectForbiddenClinicalKeys(input, errors);
  const commerceFound = PRESCRIPTION_COMMERCE_KEYS.filter(
    (k) => input[k] != null && input[k] !== '',
  );
  if (commerceFound.length) {
    errors.push('prescription_commerce_forbidden');
  }
  const date = asString(input.date, 10);
  const expiry = asString(input.expiry || input.expiry_date, 10);
  if (date && !isIsoDate(date)) errors.push('date_invalid');
  if (expiry && !isIsoDate(expiry)) errors.push('expiry_invalid');
  const rxKindRaw = asString(input.rx_kind || input.rxKind, 32);
  let rxKind =
    rxKindRaw && /^(medication|optical|unknown|other)$/i.test(rxKindRaw)
      ? rxKindRaw.toLowerCase()
      : null;
  const templateId = asString(input.template_id, 80);
  const hasOpticalKeys = ['od_sph', 'os_sph', 'od_cyl', 'os_cyl', 'od_axis', 'os_axis'].some(
    (k) => input[k] != null && String(input[k]).trim() !== '',
  );
  const isOptical =
    rxKind === 'optical' || templateId === 'prescription.optical' || hasOpticalKeys;
  if (isOptical && !rxKind) rxKind = 'optical';

  const normalized = {
    drug: asString(input.drug || input.drug_name || input.name, 200),
    strength: asString(input.strength, 80),
    prescriber: asString(input.prescriber, 200),
    date: date && isIsoDate(date) ? date : null,
    expiry: expiry && isIsoDate(expiry) ? expiry : null,
    reminder_opt_in: asBool(input.reminder_opt_in ?? input.refill_reminder_opt_in) ?? false,
    note: asString(input.note || input.rx_note, 2000),
    rx_kind: rxKind,
    template_id: templateId,
    fields_absent: Array.isArray(input.fields_absent)
      ? input.fields_absent.map((k) => String(k).slice(0, 64)).slice(0, 64)
      : null,
    // Optical template detail (encrypted JSON; denorm columns handle queryables)
    practice: asString(input.practice, 200),
    od_sph: asString(input.od_sph, 16),
    od_cyl: asString(input.od_cyl, 16),
    od_axis: asString(input.od_axis, 8),
    os_sph: asString(input.os_sph, 16),
    os_cyl: asString(input.os_cyl, 16),
    os_axis: asString(input.os_axis, 8),
    multifocal: asString(input.multifocal, 16),
    tint: asString(input.tint, 16),
    pd: asNumber(input.pd),
  };

  // Optical: drug is display title, not a hard medication field — default if missing
  if (isOptical) {
    if (!normalized.drug) normalized.drug = 'Glasses prescription';
    if (Array.isArray(normalized.fields_absent)) {
      normalized.fields_absent = normalized.fields_absent.filter((k) => k !== 'drug');
    }
    // Reject axis-like values in SPH/CYL (e.g. 045) — asString alone would accept them
    const diopterOk = (raw) => {
      if (raw == null || raw === '') return true;
      const s = String(raw).replace(/\s+/g, '');
      const n = Number(s);
      if (!Number.isFinite(n) || Math.abs(n) > 20) return false;
      if (/^\d{3,}$/.test(s)) return false;
      return true;
    };
    const axisOk = (raw) => {
      if (raw == null || raw === '') return true;
      const n = Number(String(raw).replace(/\s+/g, ''));
      return Number.isFinite(n) && n >= 0 && n <= 180;
    };
    for (const k of ['od_sph', 'od_cyl', 'os_sph', 'os_cyl']) {
      if (!diopterOk(normalized[k])) {
        errors.push(`${k}_diopter_invalid`);
        normalized[k] = null;
      }
    }
    for (const k of ['od_axis', 'os_axis']) {
      if (!axisOk(normalized[k])) {
        errors.push(`${k}_axis_invalid`);
        normalized[k] = null;
      } else if (normalized[k] != null && normalized[k] !== '') {
        normalized[k] = String(Math.round(Number(normalized[k]))).padStart(3, '0');
      }
    }
  } else {
    requireFields(normalized, ['drug'], errors);
  }

  // Drop stale drug_required if drug is now present (post-backfill)
  if (normalized.drug) {
    for (let i = errors.length - 1; i >= 0; i--) {
      if (errors[i] === 'drug_required') errors.splice(i, 1);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized,
    forbidden_commerce_keys: commerceFound.length ? commerceFound : undefined,
  };
}

/** P2.05 mark — compare_group_id nullable until P3.24 */
function validateMarkStructured(raw = {}) {
  const errors = [];
  rejectForbiddenClinicalKeys(raw, errors);
  const date = asString(raw.date, 10);
  if (date && !isIsoDate(date)) errors.push('date_invalid');
  const normalized = {
    date: date && isIsoDate(date) ? date : null,
    body_location: asString(raw.body_location || raw.location || raw.body_region, 120),
    note: asString(raw.note, 2000),
    photo_ref: asString(raw.photo_ref || raw.storage_ref, 500),
    compare_group_id: asString(raw.compare_group_id, 80),
    visual_pointer: normalizeVisualPointerField(raw.visual_pointer, errors),
  };
  requireFields(normalized, ['date', 'body_location'], errors);
  return { valid: errors.length === 0, errors, normalized };
}

/** P2.06 lab (+ imaging_report subtype) */
function validateLabStructured(raw = {}) {
  const errors = [];
  rejectForbiddenClinicalKeys(raw, errors);
  const date = asString(raw.date, 10);
  if (date && !isIsoDate(date)) errors.push('date_invalid');
  const labKindRaw = asString(raw.lab_kind, 32);
  const lab_kind =
    labKindRaw && /^(lab|imaging_report)$/i.test(labKindRaw)
      ? labKindRaw.toLowerCase()
      : labKindRaw
        ? 'lab'
        : null;
  // field_provenance may be present from server extract; HTTP confirm always
  // strip+recomputes via prepareConfirmStructuredForPersist (never trust client).
  const fieldProvenance =
    raw.field_provenance && typeof raw.field_provenance === 'object' && !Array.isArray(raw.field_provenance)
      ? Object.fromEntries(
          Object.entries(raw.field_provenance)
            .filter(([, v]) => v === 'document' || v === 'ai' || v === 'user')
            .map(([k, v]) => [String(k).slice(0, 64), v]),
        )
      : null;
  const normalized = {
    date: date && isIsoDate(date) ? date : null,
    provider: asString(raw.provider, 200),
    title: asString(raw.title, 200),
    source_language: asString(raw.source_language, 32),
    display_language: asString(raw.display_language, 32),
    results: raw.results != null && typeof raw.results === 'object' ? raw.results : null,
    free_text: asString(raw.free_text || raw.results_text, 8000),
    lab_kind,
    study_type: asString(raw.study_type, 200),
    body_region: asString(raw.body_region, 120),
    facility: asString(raw.facility, 200),
    findings: asString(raw.findings, 8000),
    conclusion: asString(raw.conclusion || raw.impression, 8000),
    images_available_externally: asBool(raw.images_available_externally) ?? false,
    external_images_note: asString(raw.external_images_note, 500),
    field_provenance: fieldProvenance && Object.keys(fieldProvenance).length ? fieldProvenance : null,
    template_id: asString(raw.template_id, 80),
    fields_absent: Array.isArray(raw.fields_absent)
      ? raw.fields_absent.map((k) => String(k).slice(0, 64)).slice(0, 64)
      : null,
  };
  requireFields(normalized, ['date'], errors);
  if (!normalized.results && !normalized.free_text && !normalized.findings && !normalized.conclusion) {
    // either structured or free-text is enough; all empty is ok at draft stage
  }
  return { valid: errors.length === 0, errors, normalized };
}

/** P2.07 other */
function validateOtherStructured(raw = {}) {
  const errors = [];
  rejectForbiddenClinicalKeys(raw, errors);
  const date = asString(raw.date, 10);
  if (date && !isIsoDate(date)) errors.push('date_invalid');
  const normalized = {
    date: date && isIsoDate(date) ? date : null,
    label: asString(raw.label, 200),
    free_text_facts: asString(raw.free_text_facts || raw.facts || raw.note, 8000),
  };
  requireFields(normalized, ['date', 'label'], errors);
  return { valid: errors.length === 0, errors, normalized };
}

const VALIDATORS = {
  skin: validateSkinStructured,
  bill: validateBillStructured,
  prescription: validatePrescriptionStructured,
  mark: validateMarkStructured,
  lab: validateLabStructured,
  other: validateOtherStructured,
};

function validateTagStructured(tag, raw) {
  const t = String(tag || '').trim().toLowerCase();
  if (!RECORD_TAGS.includes(t)) {
    return { valid: false, errors: ['tag_invalid'], normalized: null };
  }
  return VALIDATORS[t](raw && typeof raw === 'object' ? raw : {});
}

function parseStructuredJsonInput(raw) {
  if (raw == null || raw === '') return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return { __parse_error: true };
  }
}

module.exports = {
  RECORD_TAGS,
  MEDIA_TYPES,
  AI_OR_MANUAL,
  PRESCRIPTION_COMMERCE_KEYS,
  FORBIDDEN_CLINICAL_KEYS,
  VALIDATORS,
  validateTagStructured,
  validateSkinStructured,
  validateBillStructured,
  validatePrescriptionStructured,
  validateMarkStructured,
  validateLabStructured,
  validateOtherStructured,
  parseStructuredJsonInput,
};
