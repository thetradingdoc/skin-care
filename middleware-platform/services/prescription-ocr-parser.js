'use strict';

/**
 * Prescription OCR field parser from extracted text.
 * Mirrors billing-ocr-parser: heuristic + regex (no extra GPT).
 * Handles medication labels and optical (SPH/CYL/AXIS) forms.
 */

const REMARK_DRUG_BLOCKLIST =
  /^(?:for\s+)?glasses(?:\s+only)?$|^only$|^as\s+directed$|^take\s+as|^expires?\b|^for\s+(?:external|optical|vision)\b/i;

const OPTICAL_MARKERS =
  /\b(?:SPH\.?|CYL\.?|AXIS|pupillary\s*distance|\bPD\b|eye\s*care|glasses\s+only|contact\s+lens|multifocal|od\b|os\b|ou\b)\b/i;

function toIsoDateFromUs(mm, dd, yyyy) {
  const m = String(mm).padStart(2, '0');
  const d = String(dd).padStart(2, '0');
  const y = String(yyyy).replace(/\D/g, '').slice(0, 4);
  if (y.length !== 4) return null;
  return `${y}-${m}-${d}`;
}

function parseUsOrIsoDate(raw) {
  const s = String(raw || '').trim();
  const iso = s.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // OCR sometimes mangles trailing digit (7/7/202† → 2027)
  const us = s.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2}|\d{2}[^\s]*)\b/);
  if (us) {
    let y = us[3].replace(/\D/g, '');
    if (y.length === 3 && y.startsWith('20')) y = `${y}7`; // common †/l misread of 7
    if (y.length === 2) y = `20${y}`;
    if (y.length >= 4) return toIsoDateFromUs(us[1], us[2], y.slice(0, 4));
  }
  return null;
}

function parseExpiry(text) {
  const blob = String(text || '');
  const labeled = blob.match(
    /(?:rx\s*)?expir(?:es|y|ation)?\s*[:\-]?\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4}[^\s]*)/i,
  );
  if (labeled) {
    const iso = parseUsOrIsoDate(labeled[1]);
    if (iso) return iso;
  }
  const isoDirect = blob.match(/\bexpir(?:es|y)?\s*[:\-]?\s*(20\d{2}-\d{2}-\d{2})\b/i);
  if (isoDirect) return isoDirect[1];
  return null;
}

function parseServiceDate(text) {
  const blob = String(text || '');
  const labeled = blob.match(/\bdate\s*[:\-]?\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})/i);
  if (labeled) {
    const iso = parseUsOrIsoDate(labeled[1]);
    if (iso) return iso;
  }
  // Do not scrape arbitrary dates — expiry lines would steal service date
  return null;
}

function isBlockedDrugCandidate(candidate) {
  const s = String(candidate || '').trim();
  if (!s || s.length < 2) return true;
  if (REMARK_DRUG_BLOCKLIST.test(s)) return true;
  if (/glasses/i.test(s) && /only/i.test(s)) return true;
  if (/^for\s+/i.test(s) && s.split(/\s+/).length <= 4) return true;
  return false;
}

function detectOptical(text) {
  return OPTICAL_MARKERS.test(String(text || ''));
}

function parseClinicOrPrescriber(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const drLine = lines.find((l) => /^dr\.?\s*[:\-]?\s*[A-Za-z]/i.test(l));
  if (drLine) {
    const name = drLine.replace(/^dr\.?\s*[:\-]?\s*/i, '').trim();
    if (name && name.length > 1) return name.slice(0, 200);
  }
  for (const line of lines.slice(0, 6)) {
    if (
      /eye\s*care|optical|ophthalm|optometr|clinic|hospital|medical|pharmacy|health/i.test(line) &&
      line.length < 120 &&
      !/^tel\b|^fax\b|^email\b/i.test(line)
    ) {
      return line.slice(0, 200);
    }
  }
  return null;
}

function stripOcrNoise(text) {
  return String(text || '')
    .replace(/^```(?:\w+)?\s*/m, '')
    .replace(/\s*```$/m, '')
    .trim();
}

