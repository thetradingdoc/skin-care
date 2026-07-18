'use strict';

const {
  assertVisualPointerShape,
  visualPointerFromVision,
  VISUAL_POINTER_ALLOWED_KEYS,
  isForbiddenScoreKey,
} = require('../services/medical-tracker-rails/visual-observation-pointer');
const { structureByTag } = require('../services/capture-orchestration/structure-by-tag');

describe('visual observation pointer — no fabricated precision', () => {
  test('region-only pointer from vision zones is ok', () => {
    const pointer = visualPointerFromVision(
      {
        findings: [
          { zones: ['t_zone', 'left_cheek'], plain_language: 'Uneven tone on the T-zone.' },
        ],
        scan_summary: 'Uneven tone on the T-zone.',
      },
      { text: 'Uneven tone on the T-zone.' },
    );
    expect(pointer.zones).toEqual(['t_zone', 'left_cheek']);
    expect(pointer.labeled).toBe('ai_suggestion');
    expect(pointer.not_diagnosis).toBe(true);
    expect(assertVisualPointerShape(pointer).ok).toBe(true);
  });

  test('rejects percentage / score fields (anti-pattern lock)', () => {
    const bad = [
      { zones: ['chin'], moisture_pct: 72, labeled: 'ai_suggestion', not_diagnosis: true },
      { zones: ['chin'], health_score: 88, labeled: 'ai_suggestion', not_diagnosis: true },
      { zones: ['chin'], wrinkle_score: 0.4, labeled: 'ai_suggestion', not_diagnosis: true },
      { zones: ['chin'], composite: 91, labeled: 'ai_suggestion', not_diagnosis: true },
      { zones: ['chin'], text: 'Moisture at 72%', labeled: 'ai_suggestion', not_diagnosis: true },
      { zones: ['chin'], score: 50, labeled: 'ai_suggestion', not_diagnosis: true },
    ];
    for (const p of bad) {
      const r = assertVisualPointerShape(p);
      expect(r.ok).toBe(false);
      expect(
        ['VISUAL_POINTER_NUMERIC_SCORE_FORBIDDEN', 'VISUAL_POINTER_PERCENT_IN_TEXT', 'VISUAL_POINTER_SCHEMA'].includes(
          r.error_code,
        ),
      ).toBe(true);
    }
  });

  test('forbidden score key detector covers % anti-patterns', () => {
    expect(isForbiddenScoreKey('moisture_pct')).toBe(true);
    expect(isForbiddenScoreKey('health_score')).toBe(true);
    expect(isForbiddenScoreKey('heatmap')).toBe(true);
    expect(isForbiddenScoreKey('zones')).toBe(false);
    expect(VISUAL_POINTER_ALLOWED_KEYS).toContain('zones');
    expect(VISUAL_POINTER_ALLOWED_KEYS).not.toContain('health_score');
  });

  test('mark compare reuses compare_group_id on pointer — not a new compare system', () => {
    const pointer = visualPointerFromVision(
      { findings: [{ zones: ['chin'] }] },
      { compareGroupId: 'cg_abc123' },
    );
    expect(pointer.compare_group_id).toBe('cg_abc123');
    expect(assertVisualPointerShape(pointer).ok).toBe(true);
  });

  test('structureSkin fills body_area from vision zones when hint absent', () => {
    const r = structureByTag('skin', {
      vision: {
        scan_summary: 'Uneven tone on the T-zone.',
        findings: [{ zones: ['t_zone'], label: 'Uneven tone', plain_language: 'Uneven tone.' }],
      },
      userHints: { date: '2026-07-17' },
    });
    expect(r.valid).toBe(true);
    expect(r.normalized.body_area).toBe('T-zone');
    expect(r.normalized.visual_pointer.zones).toEqual(['t_zone']);
    expect(r.normalized.visual_pointer.labeled).toBe('ai_suggestion');
    expect(r.normalized.ai_suggestion.findings).toBeUndefined();
  });

  test('body photo: empty face zones + observed_region → labels, not face mesh', () => {
    const pointer = visualPointerFromVision(
      {
        observed_region: 'lower leg',
        findings: [{ zones: [], plain_language: 'Mild dryness on the lower leg.' }],
        scan_summary: 'Mild dryness on the lower leg.',
      },
      { text: 'Mild dryness on the lower leg.' },
    );
    expect(pointer.zones).toEqual([]);
    expect(pointer.zone_labels).toEqual(['lower leg']);
    expect(assertVisualPointerShape(pointer).ok).toBe(true);

    const r = structureByTag('skin', {
      vision: {
        observed_region: 'lower leg',
        scan_summary: 'Mild dryness on the lower leg.',
        findings: [{ zones: [], plain_language: 'Mild dryness on the lower leg.', confidence: 0.8 }],
      },
      userHints: { date: '2026-07-17' },
    });
    expect(r.valid).toBe(true);
    expect(r.normalized.body_area).toBe('lower leg');
    expect(r.normalized.visual_pointer.zones).toEqual([]);
    expect(r.normalized.visual_pointer.zone_labels).toEqual(['lower leg']);
  });

  test('structureMark attaches visual_pointer with compare_group_id', () => {
    const r = structureByTag('mark', {
      vision: {
        findings: [{ zones: ['chin'], plain_language: 'Mark on chin.' }],
      },
      userHints: { date: '2026-07-17', compare_group_id: 'cg_test1' },
    });
    expect(r.valid).toBe(true);
    expect(r.normalized.visual_pointer.zones).toEqual(['chin']);
    expect(r.normalized.visual_pointer.compare_group_id).toBe('cg_test1');
  });

  test('policy rejects scored visual_pointer on persist', () => {
    const { assertOrchestrationPersistPolicy } = require('../services/medical-tracker-rails/policy');
    const bad = {
      date: '2026-07-17',
      body_area: 'chin',
      ai_suggestion: {
        text: 'Uneven tone.',
        labeled: 'ai_suggestion',
        not_diagnosis: true,
        source: 'face_read_vision',
      },
      visual_pointer: {
        zones: ['chin'],
        zone_labels: ['chin'],
        labeled: 'ai_suggestion',
        not_diagnosis: true,
        moisture_pct: 40,
      },
    };
    const r = assertOrchestrationPersistPolicy('skin', bad);
    expect(r.ok).toBe(false);
    expect(r.error_code).toBe('VISUAL_POINTER_NUMERIC_SCORE_FORBIDDEN');
  });
});
