/**
 * Phase 5 UI — source assertions for Yes/No, catalog copy, spend, window counts.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import {
  SHELF_NO_CATALOG_MATCH,
  SPEND_SUMMARY_HONESTY,
  SPEND_SUMMARY_LABEL,
  addRxToShelfPrompt,
} from '@/lib/phase5-ui-copy';

const APP = join(__dirname, '../..');

describe('Phase 5 UI copy decisions', () => {
  it('catalog miss never uses safety framing', () => {
    expect(SHELF_NO_CATALOG_MATCH).toMatch(/catalog yet/i);
    expect(SHELF_NO_CATALOG_MATCH.toLowerCase()).not.toMatch(/safe|safety|not safe/);
  });

  it('spend label is arithmetic-only phrasing', () => {
    expect(SPEND_SUMMARY_LABEL).toBe('Shelf prices logged');
    expect(SPEND_SUMMARY_HONESTY).toMatch(/not a savings estimate/i);
  });

  it('rx shelf prompt names the drug', () => {
    expect(addRxToShelfPrompt('Tretinoin')).toBe('Add Tretinoin to Shelf?');
  });
});

describe('Phase 5 screens wired', () => {
  it('confirm/rx has Yes/No shelf prompt and cancel', () => {
    const src = readFileSync(join(APP, 'app/capture/confirm/rx.tsx'), 'utf8');
    expect(src).toMatch(/confirm-rx-shelf-yes/);
    expect(src).toMatch(/confirm-rx-shelf-no/);
    expect(src).toMatch(/add_to_shelf:\s*true/);
    expect(src).toMatch(/cancelCapture/);
  });

  it('scan uses catalog-miss copy', () => {
    const src = readFileSync(join(APP, 'app/(tabs)/scan.tsx'), 'utf8');
    expect(src).toMatch(/SHELF_NO_CATALOG_MATCH/);
  });

  it('shelf shows ingredients panel + spend', () => {
    const shelf = readFileSync(join(APP, 'app/(tabs)/shelf.tsx'), 'utf8');
    const actions = readFileSync(join(APP, 'components/shelf/ShelfItemActions.tsx'), 'utf8');
    expect(shelf).toMatch(/shelf-spend-summary/);
    expect(shelf).toMatch(/ingredients_text/);
    expect(actions).toMatch(/shelf-ingredients-panel/);
  });

  it('progress shows spend + shelf_in_window + media_in_window', () => {
    const src = readFileSync(join(APP, 'app/(tabs)/progress.tsx'), 'utf8');
    expect(src).toMatch(/progress-spend-summary/);
    expect(src).toMatch(/progress-shelf-in-window/);
    expect(src).toMatch(/progress-media-in-window/);
    expect(src).toMatch(/no before\/after improvement claims/i);
  });
});