function appendPd(summary, blob) {
  const pd =
    blob.match(/pupillary\s*distance[\s\S]{0,80}?\b(\d{2}(?:\.\d+)?)\b/i) ||
    // GPT vision often splits "PUPILLARY\nDISTANCE 70"
    blob.match(/pupillary[\s\S]{0,40}?distance\s+(\d{2}(?:\.\d+)?)\b/i) ||
    // Garbled: PUPILLARY … YES NO 70
    blob.match(/pupillary[\s\S]{0,120}?\b(\d{2}(?:\.\d+)?)\b/i) ||
    blob.match(/\bPD\s*[:\-]?\s*(\d{2}(?:\.\d+)?)\b/i);
  if (!pd) return summary;
  const pdn = Number(pd[1]);
  if (pdn < 40 || pdn > 80) return summary;
  return `${summary}; PD ${pd[1]}`.slice(0, 80);
}

/**
 * Row layouts from vision OCR (highly variable):
 *   R          -0.25    -0.75      145
 *   R   SPH. -0.25  CYL. -0.75  AXIS 145
 *   R { -0.25  -0.75   145
 * Prefer the SPH/CYL block before READING/ADDITION — do not anchor on the word
 * DISTANCE (forms often put DISTANCE between OD and OS rows).
 */
function parseOpticalRowLayout(text) {
  const blob = stripOcrNoise(text);
  // Cut at first READING/ADDITION so near PD "DISTANCE 70" does not pollute refraction
  const beforeReading = blob.split(/\b(?:READING|ADDITION)\b/i)[0] || blob;
  const distanceBlock = beforeReading;

  const rows = [];

  // Labeled inline: R SPH. -0.25 CYL. -0.75 AXIS 145
  const labeledRe =
    /\b(OD|OS|OU|R|L)\b[\s{]*SPH\.?\s*([+\-]?\d+(?:\.\d+)?)[\s\S]{0,40}?CYL\.?\s*([+\-]?\d+(?:\.\d+)?)[\s\S]{0,40}?AXIS\s*(\d{1,3})\b/gi;
  let m;
  while ((m = labeledRe.exec(distanceBlock)) && rows.length < 4) {
    const label = m[1].toUpperCase();
    const eye = label === 'L' || label === 'OS' ? 'OS' : 'OD';
    const axisN = Number(m[4]);
    if (!(axisN >= 0 && axisN <= 180)) continue;
    if (Math.abs(Number(m[2])) > 20 || Math.abs(Number(m[3])) > 20) continue;
    rows.push({ eye, sph: m[2], cyl: m[3], axis: m[4] });
  }

  // Compact / braced: R { -0.25 -0.75 145   or   R -0.25 -0.75 145
  if (rows.length < 2) {
    const compactRe =
      /\b(OD|OS|OU|R|L)\b\.?\s*\{?\s*([+\-]?\d+(?:\.\d+)?)\s+([+\-]?\d+(?:\.\d+)?)\s+(\d{1,3})\b/gi;
    while ((m = compactRe.exec(distanceBlock)) && rows.length < 4) {
      const label = m[1].toUpperCase();
      const eye = label === 'L' || label === 'OS' ? 'OS' : 'OD';
      const axisN = Number(m[4]);
      if (!(axisN >= 0 && axisN <= 180)) continue;
      if (Math.abs(Number(m[2])) > 20 || Math.abs(Number(m[3])) > 20) continue;
      if (rows.some((r) => r.eye === eye)) continue;
      rows.push({ eye, sph: m[2], cyl: m[3], axis: m[4] });
    }
  }

  // Continuation L line under a labeled R (numbers only): L   -0.25  -0.75  045
  if (rows.some((r) => r.eye === 'OD') && !rows.some((r) => r.eye === 'OS')) {
    const cont = distanceBlock.match(
      /\bL\b\.?\s*\{?\s*([+\-]?\d+(?:\.\d+)?)\s+([+\-]?\d+(?:\.\d+)?)\s+(\d{1,3})\b/i,
    );
    if (cont) {
      const axisN = Number(cont[3]);
      if (axisN >= 0 && axisN <= 180 && Math.abs(Number(cont[1])) <= 20) {
        rows.push({ eye: 'OS', sph: cont[1], cyl: cont[2], axis: cont[3] });
      }
    }
  }

  // Garbled vision: labels missing/wrong — take first two SPH/CYL/AXIS triplets
  if (rows.length < 2) {
    const tripRe = /([+\-]?\d+(?:\.\d+)?)\s+([+\-]?\d+(?:\.\d+)?)\s+(\d{1,3})\b/g;
    const trips = [];
    let t;
    while ((t = tripRe.exec(distanceBlock)) && trips.length < 4) {
      const sph = Number(t[1]);
      const cyl = Number(t[2]);
      const axis = Number(t[3]);
      if (!Number.isFinite(sph) || !Number.isFinite(cyl) || !Number.isFinite(axis)) continue;
      if (Math.abs(sph) > 20 || Math.abs(cyl) > 20) continue;
      if (axis < 0 || axis > 180) continue;
      if (Math.abs(sph) >= 100 || Math.abs(cyl) >= 100) continue;
      trips.push({ sph: t[1], cyl: t[2], axis: t[3] });
    }
    if (trips.length >= 2) {
      rows.length = 0;
      rows.push({ eye: 'OD', ...trips[0] }, { eye: 'OS', ...trips[1] });
    }
  }

  const od = rows.find((r) => r.eye === 'OD');
  const os = rows.find((r) => r.eye === 'OS');
  if (!od || !os) return null;
  return appendPd(`OD ${od.sph}/${od.cyl}x${od.axis}; OS ${os.sph}/${os.cyl}x${os.axis}`, blob);
}

/**
 * Pull signed sphere/cyl/axis-ish numbers for a compact strength line.
 * Prefer values near SPH/CYL/AXIS labels; ignore phone/zip noise.
 * Also accepts R/L (or OD/OS) row tables from vision OCR.
 */
function parseOpticalStrengthSummary(text) {
  const blob = stripOcrNoise(text);
  if (!detectOptical(blob)) return null;

  const fromRows = parseOpticalRowLayout(blob);
  if (fromRows) return fromRows;

  const sectionNums = (label, { kind } = {}) => {
    const re = new RegExp(
      `${label}\\.?\\s*([\\s\\S]{0,120}?)(?=\\b(?:SPH|CYL|AXIS|PRISM|BASE|MULTIFOCAL|COLOR|PUPILLARY|READING|DISTANCE|DR\\.?|Rx\\b)|$)`,
      'i',
    );
    const m = blob.match(re);
    if (!m) return [];
    const out = [];
    const numRe = /([+-]?\s*\d+(?:\.\d+)?)/g;
    let n;
    while ((n = numRe.exec(m[1])) && out.length < 4) {
      const raw = n[1].replace(/\s+/g, '');
      const abs = Math.abs(Number(raw));
      if (!Number.isFinite(abs)) continue;
      if (kind === 'axis') {
        // Axes are 0–180; keep zero-padded forms (045)
        if (abs > 180) continue;
        out.push(raw);
        continue;
      }
      // SPH/CYL: refraction diopters are typically |n| <= 20.
      // Reject axis-like 3-digit integers (e.g. 045/145) so they cannot
      // leak into sph[1] and become OS SPH via `OS ${sph[1]}/...` below.
      if (abs > 20) continue;
      if (/^\d{3,}$/.test(raw)) continue;
      out.push(raw);
    }
    return out;
  };

  const sph = sectionNums('SPH', { kind: 'sphere' });
  const cyl = sectionNums('CYL', { kind: 'cylinder' });
  const axis = sectionNums('AXIS', { kind: 'axis' }).filter((v) => {
    const n = Math.abs(Number(v));
    return n >= 0 && n <= 180;
  });

  if (sph.length >= 2 && cyl.length >= 2 && axis.length >= 2) {
    return appendPd(`OD ${sph[0]}/${cyl[0]}x${axis[0]}; OS ${sph[1]}/${cyl[1]}x${axis[1]}`, blob);
  }

  if (/glasses\s+only/i.test(blob)) return 'glasses only';
  return null;
}

function parseMedicationDrugStrength(text) {
  const blob = String(text || '');
  // No trailing \b after % — % is non-word so \b never matches "0.025% apply"
  const drugMatch = blob.match(
    /\b([A-Z][a-z]+(?:ene|ine|ol|ate|ide|mycin|cillin|pril|olol|azole)?)\s+(\d+(?:\.\d+)?\s*%|\d+\s*mg)\b/i,
  );
  if (!drugMatch) {
    const pct = blob.match(
      /\b([A-Z][a-z]{2,}(?:ene|ine|ol|ate|ide|mycin|cillin|pril|olol|azole)?)\s+(\d+(?:\.\d+)?\s*%)(?=\s|$|[^0-9])/i,
    );
    if (pct) return { drug: pct[1], strength: pct[2].replace(/\s+/g, '') };
  } else {
    return { drug: drugMatch[1], strength: drugMatch[2].replace(/\s+/g, '') };
  }
  // Labeled medication lines — never bare "Rx …" remark capture
  const labeled = blob.match(
    /(?:medication|drug|medicine|rx\s*name)\s*[:\-]\s*([A-Za-z][A-Za-z0-9\- ]{1,40})/i,
  );
  if (labeled && !isBlockedDrugCandidate(labeled[1])) {
    return { drug: labeled[1].trim().slice(0, 200), strength: null };
  }
  return { drug: null, strength: null };
}

/**
 * @param {{ text?: string }} opts
 */
function parsePrescriptionFieldsFromText(opts = {}) {
  const text = stripOcrNoise(opts.text || '');
  if (!text || /^no text found$/i.test(text)) {
    return {
      rx_kind: 'unknown',
      drug: null,
      strength: null,
      prescriber: null,
      date: null,
      expiry: null,
      note: null,
      confidence_score: 0.1,
      status: 'needs_review',
    };
  }

  const optical = detectOptical(text);
  const expiry = parseExpiry(text);
  const date = parseServiceDate(text);
  const prescriber = parseClinicOrPrescriber(text);

  if (optical) {
    const strength = parseOpticalStrengthSummary(text);
    const remarks = [];
    if (/glasses\s+only/i.test(text)) remarks.push('Rx for glasses only');
    if (expiry) remarks.push(`expires ${expiry}`);
    return {
      rx_kind: 'optical',
      drug: 'Glasses prescription',
      strength,
      prescriber,
      date,
      expiry,
      note: remarks.length ? remarks.join(' · ') : null,
      confidence_score: strength || expiry || prescriber ? 0.7 : 0.45,
      status: strength || expiry ? 'ready' : 'needs_review',
    };
  }

  const med = parseMedicationDrugStrength(text);
  // Legacy "Rx: <name>" — require colon/dash; reject remarks; stop before digits/%
  let drug = med.drug;
  if (!drug) {
    const rx = text.match(
      /(?:^|\b)(?:rx|prescription)\s*[:\-]\s*([A-Za-z][A-Za-z\-]*(?:\s+[A-Za-z][A-Za-z\-]*){0,3})(?=\s|$|[^A-Za-z\-])/i,
    );
    if (rx && !isBlockedDrugCandidate(rx[1])) {
      drug = rx[1].trim().slice(0, 200);
    }
  }

  return {
    rx_kind: 'medication',
    drug,
    strength: med.strength,
    prescriber,
    date,
    expiry,
    note: null,
    confidence_score: drug ? 0.65 : 0.35,
    status: drug ? 'ready' : 'needs_review',
  };
}

module.exports = {
  parsePrescriptionFieldsFromText,
  parseExpiry,
  detectOptical,
  isBlockedDrugCandidate,
  parseOpticalStrengthSummary,
  parseClinicOrPrescriber,
  REMARK_DRUG_BLOCKLIST,
};
