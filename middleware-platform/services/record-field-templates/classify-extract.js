'use strict';

/**
 * Classify-then-extract: pick which template applies, then fill its fields.
 * Phase 1: heuristic classify (no extra GPT). Hook for AI classify later.
 */

const { getTemplate, getTemplateForTagSubtype } = require('./catalog');
const { applyTemplate } = require('./apply-template');
const {
  parsePrescriptionFieldsFromText,
  detectOptical,
} = require('../prescription-ocr-parser');
const { parseImagingReportFromText, detectImagingReport } = require('../imaging-report-parser');
const { parseBillingFieldsFromText } = require('../billing-ocr-parser');

const OPTICAL_HINT_KEYS = Object.freeze([
  'od_sph',
  'os_sph',
  'od_cyl',
  'os_cyl',
  'od_axis',
  'os_axis',
]);

function hasOpticalHintKeys(hints = {}) {
  return OPTICAL_HINT_KEYS.some((k) => {
    const v = hints[k];
    return v != null && String(v).trim() !== '';
  });
}

/**
 * @param {{ tag: string, ocrText?: string, userHints?: object, preferTemplateId?: string }} opts
 * @returns {{ template_id: string|null, method: string, confidence: number, error_code?: string, message?: string }}
 */
function classifyTemplate(opts = {}) {
  const tag = String(opts.tag || '').toLowerCase();
  const hints = opts.userHints || {};
  const text = String(opts.ocrText || '');

  if (opts.preferTemplateId && getTemplate(opts.preferTemplateId)) {
    return { template_id: opts.preferTemplateId, method: 'hint', confidence: 1 };
  }
  if (hints.template_id && getTemplate(hints.template_id)) {
    return { template_id: hints.template_id, method: 'hint', confidence: 1 };
  }

  if (tag === 'prescription') {
    const kind = hints.rx_kind || hints.subtype;
    if (kind && getTemplateForTagSubtype('prescription', kind)) {
      return {
        template_id: getTemplateForTagSubtype('prescription', kind).id,
        method: 'hint',
        confidence: 0.95,
      };
    }
    // Optical keys present → force optical even without subtype (never wipe OD/OS via .other)
    if (hasOpticalHintKeys(hints)) {
      return { template_id: 'prescription.optical', method: 'optical_keys', confidence: 0.9 };
    }
    if (text && detectOptical(text)) {
      return { template_id: 'prescription.optical', method: 'heuristic', confidence: 0.85 };
    }
    if (text) {
      return { template_id: 'prescription.medication', method: 'heuristic', confidence: 0.6 };
    }
    // Manual with drug/note but no subtype — sensible default (medication), not silent .other wipe
    if (hints.drug || hints.drug_name || hints.name || hints.note || hints.label) {
      return { template_id: 'prescription.medication', method: 'default', confidence: 0.5 };
    }
    // Genuinely ambiguous empty manual Rx — loud error, not silent prescription.other
    return {
      template_id: null,
      method: 'ambiguous',
      confidence: 0,
      error_code: 'RX_KIND_REQUIRED',
      message:
        'Specify rx_kind (optical or medication) or enter OD/OS values — prescription subtype is required',
    };
  }

  if (tag === 'lab') {
    const kind = hints.lab_kind || hints.subtype;
    if (kind && getTemplateForTagSubtype('lab', kind)) {
      return {
        template_id: getTemplateForTagSubtype('lab', kind).id,
        method: 'hint',
        confidence: 0.95,
      };
    }
    if (text && detectImagingReport(text)) {
      return { template_id: 'lab.imaging_report', method: 'heuristic', confidence: 0.85 };
    }
    return { template_id: 'lab.result', method: 'default', confidence: 0.5 };
  }

  const fallback = getTemplateForTagSubtype(tag, 'default');
  return {
    template_id: fallback ? fallback.id : `${tag}.default`,
    method: 'default',
    confidence: 0.5,
  };
}

/**
 * Extract raw field bag for a classified template (heuristic parsers).
 */
