'use strict';

/**
 * P3.08–P3.13 — Structure AI/OCR output into tag confirm payloads.
 * Always returns validator-compatible structured_json (+ optional ai_suggestion).
 */

const { v4: uuidv4 } = require('uuid');
const { validateTagStructured } = require('../patient-record-fact-validators');
const { detectLanguageStub } = require('../patient-record-language-stub');
const { parseBillingFieldsFromText } = require('../billing-ocr-parser');
// prescription/imaging parsers used via record-field-templates classify-extract

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function structureSkin({ vision = null, userHints = {}, rawText = null } = {}) {
  const { bodyAreaFromVisionFindings } = require('../face-read-vision');
  const { visualPointerFromVision } = require('../medical-tracker-rails/visual-observation-pointer');
  const findings = Array.isArray(vision?.findings) ? vision.findings : [];
  const summary =
    vision?.scan_summary ||
    (findings[0] && (findings[0].plain_language || findings[0].label || findings[0].text)) ||
    rawText ||
    null;
  const visual_pointer = visualPointerFromVision(vision, {
    text: summary ? String(summary).slice(0, 2000) : null,
  });
  const draft = {
    date: userHints.date || todayIso(),
    body_area:
      userHints.body_area || bodyAreaFromVisionFindings(vision) || null,
    note: userHints.note || null,
    // Region overlay lives on visual_pointer — never scores; never blend into note.
    visual_pointer: visual_pointer || null,
    ai_suggestion: summary
      ? {
          text: String(summary).slice(0, 2000),
          source: 'face_read_vision',
          labeled: 'ai_suggestion',
          not_diagnosis: true,
        }
      : null,
  };
  return validateTagStructured('skin', draft);
}

function structureBill({ ocrText = '', extraction = null, userHints = {}, mimeType = null, fileName = null } = {}) {
  const hints = { ...(userHints || {}) };
  if (extraction) {
    hints.provider = hints.provider || extraction.provider_name;
    hints.date = hints.date || extraction.service_date;
    if (hints.amount_cents == null && extraction.amount_cents != null) {
      hints.amount_cents = extraction.amount_cents;
    }
    hints.doc_type = hints.doc_type || extraction.document_type;
  }
  if (hints.amount_cents == null && hints.amount != null) {
    const major = Number(hints.amount);
    if (Number.isFinite(major)) hints.amount_cents = Math.round(major * 100);
  }
  if (!hints.currency) hints.currency = 'USD';

  const { structureWithTemplate } = require('../record-field-templates');
  const templated = structureWithTemplate({
    tag: 'bill',
    ocrText,
    userHints: hints,
    preferTemplateId: 'bill.default',
  });
  // Keep validator floor (amount_cents canonical) in agreement with template
  const validated = validateTagStructured('bill', {
    ...(templated.normalized || {}),
    currency: (templated.normalized && templated.normalized.currency) || hints.currency || 'USD',
    doc_type:
      (templated.normalized && templated.normalized.doc_type) || hints.doc_type || 'receipt',
  });
  return {
    ...validated,
    classification: templated.classification,
    template_id: templated.template_id || 'bill.default',
    fields_absent: templated.fields_absent || validated.normalized?.fields_absent,
    extraction: extraction || (ocrText ? parseBillingFieldsFromText({ text: ocrText, mimeType, fileName }) : null),
    raw_extract_text: ocrText || templated.raw_extract_text || null,
  };
}

function structurePrescription({ ocrText = '', userHints = {} } = {}) {
  const { structureWithTemplate } = require('../record-field-templates');
  const templated = structureWithTemplate({
    tag: 'prescription',
    ocrText,
    userHints,
  });
  if (!templated.valid && (templated.error_code === 'RX_KIND_REQUIRED' || !templated.normalized)) {
    return {
      valid: false,
      errors: templated.errors?.length ? templated.errors : ['rx_kind_required'],
      error_code: templated.error_code || 'RX_KIND_REQUIRED',
      message: templated.message,
      normalized: null,
      classification: templated.classification,
      fields_absent: [],
    };
  }
  const draft = { ...(templated.normalized || {}) };
  // Forward commerce keys so P2.04 schema rejects loudly (never silent drop before validate)
  const commerceKeys = [
    'commerce_variant_id',
    'variant_id',
    'shopify_variant_id',
    'purchase_url',
    'buy_url',
    'product_handle',
    'checkout_url',
  ];
  for (const k of commerceKeys) {
    if (userHints[k] != null && userHints[k] !== '') draft[k] = userHints[k];
  }
  // Optical already defaults drug in applyTemplate; medication/other still need a title
  if (!draft.drug && draft.rx_kind !== 'optical' && draft.template_id !== 'prescription.optical') {
    draft.drug = userHints.label || userHints.note || 'unknown';
  }
  if (draft.reminder_opt_in == null) draft.reminder_opt_in = userHints.reminder_opt_in ?? false;

  const validated = validateTagStructured('prescription', draft);
  // Template type errors (e.g. bad diopter) merge in — drop stale drug_required after backfill
  if (templated.errors?.length) {
    const merged = [...(validated.errors || []), ...templated.errors].filter((e) => {
      if (e === 'drug_required' && draft.drug) return false;
      return true;
    });
    validated.errors = [...new Set(merged)];
    validated.valid = validated.errors.length === 0;
  }
  const fieldsAbsent = (templated.fields_absent || draft.fields_absent || []).filter(
    (k) => !(k === 'drug' && draft.drug),
  );
  if (validated.normalized && Array.isArray(validated.normalized.fields_absent)) {
    validated.normalized.fields_absent = validated.normalized.fields_absent.filter(
      (k) => !(k === 'drug' && validated.normalized.drug),
    );
  }
  return {
    ...validated,
    raw_extract_text: ocrText || null,
    extraction: { template_id: templated.template_id, classification: templated.classification },
    fields_absent: fieldsAbsent,
  };
}

