/**
 * Named-zone overlay — schema lock + UI structurally incapable of %.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import {
  APPROXIMATE_REGION_CAPTION,
  parseVisualPointer,
  visualPointerFromDraft,
} from '@/lib/visual-observation-pointer';

const ROOT = join(__dirname, '../..');

describe('visual observation pointer — client', () => {
  it('parses named zones and rejects score/% payloads', () => {
    const ok = parseVisualPointer({
      zones: ['t_zone', 'left_cheek'],
      zone_labels: ['T-zone', 'left cheek'],
      labeled: 'ai_suggestion',
      not_diagnosis: true,
    });
    expect(ok?.zones).toEqual(['t_zone', 'left_cheek']);

    expect(
      parseVisualPointer({
        zones: ['chin'],
        moisture_pct: 72,
        labeled: 'ai_suggestion',
        not_diagnosis: true,
      }),
    ).toBeNull();
    expect(
      parseVisualPointer({
        zones: ['chin'],
        health_score: 88,
        labeled: 'ai_suggestion',
        not_diagnosis: true,
      }),
    ).toBeNull();
    expect(
      parseVisualPointer({
        zones: ['chin'],
        text: 'Moisture at 72%',
        labeled: 'ai_suggestion',
        not_diagnosis: true,
      }),
    ).toBeNull();
  });

  it('reads visual_pointer from draft', () => {
    expect(
      visualPointerFromDraft({
        visual_pointer: {
          zones: ['chin'],
          zone_labels: ['chin'],
          labeled: 'ai_suggestion',
          not_diagnosis: true,
        },
      })?.zones,
    ).toEqual(['chin']);
  });

  it('overlay + confirm + mark-compare are structurally incapable of % display', () => {
    const overlay = readFileSync(
      join(ROOT, 'components/capture/ObservationZoneOverlay.tsx'),
      'utf8',
    );
    const pointerLib = readFileSync(join(ROOT, 'lib/visual-observation-pointer.ts'), 'utf8');
    const skin = readFileSync(join(ROOT, 'app/capture/confirm/skin.tsx'), 'utf8');
    const markCompare = readFileSync(join(ROOT, 'app/capture/mark-compare.tsx'), 'utf8');

    expect(overlay).toMatch(/ObservationZoneOverlay/);
    expect(overlay).toMatch(/APPROXIMATE_REGION_CAPTION/);
    expect(overlay).toMatch(/VisualPointer/);
    expect(overlay).not.toMatch(/toFixed|moisture_pct/);
    // Type + parser: no score fields on VisualPointer; reject patterns may name anti-patterns.
    expect(pointerLib).toMatch(/type VisualPointer/);
    expect(pointerLib).toMatch(/FORBIDDEN_SCORE_KEY/);
    expect(pointerLib).not.toMatch(/moisture_pct\?:/);
    expect(pointerLib).not.toMatch(/health_score\?:/);

    expect(skin).toMatch(/ObservationZoneOverlay/);
    expect(skin).toMatch(/confirm-skin-ai-suggests/);
    expect(skin).toMatch(/AI SUGGESTS/);

    expect(markCompare).toMatch(/ObservationZoneOverlay/);
    expect(markCompare).toMatch(/mark-compare-side-by-side/);
    expect(markCompare).toMatch(/compare_group|compareGroupId/);
    expect(markCompare).not.toMatch(/moisture_pct\?:|health_score\?:/);
    expect(APPROXIMATE_REGION_CAPTION).toMatch(/approximate/);
  });

  it('overlay uses face ellipses only for face zones; center fallback for body labels', () => {
    const overlay = readFileSync(
      join(ROOT, 'components/capture/ObservationZoneOverlay.tsx'),
      'utf8',
    );
    expect(overlay).toMatch(/FACE_ZONE_LAYOUT/);
    expect(overlay).toMatch(/faceZones/);
    expect(overlay).toMatch(/showCenterFallback/);
    expect(overlay).toMatch(/center-mark/);
    // Must not draw ellipses for arbitrary non-face zone ids
    expect(overlay).toMatch(/zones\.filter/);
  });
});

describe('static product copy — no self-referential analysis commentary', () => {
  const BANNED = [
    /Estimate may vary on deep skin tones/i,
    /retake in good light for best results/i,
    /our model needs\s+more contrast/i,
    /Dark skin tones can make certain features less visible/i,
  ];

  it('onboarding reveal + landing reveal have no banned self-ref copy', () => {
    const reveal = readFileSync(join(ROOT, 'app/onboarding/reveal.tsx'), 'utf8');
    const landing = readFileSync(
      join(ROOT, '../unified-dashboard/skin-care-landing/src/pages/RevealPage.jsx'),
      'utf8',
    );
    for (const re of BANNED) {
      expect(reveal).not.toMatch(re);
      expect(landing).not.toMatch(re);
    }
    expect(reveal).toMatch(/Age estimate is approximate/);
    expect(landing).toMatch(/Age estimate is approximate/);
  });
});

