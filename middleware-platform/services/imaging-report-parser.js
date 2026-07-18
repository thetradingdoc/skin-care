'use strict';

/**
 * Imaging / radiology report parser for lab-tag subtype `imaging_report`.
 * Splits Findings vs Conclusion/Impression; detects external image references.
 * Does not ingest DICOM or linked images.
 */

const IMAGING_MARKERS =
  /\b(?:resonancia|resonancia\s+magn[eé]tica|\bRMN\b|\bMRI\b|\bCT\b|tomograf|radiolog|ultrasound|ultrasonido|rayos?\s*x|x-?ray|hallazgos|findings|conclusi[oó]n|impression|impresi[oó]n)\b/i;

const EXTERNAL_IMAGE_MARKERS =
  /\b(?:da\s+clic|haz\s+clic|click\s+here|escanea|scan\s+the\s+(?:qr|code)|c[oó]digo\s+qr|qr\s*code|ver\s+las\s+im[aá]genes|view\s+(?:the\s+)?images|estudios\s+digitales|dicom|pacs)\b/i;

function normalizeWs(s) {
  return String(s || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function detectImagingReport(text) {
  return IMAGING_MARKERS.test(String(text || ''));
}

function parseStudyMeta(text) {
  const blob = String(text || '');
  const study =
    blob.match(/\bESTUDIO\s*[:\-]\s*([^\n]+)/i) ||
    blob.match(/\b(?:study|examen)\s*[:\-]\s*([^\n]+)/i);
  const fecha =
    blob.match(/\bFECHA\s*[:\-]\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})/i) ||
    blob.match(/\bDATE\s*[:\-]\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})/i);
  const doctor =
    blob.match(/\bDR\.?\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s\.]+?)(?:\n|Médico|Medico|Radi[oó]logo|M\.?D\.?)/i) ||
    blob.match(/\b(?:reading|ordering)\s+physician\s*[:\-]\s*([^\n]+)/i);
  const facility = blob.match(/\b([A-ZÁÉÍÓÚÑ][^\n]{3,80}(?:hospital|cl[ií]nica|centro|imaging|radiolog)[^\n]{0,40})/i);

  let dateIso = null;
  if (fecha) {
    const { coerceDate } = require('./record-field-templates/apply-template');
    // FECHA on imaging reports is day-first (DD/MM); ISO left unchanged by coerceDate
    const coerced = coerceDate(fecha[1], { dayFirst: true });
    dateIso = coerced?.value || null;
  }

  const studyTitle = study ? normalizeWs(study[1]).slice(0, 200) : null;
  let bodyRegion = null;
  if (studyTitle) {
    const br = studyTitle.match(/\b(rodilla|knee|hombro|shoulder|columna|spine|cerebro|brain|tobillo|ankle|cadera|hip)[^\n]*/i);
    if (br) bodyRegion = br[0].slice(0, 80);
  }

  return {
    title: studyTitle,
    date: dateIso,
    provider: doctor ? normalizeWs(doctor[1]).slice(0, 200) : null,
    facility: facility ? normalizeWs(facility[1]).slice(0, 200) : null,
    body_region: bodyRegion,
    study_type: studyTitle,
  };
}

/**
 * Split Findings vs Conclusion using common EN/ES radiology headings.
 * @param {string} text
 */
function splitFindingsConclusion(text) {
  const blob = String(text || '');
  const conclusionRe =
    /(?:^|\n)\s*(?:conclusi[oó]n|conclusion|impresi[oó]n|impression)\s*[:\-]\s*/i;
  const findingsStartRe =
    /(?:encontrando\s+los\s+siguientes\s+hallazgos\s*:|hallazgos\s*:|findings\s*:)/i;

  const concMatch = blob.match(conclusionRe);
  let findings = null;
  let conclusion = null;

  if (concMatch && concMatch.index != null) {
    const before = blob.slice(0, concMatch.index);
    const after = blob.slice(concMatch.index + concMatch[0].length);
    // Truncate conclusion at signature / footer
    const footer = after.search(
      /(?:^|\n)\s*(?:ATENTAMENTE|sincerely|DR\.|FECHA\s*:|Da\s+clic|click\s+here)/i,
    );
    conclusion = normalizeWs(footer >= 0 ? after.slice(0, footer) : after);
    const fs = before.search(findingsStartRe);
    if (fs >= 0) {
      const afterFs = before.slice(fs).replace(findingsStartRe, '');
      findings = normalizeWs(afterFs);
    } else {
      findings = normalizeWs(before);
    }
  } else {
    const fs = blob.search(findingsStartRe);
    if (fs >= 0) {
      findings = normalizeWs(blob.slice(fs).replace(findingsStartRe, ''));
    }
  }

  return { findings, conclusion };
}

function parseExternalImagesNote(text) {
  const blob = String(text || '');
  if (!EXTERNAL_IMAGE_MARKERS.test(blob)) {
    return { images_available_externally: false, external_images_note: null };
  }
  const lines = blob
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const hits = lines.filter((l) => EXTERNAL_IMAGE_MARKERS.test(l));
  const note = hits.length
    ? hits.slice(0, 4).join(' · ').slice(0, 500)
    : 'Images available via external link/QR in source document (not ingested)';
  return {
    images_available_externally: true,
    external_images_note: note,
  };
}

/**
 * @param {{ text?: string }} opts
 */
function parseImagingReportFromText(opts = {}) {
  const text = String(opts.text || '').trim();
  if (!text || !detectImagingReport(text)) {
    return null;
  }
  const meta = parseStudyMeta(text);
  const split = splitFindingsConclusion(text);
  const ext = parseExternalImagesNote(text);
  return {
    lab_kind: 'imaging_report',
    study_type: meta.study_type,
    body_region: meta.body_region,
    title: meta.title || 'Imaging report',
    date: meta.date,
    provider: meta.provider,
    facility: meta.facility,
    findings: split.findings,
    conclusion: split.conclusion,
    images_available_externally: ext.images_available_externally,
    external_images_note: ext.external_images_note,
    // Provenance: these fields quote the user's document, not touche AI
    field_provenance: {
      findings: 'document',
      conclusion: 'document',
      free_text: 'document',
      external_images_note: 'document',
      title: 'document',
      provider: 'document',
      study_type: 'document',
      body_region: 'document',
      facility: 'document',
    },
  };
}

module.exports = {
  detectImagingReport,
  splitFindingsConclusion,
  parseImagingReportFromText,
  parseExternalImagesNote,
  IMAGING_MARKERS,
};
