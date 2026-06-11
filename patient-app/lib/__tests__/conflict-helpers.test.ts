import { describe, expect, it } from 'vitest';

import { bfiColor, productPillLabel, barrierLabel, gridCellColor } from '@/lib/conflict-helpers';
import { ConflictTokens } from '@/constants/conflictTokens';

describe('conflict-helpers', () => {
  it('bfiColor maps thresholds to design tokens', () => {
    expect(bfiColor(85)).toBe(ConflictTokens.barrierGreat);
    expect(bfiColor(70)).toBe(ConflictTokens.barrierOk);
    expect(bfiColor(40)).toBe(ConflictTokens.barrierWarn);
  });

  it('barrierLabel returns stress copy below 80', () => {
    expect(barrierLabel(90)).toContain('strong');
    expect(barrierLabel(50)).toContain('stress');
  });

  it('productPillLabel maps shelf status', () => {
    expect(productPillLabel('conflict')).toBe('Conflict');
    expect(productPillLabel('safe')).toBe('Safe');
  });

  it('gridCellColor handles null BFI', () => {
    expect(gridCellColor(null)).toBe('#E5E7EB');
    expect(gridCellColor(82)).toBe(ConflictTokens.barrierGreat);
  });
});
