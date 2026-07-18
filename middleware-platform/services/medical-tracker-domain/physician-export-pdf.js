'use strict';

/**
 * P5.06 / APP-07 — Physician PDF builder from export_pack (P4.07).
 * Renders fact fields via record-field-templates catalog (editable fields).
 * Inherits narrative=null / no interpretation — does not reimplement that policy.
 */

const { runExportPackSync } = require('../medical-tracker-rails/export-pack');
const {
  getTemplate,
  getTemplateForTagSubtype,
  editableFields,
} = require('../record-field-templates');

function escapePdfText(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Minimal PDF 1.4 text document (no external deps).
 */
function linesToPdfBuffer(lines) {
  const contentLines = ['BT', '/F1 10 Tf', '50 780 Td', '12 TL'];
  for (let i = 0; i < lines.length; i++) {
    const t = escapePdfText(lines[i]).slice(0, 110);
    if (i === 0) contentLines.push(`(${t}) Tj`);
    else contentLines.push(`T* (${t}) Tj`);
  }
  contentLines.push('ET');
  const stream = contentLines.join('\n');
  const objs = [];
  objs.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
  objs.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n');
  objs.push(
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n',
  );
  objs.push(`4 0 obj<< /Length ${Buffer.byteLength(stream)} >>stream\n${stream}\nendstream\nendobj\n`);
  objs.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n');

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const o of objs) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += o;
  }
  const xrefStart = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

function resolveFactTemplate(fact, sj) {
  if (sj.template_id && getTemplate(sj.template_id)) {
    return getTemplate(sj.template_id);
  }
  const tag = String(fact.tag || '');
  const subtype =
    sj.rx_kind ||
    sj.lab_kind ||
    sj.subtype ||
    (tag === 'prescription' ? 'other' : 'default');
  return getTemplateForTagSubtype(tag, subtype);
}

function formatFieldValue(field, raw) {
  if (raw == null || raw === '') return null;
  if (field.type === 'money_cents') {
    const n = Number(raw);
    if (!Number.isFinite(n)) return String(raw);
    return `${(n / 100).toFixed(2)}${field.unit ? ` ${field.unit}` : ''}`;
  }
  if (typeof raw === 'boolean') return raw ? 'yes' : 'no';
  if (Array.isArray(raw)) return raw.map(String).join(', ');
  if (typeof raw === 'object') return JSON.stringify(raw).slice(0, 80);
  const s = String(raw);
  return field.unit ? `${s} ${field.unit}` : s;
}

/** APP-07 — one fact → catalog-labeled lines (fallback if no template). */
function factToLines(fact) {
  const sj = fact.structured_json || {};
  const template = resolveFactTemplate(fact, sj);
  const headerDate = sj.date || fact.confirmed_at || '';
  const lines = [];

  if (template) {
    lines.push(`[${fact.tag}] ${template.label} ${headerDate}`.trim());
    for (const field of editableFields(template)) {
      const formatted = formatFieldValue(field, sj[field.key]);
      if (formatted == null) continue;
      lines.push(`  ${field.label}: ${String(formatted).slice(0, 90)}`);
    }
    return lines;
  }

  // Fallback — sparse legacy shape (should be rare once templates stamp template_id)
  lines.push(
    `[${fact.tag}] ${headerDate} ${sj.drug || sj.provider || sj.body_area || sj.body_location || sj.label || ''}`.trim(),
  );
  if (sj.note) lines.push(`  note: ${String(sj.note).slice(0, 90)}`);
  if (sj.amount_cents != null) {
    lines.push(`  amount_cents: ${sj.amount_cents} ${sj.currency || ''}`);
  } else if (sj.amount != null) {
    lines.push(`  amount: ${sj.amount} ${sj.currency || ''}`);
  }
  return lines;
}

/**
 * Build physician pack: calls export_pack, asserts inherited no-narrative, returns PDF buffer.
 */
async function buildPhysicianPdf(db, opts = {}) {
  const pack = await runExportPackSync({
    db,
    patientId: opts.patientId || null,
    sessionId: opts.sessionId || null,
    tag: opts.tag || null,
    start: opts.start || null,
    end: opts.end || null,
    limit: opts.limit || 200,
  });
  if (!pack.ok) {
    return { ok: false, error_code: pack.error_code || 'EXPORT_FAILED', error: pack.error };
  }

  // Inherit export_pack guarantees — fail loud if violated
  if (pack.narrative != null || pack.interpretation != null || pack.summary != null || pack.ai_generated) {
    const err = new Error('EXPORT_PACK_NARRATIVE_LEAK');
    err.code = 'EXPORT_PACK_NARRATIVE_LEAK';
    throw err;
  }

  const lines = [
    'touche — physician record pack',
    `Generated: ${new Date().toISOString()}`,
    `Facts: ${pack.facts.length}  Media refs: ${pack.media.length}`,
    '---',
    '(Retrieval only — no AI narrative / interpretation)',
    '---',
  ];
  for (const f of pack.facts.slice(0, 80)) {
    lines.push(...factToLines(f));
  }
  for (const m of pack.media.slice(0, 40)) {
    lines.push(`media ${m.tag} ${m.fact_id} expires=${m.media_url_expires_at || 'n/a'}`);
  }

  const buffer = linesToPdfBuffer(lines);
  return {
    ok: true,
    content_type: 'application/pdf',
    buffer,
    fact_count: pack.facts.length,
    media_count: pack.media.length,
    narrative: null,
    interpretation: null,
    ai_generated: false,
    pack,
  };
}

module.exports = {
  buildPhysicianPdf,
  linesToPdfBuffer,
  factToLines,
  resolveFactTemplate,
};
