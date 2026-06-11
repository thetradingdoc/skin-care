import { describe, expect, it } from 'vitest';

import { overallColor, productPillColors, verdictTagColor } from '@/lib/conflict-helpers';
import { ConflictTokens } from '@/constants/conflictTokens';

describe('conflict-helpers extended', () => {
  it('overallColor maps verdict bands', () => {
    expect(overallColor('safe')).toBe(ConflictTokens.barrierGreat);
    expect(overallColor('caution')).toBe(ConflictTokens.barrierOk);
    expect(overallColor('avoid')).toBe(ConflictTokens.barrierWarn);
  });

  it('productPillColors returns design tokens per status', () => {
    expect(productPillColors('conflict').bg).toBe(ConflictTokens.cardRed);
    expect(productPillColors('safe').bg).toBe(ConflictTokens.cardGreen);
  });

  it('stepStateColors maps warn to amber palette', () => {
    const warn = productPillColors('watch');
    expect(warn.bg).toBe(ConflictTokens.cardAmber);
  });
});
