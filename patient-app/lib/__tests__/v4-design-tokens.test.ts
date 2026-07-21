import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { RETIRED_BRAND_ORANGES, V4DesignTokens } from '../../constants/v4DesignTokens';
import { TULIP_PATH } from '../../lib/tulip-path.js';

describe('Wave 0 v4 design tokens', () => {
  it('locks Skiñcare wine / ground / accent red', () => {
    expect(V4DesignTokens.color.red).toBe('#E31919');
    expect(V4DesignTokens.color.wine).toBe('#3D000B');
    expect(V4DesignTokens.color.black).toBe('#3D000B');
    expect(V4DesignTokens.color.ground).toBe('#F3F1EF');
    expect(V4DesignTokens.color.white).toBe('#FFFFFF');
  });

  it('does not use retired oranges as brand tokens', () => {
    const brandValues = Object.values(V4DesignTokens.color).map(String);
    for (const retired of RETIRED_BRAND_ORANGES) {
      expect(brandValues).not.toContain(retired);
    }
  });

  it('ToucheMarkCompact no longer hard-codes #F7591F', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../components/ToucheMarkCompact.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/TOUCHE_MARK_ORANGE\s*=\s*'#F7591F'/);
    expect(src).not.toMatch(/fill=\{TOUCHE_MARK_ORANGE\}/);
    expect(src).not.toMatch(/['"]#F7591F['"]/);
    expect(src).not.toMatch(/['"]#ba200a['"]/i);
    expect(src).toMatch(/color\?/);
    expect(src).toMatch(/TULIP_PATH/);
  });

  it('tulip path matches brand asset length', () => {
    expect(TULIP_PATH.length).toBeGreaterThan(500);
    expect(TULIP_PATH).toMatch(/^M 140\.4 41\.1/);
  });
});
