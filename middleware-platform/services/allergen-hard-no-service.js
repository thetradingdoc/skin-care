'use strict';

/**
 * TOUCH-054 — Emit hard_no when excluded allergen classes appear in lineup/product text.
 * TOUCH-104 helper — acrylate-free verified when acrylates absent.
 */

const {
  resolveAllergenClassId,
  classMatchesBlob,
  classMatchesIngredientIds,
  getAllergenClass,
} = require('../lib/allergen-class-catalog');
const { collectIngredientIds } = require('./barrier-load-calculator');

function ensureAllergenTable(db) {
  require('../migrations/061_patient_allergen_exclusions').up(db);
}

function loadAllergenExclusions(db, { sessionId, patientId } = {}) {
  if (!db) return [];
  ensureAllergenTable(db);
  try {
    const rows = db
      .prepare(
        `SELECT id, allergen_class, label FROM patient_allergen_exclusions
         WHERE (? IS NOT NULL AND session_id = ?)
            OR (? IS NOT NULL AND patient_id = ?)
         ORDER BY datetime(created_at) ASC`,
      )
      .all(sessionId || null, sessionId || null, patientId || null, patientId || null);
    return rows.map((r) => ({
      id: r.id,
      allergen_class: resolveAllergenClassId(r.allergen_class, r.label),
      label: r.label || r.allergen_class,
    })).filter((r) => r.allergen_class);
  } catch (_) {
    return [];
  }
}

function normalizeBodyAllergens(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((raw) => {
      const allergen_class = resolveAllergenClassId(
        raw?.allergen_class || raw?.class,
        raw?.label,
      );
      if (!allergen_class) return null;
      return {
        allergen_class,
        label: String(raw?.label || getAllergenClass(allergen_class)?.label || allergen_class),
      };
    })
    .filter(Boolean);
}

function lineupBlob(slots, productLabels = [], extraText = '') {
  const ids = collectIngredientIds(slots);
  const labels = (productLabels || []).map((l) => String(l || ''));
  const stepNames = [];
  for (const slot of slots || []) {
    for (const st of slot.steps || []) {
      stepNames.push(st.product_name || '');
      for (const id of st.ingredient_ids || []) stepNames.push(String(id));
    }
  }
  return [ids.join(' '), labels.join(' '), stepNames.join(' '), extraText].join(' | ');
}

/**
 * @returns {Array<{ id: string, allergen_class: string, label: string, severity: string, verdict: 'hard_no', notes: string, reason_codes: string[] }>}
 */
function detectAllergenHardNos({ exclusions, slots, productLabels = [], ingredientsText = '' }) {
  const hits = [];
  const blob = lineupBlob(slots, productLabels, ingredientsText);
  const ids = collectIngredientIds(slots);
  const seen = new Set();

  for (const ex of exclusions || []) {
    const classId = resolveAllergenClassId(ex.allergen_class, ex.label);
    if (!classId || seen.has(classId)) continue;
    const match =
      classMatchesIngredientIds(classId, ids) || classMatchesBlob(classId, blob);
    if (!match) continue;
    seen.add(classId);
    const label = ex.label || getAllergenClass(classId)?.label || classId;
    hits.push({
      id: `hard_no:${classId}`,
      allergen_class: classId,
      label,
      severity: 'critical',
      ingredient_a: classId,
      ingredient_b: 'patient_exclusion',
      interaction_type: 'allergen_exclusion',
      notes: `Hard no — you ruled out ${label}.`,
      reason_codes: [`allergen_hard_no:${classId}`],
      verdict: 'hard_no',
    });
  }
  return hits;
}

function isAcrylateFree({ slots, productLabels = [], ingredientsText = '' }) {
  const blob = lineupBlob(slots, productLabels, ingredientsText);
  const ids = collectIngredientIds(slots);
  return !(
    classMatchesIngredientIds('acrylates', ids) || classMatchesBlob('acrylates', blob)
  );
}

function applyHardNoOverall(overall, hardNos) {
  if (hardNos && hardNos.length) return 'hard_no';
  return overall;
}

module.exports = {
  ensureAllergenTable,
  loadAllergenExclusions,
  normalizeBodyAllergens,
  detectAllergenHardNos,
  isAcrylateFree,
  applyHardNoOverall,
  lineupBlob,
};
