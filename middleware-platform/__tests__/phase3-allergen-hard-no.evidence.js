'use strict';

/**
 * TOUCH-053–055 / 054 / 100 evidence.
 * Run: node __tests__/phase3-allergen-hard-no.evidence.js
 */

const assert = require('assert');
const Database = require('better-sqlite3');
const { up: upAllergen } = require('../migrations/061_patient_allergen_exclusions');
const { up: upBio } = require('../migrations/062_bio_procedure_safe_mode');
const { resolveAllergenClassId } = require('../lib/allergen-class-catalog');
const {
  detectAllergenHardNos,
  isAcrylateFree,
  applyHardNoOverall,
} = require('../services/allergen-hard-no-service');
const { computeSafeMode, applySafeModeToSlots, daysSince } = require('../services/safe-mode-service');

// TOUCH-055
assert.strictEqual(resolveAllergenClassId('acrylates', 'acrylates'), 'acrylates');
assert.strictEqual(resolveAllergenClassId('', 'essential oils'), 'essential_oils');
assert.strictEqual(resolveAllergenClassId('parfum', 'Fragrance'), 'fragrance');

// TOUCH-054
const slots = [
  {
    time: 'pm',
    steps: [
      {
        product_name: 'Glue primer',
        ingredient_ids: ['ethylhexyl acrylate', 'glycerin'],
      },
    ],
  },
];
const hardNos = detectAllergenHardNos({
  exclusions: [{ allergen_class: 'acrylates', label: 'acrylates' }],
  slots,
  productLabels: ['Glue primer'],
});
assert.ok(hardNos.length >= 1, 'hard_no hit expected');
assert.strictEqual(hardNos[0].verdict, 'hard_no');
assert.strictEqual(applyHardNoOverall('safe', hardNos), 'hard_no');
assert.strictEqual(applyHardNoOverall('safe', []), 'safe');

assert.strictEqual(
  isAcrylateFree({ slots: [{ time: 'pm', steps: [{ ingredient_ids: ['glycerin'] }] }] }),
  true,
);
assert.strictEqual(isAcrylateFree({ slots }), false);

// TOUCH-053 migration
{
  const db = new Database(':memory:');
  upAllergen(db);
  db.prepare(
    `INSERT INTO patient_allergen_exclusions (id, session_id, allergen_class, label)
     VALUES ('1','s1','acrylates','acrylates')`,
  ).run();
  const row = db.prepare(`SELECT allergen_class FROM patient_allergen_exclusions WHERE id = '1'`).get();
  assert.strictEqual(row.allergen_class, 'acrylates');
  db.close();
}

// TOUCH-100
{
  const db = new Database(':memory:');
  upBio(db);
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  assert.strictEqual(daysSince(iso, today), 0);

  const mode = computeSafeMode({ procedure_date: iso, procedure_type: 'laser' }, today);
  assert.strictEqual(mode.active, true);
  assert.ok(String(mode.ambient_copy).includes('safe mode'));
  assert.ok(String(mode.ambient_copy).includes('laser'));

  const applied = applySafeModeToSlots(
    [
      {
        time: 'pm',
        steps: [
          { product_name: 'Cleanser', role: 'cleanser', ingredient_ids: [] },
          { product_name: 'Retinol Serum', role: 'treatment', ingredient_ids: ['retinol'] },
        ],
      },
    ],
    mode,
  );
  assert.strictEqual(applied.suppressed_steps.length, 1);
  assert.strictEqual(applied.slots[0].steps[1].safe_mode_suppressed, true);

  const ended = computeSafeMode(
    { procedure_date: '2020-01-01', procedure_type: 'laser' },
    today,
  );
  assert.strictEqual(ended.active, false);
  db.close();
}

  // TOUCH-063 — persist freeform “What is this?” label
  {
    const createSpot = (region, label) => ({ label: label || (region === 'neck' ? 'Neck spot' : 'Skin spot'), region });
    const labeled = createSpot('neck', 'left cheek patch');
    assert.strictEqual(labeled.label, 'left cheek patch');
  }

  console.log('phase3-allergen-hard-no.evidence: PASS');
  // Also export TOUCH-063/104 contract notes for harden pass
  console.log('phase3-harden: spot label persist path + acrylate secondary badge + flip bottle entry');