function extractFieldsForTemplate(templateId, { ocrText = '', userHints = {} } = {}) {
  const text = String(ocrText || '');
  const hints = { ...(userHints || {}) };
  // Never accept client-asserted provenance — only parsers stamp 'document'
  delete hints.field_provenance;
  const bag = { ...hints };

  if (templateId === 'prescription.optical' || templateId === 'prescription.medication' || templateId === 'prescription.other') {
    const parsed = text ? parsePrescriptionFieldsFromText({ text }) : null;
    if (parsed) {
      if (templateId === 'prescription.optical') {
        // Prefer structured OD/OS from strength summary when parser produced it.
        // Group map is fixed: 1=SPH, 2=CYL, 3=AXIS — reject axis-like SPH/CYL
        // (e.g. 045) so a leaked axis cannot land in os_sph.
        const strength = parsed.strength || '';
        const od = strength.match(/OD\s+([+\-]?\d+(?:\.\d+)?)\/([+\-]?\d+(?:\.\d+)?)x(\d+)/i);
        const os = strength.match(/OS\s+([+\-]?\d+(?:\.\d+)?)\/([+\-]?\d+(?:\.\d+)?)x(\d+)/i);
        const asDiopter = (raw) => {
          if (raw == null || raw === '') return null;
          const s = String(raw).replace(/\s+/g, '');
          const n = Number(s);
          if (!Number.isFinite(n) || Math.abs(n) > 20) return null;
          if (/^\d{3,}$/.test(s)) return null; // axis-like, not a sphere/cyl
          return s;
        };
        const asAxis = (raw) => {
          if (raw == null || raw === '') return null;
          const s = String(raw).replace(/\s+/g, '');
          const n = Number(s);
          if (!Number.isFinite(n) || n < 0 || n > 180) return null;
          return String(Math.round(n)).padStart(3, '0');
        };
        if (od) {
          const sph = asDiopter(od[1]);
          const cyl = asDiopter(od[2]);
          const axis = asAxis(od[3]);
          if (sph != null) bag.od_sph = sph;
          if (cyl != null) bag.od_cyl = cyl;
          if (axis != null) bag.od_axis = axis;
        }
        if (os) {
          const sph = asDiopter(os[1]);
          const cyl = asDiopter(os[2]);
          const axis = asAxis(os[3]);
          // Always overwrite from the matched strength groups (do not keep a
          // stale hint that may already hold the axis in os_sph).
          if (sph != null) bag.os_sph = sph;
          else delete bag.os_sph;
          if (cyl != null) bag.os_cyl = cyl;
          if (axis != null) bag.os_axis = axis;
        }
        const pd = strength.match(/PD\s+(\d+(?:\.\d+)?)/i);
        if (pd) bag.pd = bag.pd || Number(pd[1]);
        bag.practice = bag.practice || parsed.prescriber;
        bag.prescriber = bag.prescriber || parsed.prescriber;
        bag.expiry = bag.expiry || parsed.expiry;
        bag.date = bag.date || parsed.date;
        bag.note = bag.note || parsed.note;
        bag.drug = bag.drug || 'Glasses prescription';
        // Multifocal / tint from OCR text
        if (/multifocal[\s\S]{0,40}\bno\b/i.test(text)) bag.multifocal = bag.multifocal || 'no';
        if (/multifocal[\s\S]{0,40}\byes\b/i.test(text)) bag.multifocal = bag.multifocal || 'yes';
        if (/\bcolor\b[\s\S]{0,40}\bno\b/i.test(text)) bag.tint = bag.tint || 'no';
        if (/\bcolor\b[\s\S]{0,40}\byes\b/i.test(text)) bag.tint = bag.tint || 'yes';
      } else {
        bag.drug = bag.drug || parsed.drug;
        bag.strength = bag.strength || parsed.strength;
        bag.prescriber = bag.prescriber || parsed.prescriber;
        bag.expiry = bag.expiry || parsed.expiry;
        bag.date = bag.date || parsed.date;
        bag.note = bag.note || parsed.note;
      }
    }
    // Manual note → drug when empty
    if (!bag.drug && hints.note) {
      bag.drug = String(hints.note).slice(0, 200);
      bag.note = bag.note || hints.note;
    }
  }

  if (templateId === 'lab.imaging_report') {
    const imaging = text ? parseImagingReportFromText({ text }) : null;
    if (imaging) {
      Object.assign(bag, {
        date: bag.date || imaging.date,
        provider: bag.provider || imaging.provider,
        facility: bag.facility || imaging.facility,
        study_type: bag.study_type || imaging.study_type,
        body_region: bag.body_region || imaging.body_region,
        title: bag.title || imaging.title,
        findings: bag.findings || imaging.findings,
        conclusion: bag.conclusion || imaging.conclusion,
        images_available_externally:
          bag.images_available_externally ?? imaging.images_available_externally,
        external_images_note: bag.external_images_note || imaging.external_images_note,
        field_provenance: imaging.field_provenance,
      });
    }
  }

  if (templateId === 'lab.result') {
    bag.free_text = bag.free_text || text || hints.free_text || null;
    bag.title = bag.title || hints.title || 'Lab result';
    // Stamp document provenance only when OCR/PDF text actually produced the free_text
    if (text && bag.free_text) {
      bag.field_provenance = { ...(bag.field_provenance || {}), free_text: 'document' };
    }
  }

  if (templateId === 'bill.default') {
    if (text) {
      const bill = parseBillingFieldsFromText({ text });
      bag.provider = bag.provider || bill.provider_name;
      bag.date = bag.date || bill.service_date;
      bag.amount_cents = bag.amount_cents ?? bill.amount_cents;
      bag.doc_type = bag.doc_type || bill.document_type;
    }
    if (bag.amount_cents == null && bag.amount != null) {
      const major = Number(bag.amount);
      if (Number.isFinite(major)) bag.amount_cents = Math.round(major * 100);
    }
    bag.currency = bag.currency || 'USD';
    bag.doc_type = bag.doc_type || 'receipt';
  }

  return bag;
}

/**
 * Full classify → extract → applyTemplate pipeline.
 */
function structureWithTemplate({ tag, ocrText = '', userHints = {}, preferTemplateId = null } = {}) {
  const classification = classifyTemplate({ tag, ocrText, userHints, preferTemplateId });
  if (!classification.template_id || classification.error_code) {
    return {
      valid: false,
      errors: [classification.error_code || 'TEMPLATE_REQUIRED'],
      normalized: null,
      fields_absent: [],
      classification,
      template_id: null,
      error_code: classification.error_code || 'TEMPLATE_REQUIRED',
      message: classification.message || 'Could not classify record template',
      raw_extract_text: ocrText || null,
    };
  }
  const template = getTemplate(classification.template_id);
  const bag = extractFieldsForTemplate(classification.template_id, { ocrText, userHints });
  // Ensure date default
  if (!bag.date && userHints.date) bag.date = userHints.date;
  if (!bag.date) bag.date = new Date().toISOString().slice(0, 10);

  const applied = applyTemplate(template, bag);
  return {
    ...applied,
    classification,
    template_id: classification.template_id,
    raw_extract_text: ocrText || null,
  };
}

module.exports = {
  classifyTemplate,
  extractFieldsForTemplate,
  structureWithTemplate,
  hasOpticalHintKeys,
  OPTICAL_HINT_KEYS,
};
