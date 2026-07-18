'use strict';

/**
 * APP-02 — PDF text-layer never meters and stamps ai_or_manual=manual.
 */

const path = require('path');
const fs = require('fs');

describe('APP-02 PDF text-layer enum honesty', () => {
  test('orchestrator stamps manual for unmetered pdf-text-layer (source)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../services/capture-orchestration/index.js'),
      'utf8'
    );
    expect(src).toMatch(/isPdfTextLayerUnmetered/);
    expect(src).toMatch(/stampedAiOrManual = isPdfTextLayerUnmetered \? 'manual' : 'ai'/);
    expect(src).toMatch(/APP-02/);
    // Adversarial: meter-then-refund for text-layer must stay deleted
    expect(src).not.toMatch(/pdf_text_layer_unmetered/);
    expect(src).toMatch(
      /DOC_TAGS\.has\(tag\) && !\(preDoc && preDoc\.method === 'pdf-text-layer' && preDoc\.used_ai === false\)/
    );
  });

  test('tradeoff documented in pending APP-02 note', () => {
    const doc = fs.readFileSync(
      path.join(
        __dirname,
        '../../todos/pending/APP02_PDF_TEXT_LAYER_PROVENANCE_TRADEOFF_2026-07-18.md'
      ),
      'utf8'
    );
    expect(doc).toMatch(/permanently indistinguishable/);
    expect(doc).toMatch(/ai_or_manual/);
    expect(doc).toMatch(/Do \*\*not\*\* add `automated_unmetered`/);
  });

  test('adversarial: AI_OR_MANUAL enum stays binary only', () => {
    const { AI_OR_MANUAL } = require('../services/patient-record-fact-validators');
    expect([...AI_OR_MANUAL].sort()).toEqual(['ai', 'manual']);
  });
});
