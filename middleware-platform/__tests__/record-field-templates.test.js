'use strict';

/**
 * Template-driven field schema + Allerton optical regression + denorm columns.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const {
  getTemplate,
  listTemplates,
  editableFields,
  structureWithTemplate,
  classifyTemplate,
  applyTemplate,
} = require('../services/record-field-templates');
const { structureByTag } = require('../services/capture-orchestration/structure-by-tag');
const { extractDenormQueryables } = require('../services/patient-record-field-crypto');
const factsRepo = require('../repositories/patient-record-facts-repo');

const OCR_PATH = path.join(__dirname, 'fixtures', 'allerton-eye-rx.ocr.txt');

describe('record-field-templates catalog', () => {
  test('optical template matches Allerton field set', () => {
    const t = getTemplate('prescription.optical');
    expect(t).toBeTruthy();
    const keys = editableFields(t).map((f) => f.key);
    for (const k of [
      'date',
      'practice',
      'od_sph',
      'od_cyl',
      'od_axis',
      'os_sph',
      'os_cyl',
      'os_axis',
      'multifocal',
      'tint',
      'pd',
    ]) {
      expect(keys).toContain(k);
    }
    // Required only date
    const required = editableFields(t).filter((f) => f.required).map((f) => f.key);
    expect(required).toEqual(['date']);
  });

  test('lab imaging template has findings + conclusion as separate fields', () => {
    const t = getTemplate('lab.imaging_report');
    const keys = editableFields(t).map((f) => f.key);
    expect(keys).toContain('findings');
    expect(keys).toContain('conclusion');
    expect(keys).toContain('study_type');
  });

  test('client mirror parity — every catalog template key matches (fail on any drift)', () => {
    const clientPath = path.join(
      __dirname,
      '../../patient-app/lib/record-field-templates.ts',
    );
    const src = fs.readFileSync(clientPath, 'utf8');
    const middlewareIds = listTemplates().map((t) => t.id).sort();
    // Client must declare every middleware catalog id
    for (const id of middlewareIds) {
      expect(src).toMatch(new RegExp(`id:\\s*'${id.replace(/\./g, '\\.')}'`));
    }

    const drifts = [];
    for (const t of listTemplates()) {
      const mwKeys = editableFields(t)
        .map((f) => f.key)
        .sort();
      // Extract field keys from the client template block for this id
      const idEsc = t.id.replace(/\./g, '\\.');
      const blockRe = new RegExp(
        `id:\\s*'${idEsc}'[\\s\\S]*?fields:\\s*\\[([\\s\\S]*?)\\n\\s*\\],`,
        'm',
      );
      const block = src.match(blockRe);
      if (!block) {
        drifts.push(`${t.id}: missing client fields block`);
        continue;
      }
      const clientKeys = [...block[1].matchAll(/key:\s*'([^']+)'/g)].map((m) => m[1]).sort();
      const missing = mwKeys.filter((k) => !clientKeys.includes(k));
      const extra = clientKeys.filter((k) => !mwKeys.includes(k));
      if (missing.length || extra.length) {
        drifts.push(
          `${t.id}: missing=[${missing.join(',')}] extra=[${extra.join(',')}]`,
        );
      }
      // required flags must match for shared keys
      for (const f of editableFields(t)) {
        if (!f.required) continue;
        const reqRe = new RegExp(
          `key:\\s*'${f.key}'[^\\n]*required:\\s*true|key:\\s*'${f.key}',\\s*type:[^\\n]*required:\\s*true`,
        );
        // Within this template's fields block only
        if (!reqRe.test(block[1]) && !new RegExp(`key:\\s*'${f.key}'[\\s\\S]{0,120}?required:\\s*true`).test(block[1])) {
          drifts.push(`${t.id}.${f.key}: client missing required:true`);
        }
      }
    }
    expect(drifts).toEqual([]);
  });
});

describe('classify-then-extract + applyTemplate', () => {
  const ocrText = fs.readFileSync(OCR_PATH, 'utf8');

  test('classifies Allerton OCR as prescription.optical', () => {
    const c = classifyTemplate({ tag: 'prescription', ocrText });
    expect(c.template_id).toBe('prescription.optical');
  });

  test('Allerton regression — optical draft with OD/OS + absent markers', () => {
    const s = structureByTag('prescription', { ocrText });
    expect(s.valid).toBe(true);
    expect(s.normalized.template_id).toBe('prescription.optical');
    expect(s.normalized.rx_kind).toBe('optical');
    expect(s.normalized.drug).toBe('Glasses prescription');
    expect(s.normalized.drug.toLowerCase()).not.toContain('for glasses only');
    expect(s.normalized.od_sph).toMatch(/-0\.25/);
    expect(s.normalized.od_cyl).toMatch(/-0\.75/);
    expect(s.normalized.od_axis).toMatch(/145/);
    expect(s.normalized.os_sph).toMatch(/-0\.25/);
    expect(s.normalized.os_axis).toMatch(/045|45/);
    expect(s.normalized.prescriber || s.normalized.practice).toMatch(/ALLERTON/i);
    expect(s.normalized.expiry).toBe('2027-07-07');
    expect(Array.isArray(s.normalized.fields_absent)).toBe(true);
    // PD often missing from OCR — must be explicitly absent, not silently dropped from template awareness
    expect(s.fields_absent || s.normalized.fields_absent).toEqual(
      expect.arrayContaining(['pd']),
    );
  });

  test('diopter type rejects arbitrary text', () => {
    const t = getTemplate('prescription.optical');
    const applied = applyTemplate(t, {
      date: '2026-07-07',
      od_sph: 'not-a-number',
      practice: 'Clinic',
    });
    expect(applied.normalized.od_sph).toBeNull();
    expect(applied.fields_absent).toContain('od_sph');
    expect(applied.errors.some((e) => e.includes('od_sph'))).toBe(true);
  });

  test('medication classify for Tretinoin text', () => {
    const s = structureWithTemplate({
      tag: 'prescription',
      ocrText: 'Rx: Tretinoin 0.025% apply nightly\nExpires 12/01/2027',
    });
    expect(s.template_id).toBe('prescription.medication');
    expect(s.normalized.drug).toMatch(/Tretinoin/i);
    expect(s.normalized.strength).toMatch(/0\.025/);
  });

  test('manual optical keys without subtype → optical, OD/OS persist (not wiped)', () => {
    const s = structureByTag('prescription', {
      userHints: {
        date: '2026-07-07',
        od_sph: '-0.25',
        od_cyl: '-0.75',
        od_axis: '145',
        os_sph: '-0.25',
        os_cyl: '-0.50',
        os_axis: '045',
        practice: 'Allerton Eye Care',
      },
    });
    expect(s.valid).toBe(true);
    expect(s.normalized.rx_kind).toBe('optical');
    expect(s.normalized.template_id).toBe('prescription.optical');
    expect(s.normalized.od_sph).toMatch(/-0\.25/);
    expect(s.normalized.os_sph).toMatch(/-0\.25/);
    expect(s.normalized.od_cyl).toMatch(/-0\.75/);
    expect(s.normalized.os_axis).toMatch(/045|45/);
    expect(s.extraction?.classification?.method).toBe('optical_keys');
  });

  test('ambiguous manual Rx (no subtype, no optical keys) → loud RX_KIND_REQUIRED', () => {
    const c = classifyTemplate({
      tag: 'prescription',
      userHints: { date: '2026-07-07' },
    });
    expect(c.error_code).toBe('RX_KIND_REQUIRED');
    expect(c.template_id).toBeNull();

    const s = structureByTag('prescription', {
      userHints: { date: '2026-07-07' },
    });
    expect(s.valid).toBe(false);
    expect(s.error_code).toBe('RX_KIND_REQUIRED');
    expect(s.normalized).toBeNull();
  });

  test('optical with drug absent → no drug_required, drug not in fields_absent', () => {
    const s = structureByTag('prescription', {
      userHints: {
        date: '2026-07-07',
        rx_kind: 'optical',
        od_sph: '-1.00',
        os_sph: '-1.25',
        // drug intentionally omitted
      },
    });
    expect(s.valid).toBe(true);
    expect(s.normalized.drug).toBe('Glasses prescription');
    expect(s.errors || []).not.toContain('drug_required');
    expect(s.fields_absent || []).not.toContain('drug');
    expect(s.normalized.fields_absent || []).not.toContain('drug');
  });
});

describe('denormalized query columns (075)', () => {
  test('extractDenormQueryables from optical draft', () => {
    const ocrText = fs.readFileSync(OCR_PATH, 'utf8');
    const s = structureByTag('prescription', { ocrText });
    const d = extractDenormQueryables(s.normalized, 'prescription');
    expect(d.fact_subtype).toBe('optical');
    expect(d.expiry_date).toBe('2027-07-07');
    expect(d.provider).toMatch(/ALLERTON/i);
    expect(d.issue_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('insertFact writes denorm columns', () => {
    const db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
    const ocrText = fs.readFileSync(OCR_PATH, 'utf8');
    const s = structureByTag('prescription', { ocrText });
    const fact = factsRepo.insertFact(db, {
      tag: 'prescription',
      ai_or_manual: 'ai',
      session_id: 'sess_tmpl',
      structured_json: s.normalized,
      confirmed_at: new Date().toISOString(),
    });
    expect(fact.fact_subtype).toBe('optical');
    expect(fact.expiry_date).toBe('2027-07-07');
    expect(fact.provider).toMatch(/ALLERTON/i);
    const raw = db.prepare(`SELECT fact_subtype, expiry_date, provider FROM patient_record_facts WHERE id = ?`).get(fact.id);
    expect(raw.fact_subtype).toBe('optical');
    expect(raw.expiry_date).toBe('2027-07-07');
    db.close();
  });
});

describe('template-driven UI contracts', () => {
  test('confirm rx screen uses TemplateFieldsForm', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../patient-app/app/capture/confirm/rx.tsx'),
      'utf8',
    );
    expect(src).toMatch(/TemplateFieldsForm/);
    expect(src).toMatch(/getTemplateForDraft/);
    expect(src).not.toMatch(/confirm-rx-drug/);
  });

  test('manual entry shows subtype chips + template fields for prescription', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../patient-app/app/capture/manual-entry.tsx'),
      'utf8',
    );
    expect(src).toMatch(/manual-subtype-tags/);
    expect(src).toMatch(/TemplateFieldsForm/);
    expect(src).toMatch(/prescription\.optical|templatesForTag/);
  });

  test('template field not in catalog never appears in optical editable set', () => {
    const keys = editableFields(getTemplate('prescription.optical')).map((f) => f.key);
    expect(keys).not.toContain('icd10');
    expect(keys).not.toContain('diagnosis');
  });
});
