'use strict';

const { resolveIngredientFacts } = require('./ingredient-ontology-resolver');
const { BHA_ALIASES, normId } = require('./barrier-load-calculator');

const ACTIVE_PATTERNS = [
  { id: 'retinol', re: /retinol|retinoid|retinal|retinyl/i },
  { id: 'tretinoin', re: /tretinoin|adapalene|tazarotene/i },
  { id: 'salicylic acid', re: /salicylic|bha\b|betaine salicylate|willow bark/i },
  { id: 'glycolic acid', re: /glycolic|aha\b/i },
  { id: 'lactic acid', re: /lactic acid/i },
  { id: 'ascorbic acid', re: /ascorbic|vitamin c|l-ascorbic/i },
  { id: 'benzoyl peroxide', re: /benzoyl peroxide/i },
  { id: 'niacinamide', re: /niacinamide/i },
];

function extractActivesFromText(text) {
  const found = new Set();
  const raw = String(text || '').toLowerCase();
  if (!raw) return [];
  for (const p of ACTIVE_PATTERNS) {
    if (p.re.test(raw)) found.add(p.id);
  }
  for (const alias of BHA_ALIASES) {
    if (alias.re.test(raw)) found.add(alias.id);
  }
  const facts = resolveIngredientFacts(raw);
  for (const f of facts) {
    if (f.name) found.add(normId(f.name));
  }
  return [...found];
}

function parseCanonicalIdsJson(raw) {
  try {
    const v = JSON.parse(String(raw || '[]'));
    return Array.isArray(v) ? v.map(normId).filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

function resolveShelfProductIngredients(row) {
  const fromJson = parseCanonicalIdsJson(row.ingredient_canonical_ids_json);
  if (fromJson.length) return fromJson;

  const parts = [
    row.key_ingredients,
    row.ingredients_text,
    row.custom_product_name,
    row.catalog_product_id,
  ];
  const ids = new Set();
  for (const p of parts) {
    for (const id of extractActivesFromText(p)) ids.add(id);
  }
  return [...ids];
}

function usageTimeToSlotTime(usageTime) {
  const u = String(usageTime || 'any').toLowerCase();
  if (u === 'am') return 'am';
  if (u === 'pm') return 'pm';
  return 'pm';
}

function isWashOff(category) {
  const c = String(category || '').toLowerCase();
  return c.includes('cleanser') || c.includes('wash') || c.includes('soap');
}

function shelfRowToStep(row, order = 0) {
  const ingredientIds = resolveShelfProductIngredients(row);
  const washOff = isWashOff(row.category);
  return {
    order,
    product_id: row.id,
    product_name:
      row.custom_product_name ||
      row.catalog_product_id ||
      'Product',
    ingredient_ids: ingredientIds,
    wash_off: washOff,
    leave_on: !washOff,
    exposure: 'unknown',
    role: washOff ? 'cleanser' : 'treatment',
  };
}

function resolveShelfToSlots(db, sessionId) {
  const rows = db
    .prepare(`
      SELECT id, custom_product_name, catalog_product_id, category, usage_time,
        key_ingredients, ingredients_text, ingredient_canonical_ids_json, barcode
      FROM patient_onboarding_step3_products
      WHERE session_id = ? AND COALESCE(inventory_status, 'stock') != 'finished'
      ORDER BY datetime(updated_at) DESC
    `)
    .all(sessionId);

  const amSteps = [];
  const pmSteps = [];
  rows.forEach((row, idx) => {
    const step = shelfRowToStep(row, idx);
    const time = usageTimeToSlotTime(row.usage_time);
    if (time === 'am') amSteps.push(step);
    else pmSteps.push(step);
  });

  const slots = [];
  if (amSteps.length) slots.push({ time: 'am', step_order: 0, steps: amSteps });
  if (pmSteps.length) slots.push({ time: 'pm', step_order: 10, steps: pmSteps });
  return { slots, productRows: rows };
}

function resolveTemplateToSlots(db, { sessionId, patientId }) {
  const whereSql = patientId
    ? `WHERE (patient_id = ? OR session_id = ?) AND is_active = 1`
    : `WHERE session_id = ? AND is_active = 1`;
  const params = patientId ? [patientId, sessionId] : [sessionId];
  const template = db
    .prepare(`SELECT id FROM patient_routine_templates ${whereSql} ORDER BY datetime(updated_at) DESC LIMIT 1`)
    .get(...params);
  if (!template) return { slots: [], templateId: null };

  const items = db
    .prepare(`
      SELECT id, product_name, usage_time, source_type, source_ref_id
      FROM patient_routine_template_items
      WHERE template_id = ? AND is_active = 1
      ORDER BY step_order ASC, datetime(created_at) ASC
    `)
    .all(template.id);

  const amSteps = [];
  const pmSteps = [];
  items.forEach((it, idx) => {
    let ingredientIds = extractActivesFromText(it.product_name);
    if (it.source_type === 'shelf' && it.source_ref_id) {
      const shelf = db
        .prepare(`SELECT * FROM patient_onboarding_step3_products WHERE id = ? LIMIT 1`)
        .get(it.source_ref_id);
      if (shelf) ingredientIds = resolveShelfProductIngredients(shelf);
    }
    const step = {
      order: idx,
      template_item_id: it.id,
      product_name: it.product_name,
      ingredient_ids: ingredientIds,
      wash_off: /cleanser|wash/i.test(String(it.product_name || '')),
      leave_on: !/cleanser|wash/i.test(String(it.product_name || '')),
      exposure: 'unknown',
      role: 'unknown',
    };
    const time = usageTimeToSlotTime(it.usage_time);
    if (time === 'am') amSteps.push(step);
    else pmSteps.push(step);
  });

  const slots = [];
  if (amSteps.length) slots.push({ time: 'am', step_order: 0, steps: amSteps });
  if (pmSteps.length) slots.push({ time: 'pm', step_order: 10, steps: pmSteps });
  return { slots, templateId: template.id };
}

/** Prefer shelf slots; fall back to template when shelf empty. */
function resolvePatientLineupSlots(db, { sessionId, patientId }) {
  const shelf = resolveShelfToSlots(db, sessionId);
  if (shelf.slots.length) return { ...shelf, source: 'shelf' };
  const template = resolveTemplateToSlots(db, { sessionId, patientId });
  return { ...template, source: 'template', productRows: [] };
}

function persistCanonicalIds(db, productId, ids) {
  if (!productId || !ids?.length) return;
  db.prepare(`
    UPDATE patient_onboarding_step3_products
    SET ingredient_canonical_ids_json = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(JSON.stringify(ids), productId);
}

module.exports = {
  extractActivesFromText,
  resolveShelfProductIngredients,
  resolveShelfToSlots,
  resolveTemplateToSlots,
  resolvePatientLineupSlots,
  persistCanonicalIds,
  shelfRowToStep,
};