function structureMark({ vision = null, userHints = {}, photoRef = null } = {}) {
  const { bodyAreaFromVisionFindings } = require('../face-read-vision');
  const { visualPointerFromVision } = require('../medical-tracker-rails/visual-observation-pointer');
  const compareGroupId =
    userHints.compare_group_id ||
    userHints.compareGroupId ||
    // P3.24 — mint new group when creating a new mark
    `cg_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  const fromZones = bodyAreaFromVisionFindings(vision);
  const body_location =
    userHints.body_location || userHints.body_region || fromZones || 'unknown';
  let visual_pointer = visualPointerFromVision(vision, {
    compareGroupId,
    text: fromZones || null,
  });
  // Non-face mark: still store approximate label pointer (center marker), no scores.
  if (!visual_pointer && body_location && body_location !== 'unknown') {
    visual_pointer = {
      zones: [],
      zone_labels: [String(body_location).slice(0, 120)],
      labeled: 'ai_suggestion',
      not_diagnosis: true,
      compare_group_id: compareGroupId,
    };
  } else if (visual_pointer && !visual_pointer.compare_group_id) {
    visual_pointer = { ...visual_pointer, compare_group_id: compareGroupId };
  }
  const draft = {
    date: userHints.date || todayIso(),
    body_location,
    note: userHints.note || null,
    photo_ref: photoRef || userHints.photo_ref || null,
    compare_group_id: compareGroupId,
    visual_pointer: visual_pointer || null,
  };
  return validateTagStructured('mark', draft);
}

function structureLab({ ocrText = '', userHints = {} } = {}) {
  const { structureWithTemplate } = require('../record-field-templates');
  const text = String(ocrText || '');
  const detected = detectLanguageStub(text || userHints.free_text || '');
  const templated = structureWithTemplate({
    tag: 'lab',
    ocrText: text,
    userHints: {
      ...userHints,
      source_language: userHints.source_language || detected.source_language || 'en',
      display_language: userHints.display_language || detected.source_language || 'en',
    },
  });
  const draft = { ...(templated.normalized || {}) };
  if (!draft.source_language) draft.source_language = detected.source_language || 'en';
  if (!draft.display_language) draft.display_language = draft.source_language;
  const validated = validateTagStructured('lab', draft);
  if (templated.errors?.length) {
    validated.errors = [...(validated.errors || []), ...templated.errors];
    validated.valid = validated.errors.length === 0;
  }
  return {
    ...validated,
    raw_extract_text: ocrText || null,
    extraction: { template_id: templated.template_id, classification: templated.classification },
    fields_absent: templated.fields_absent || [],
  };
}

function structureOther({ ocrText = '', userHints = {} } = {}) {
  const draft = {
    date: userHints.date || todayIso(),
    label: userHints.label || 'Note',
    free_text_facts: userHints.free_text_facts || ocrText || userHints.note || null,
  };
  const validated = validateTagStructured('other', draft);
  return { ...validated, raw_extract_text: ocrText || null };
}

const STRUCTURERS = {
  skin: structureSkin,
  bill: structureBill,
  prescription: structurePrescription,
  mark: structureMark,
  lab: structureLab,
  other: structureOther,
};

function structureByTag(tag, ctx) {
  const fn = STRUCTURERS[tag];
  if (!fn) return { valid: false, errors: ['tag_invalid'], normalized: null };
  return fn(ctx || {});
}

module.exports = {
  structureByTag,
  structureSkin,
  structureBill,
  structurePrescription,
  structureMark,
  structureLab,
  structureOther,
  STRUCTURERS,
};
