'use strict';

/**
 * P0.16–P0.20 / P2.27 — regressions that fail if honesty/cleanup work is reverted.
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

describe('P0 progress honesty + architecture regressions', () => {
  test('P0.16 dead Stack registrations stay removed from app/_layout.tsx', () => {
    const layout = read('patient-app/app/_layout.tsx');
    for (const dead of [
      'capture-scan',
      'capture-upload',
      'capture-review',
      'capture-manual-bill',
      'capture-manual-payment',
      'capture-complete',
      'name="today"',
      'name="timeline"',
      'name="money"',
    ]) {
      expect(layout.includes(dead)).toBe(false);
    }
  });

  test('P0.17 no inventable Progress % via ImprovementBar on progress tab', () => {
    const progress = read('patient-app/app/(tabs)/progress.tsx');
    expect(progress.includes('ImprovementBar')).toBe(false);
    expect(progress).not.toMatch(/concern_score\s*\*\s*33/);
    expect(progress).not.toMatch(/\*\s*33\s*\*\s*concern/);
  });

  test('P0.18 no hardcoded sparkline series in SkinMetricSparkCards', () => {
    const src = read('patient-app/components/progress/SkinMetricSparkCards.tsx');
    expect(src).toMatch(/No fabricated sparklines/);
    expect(src).not.toMatch(/sparklinePoints\s*=\s*\[/);
    expect(src).not.toMatch(/data:\s*\[\s*\d+\s*,\s*\d+/);
    expect(src.includes('Not enough journal days yet')).toBe(true);
  });

  test('P0.20 TOUCHE_AGENTIC_ARCHITECTURE.md SSOT exists', () => {
    const p = path.join(repoRoot, 'docs/product/TOUCHE_AGENTIC_ARCHITECTURE.md');
    expect(fs.existsSync(p)).toBe(true);
    const text = fs.readFileSync(p, 'utf8');
    expect(text).toMatch(/patient_record_facts/);
    expect(text.length).toBeGreaterThan(500);
  });

  test('P2.27 pre-auth binding contract documents TOUCH-026 is NOT the pattern', () => {
    const text = read('docs/product/TOUCHE_AGENTIC_ARCHITECTURE.md');
    expect(text).toMatch(/TOUCH-026 is NOT the binding pattern/);
    expect(text).toMatch(/Pre-auth binding contract \(P2\.20–P2\.27\)/);
  });
});
