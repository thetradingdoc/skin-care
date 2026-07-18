'use strict';

const {
  normalizeVisionPayload,
  containsToneLimitationDisclaimer,
  containsSelfReferentialCommentary,
  sanitizeVisionProse,
  bodyAreaFromVisionFindings,
  VISION_SYSTEM_PROMPT,
  SELF_REFERENTIAL_COMMENTARY_PATTERNS,
  HARD_VISION_REJECT_REASONS,
  FACE_ONLY_REJECT_REASONS,
} = require('../services/face-read-vision');

describe('face-read-vision normalizeVisionPayload', () => {
  test('finding with missing confidence defaults to 1.0 and survives filter', () => {
    const result = normalizeVisionPayload({
      findings: [
        {
          id: 'acne_chin',
          label: 'Breakouts',
          plain_language: 'Small bumps on chin.',
          severity: 2,
          zones: ['chin'],
        },
      ],
      concern_scores: { acne: 2 },
      scan_summary: 'Breakouts on lower face.',
      quality: 'ok',
    });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].confidence).toBe(1.0);
  });

  test('poor_lighting coaching finding is dropped; scan_summary sanitized', () => {
    const result = normalizeVisionPayload({
      findings: [
        {
          id: 'poor_lighting',
          label: 'Low light',
          plain_language: 'Retake in better light.',
          severity: 1,
          zones: [],
          confidence: 0.95,
        },
      ],
      concern_scores: {},
      scan_summary: 'Lighting made it harder to read. Retake in better light for best results.',
      quality: 'low',
    });
    // Coaching finding gone; neutral stub may remain so compose can proceed.
    expect(result.findings.every((f) => f.id !== 'poor_lighting')).toBe(true);
    expect(containsSelfReferentialCommentary(result.scan_summary)).toBe(false);
    expect(result.scan_summary).not.toMatch(/retake|better light/i);
  });

  test('confidence 0.45 passes for dark skin tone', () => {
    const result = normalizeVisionPayload({
      fit_skin_tone: 'dark',
      findings: [
        {
          id: 'texture_cheek',
          label: 'Texture',
          plain_language: 'Some roughness visible.',
          severity: 1,
          zones: ['left_cheek'],
          confidence: 0.45,
        },
      ],
      concern_scores: { texture: 1 },
      scan_summary: 'Some roughness on the left cheek.',
      quality: 'ok',
    });
    expect(result.findings).toHaveLength(1);
  });

  test('confidence 0.45 filtered for light skin tone; stub may replace empty', () => {
    const result = normalizeVisionPayload({
      fit_skin_tone: 'light',
      findings: [
        {
          id: 'texture_cheek',
          label: 'Texture',
          plain_language: 'Some roughness visible.',
          severity: 1,
          zones: ['left_cheek'],
          confidence: 0.45,
        },
      ],
      concern_scores: {},
      scan_summary: 'Light tone scan.',
      quality: 'ok',
    });
    expect(result.findings.every((f) => f.id !== 'texture_cheek')).toBe(true);
    // Empty after filter → neutral stub (body compose must not fail closed).
    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    expect(result.findings[0].id).toBe('skin_visible');
  });

  test('health_scores clamped 0-100', () => {
    const result = normalizeVisionPayload({
      concern_scores: { acne: 1 },
      findings: [{ id: 'acne', label: 'Breakouts', severity: 1, zones: ['chin'], confidence: 0.9 }],
      health_scores: { hydration: 150, clarity: -5, evenness: 55.4, barrier: null },
      scan_summary: 'Test.',
      quality: 'ok',
    });
    expect(result.health_scores.hydration).toBe(100);
    expect(result.health_scores.clarity).toBe(0);
    expect(result.health_scores.evenness).toBe(55);
    expect(result.health_scores.barrier).toBeNull();
  });
});

describe('self-referential commentary ban (category, not phrase list)', () => {
  const DEVICE_BUG_FIXTURE =
    'The skin appears generally healthy with some uneven tone. Dark skin tones can make certain features less visible.';

  /** Varied fixtures across lighting / tone / angle / resolution / retake / model-meta. */
  const CATEGORY_FIXTURES = [
    'Dark skin tones can make certain features less visible.',
    'Features are less visible on deeper tones.',
    'Due to your dark skin tone, analysis is harder.',
    'Estimate may vary on deep skin tones — retake in good light for best results.',
    'Lighting made it harder to read skin details.',
    'A retake in better light will give clearer results.',
    'Try again with a clearer photo for more accurate results.',
    'Poor resolution may reduce accuracy.',
    'The angle is suboptimal for a precise read.',
    'As an AI I cannot accurately assess this skin.',
    'My analysis may be limited on this Fitzpatrick type.',
    'Low confidence due to framing.',
  ];

  test('device-reported fixture is detected', () => {
    expect(containsToneLimitationDisclaimer(DEVICE_BUG_FIXTURE)).toBe(true);
    expect(containsSelfReferentialCommentary(DEVICE_BUG_FIXTURE)).toBe(true);
  });

  test('sanitize strips banned sentences; keeps neutral observation', () => {
    const cleaned = sanitizeVisionProse(DEVICE_BUG_FIXTURE);
    expect(cleaned).toMatch(/uneven tone/i);
    expect(cleaned).not.toMatch(/dark skin tones/i);
    expect(cleaned).not.toMatch(/less visible/i);
    expect(containsSelfReferentialCommentary(cleaned)).toBe(false);
  });

  test('normalizeVisionPayload never ships self-referential prose', () => {
    const result = normalizeVisionPayload({
      fit_skin_tone: 'dark',
      findings: [
        {
          id: 'uneven_tone',
          label: 'Uneven tone',
          plain_language:
            'Some uneven tone across the cheeks. Dark skin tones can make certain features less visible.',
          severity: 1,
          zones: ['left_cheek', 'right_cheek'],
          confidence: 0.7,
        },
      ],
      concern_scores: {},
      scan_summary: DEVICE_BUG_FIXTURE,
      quality: 'ok',
    });
    expect(containsSelfReferentialCommentary(result.scan_summary)).toBe(false);
    expect(result.scan_summary).not.toMatch(/dark skin tones/i);
    expect(containsSelfReferentialCommentary(result.findings[0].plain_language)).toBe(false);
  });

  test('category fixtures all match the ban (lighting/tone/angle/resolution/retake/meta)', () => {
    expect(SELF_REFERENTIAL_COMMENTARY_PATTERNS.length).toBeGreaterThanOrEqual(10);
    for (const f of CATEGORY_FIXTURES) {
      expect(containsSelfReferentialCommentary(f)).toBe(true);
    }
  });

  test('neutral uneven-tone description is allowed', () => {
    const ok = 'The skin appears generally healthy with some uneven tone across the T-zone.';
    expect(containsSelfReferentialCommentary(ok)).toBe(false);
  });

  test('prompt forbids face-required rejects and self-referential commentary', () => {
    expect(VISION_SYSTEM_PROMPT).toMatch(/Do NOT require a face/i);
    expect(VISION_SYSTEM_PROMPT).toMatch(/NEVER reject a clear photo of a leg/i);
    expect(VISION_SYSTEM_PROMPT).toMatch(/NEVER generate self-referential commentary/i);
    expect(VISION_SYSTEM_PROMPT).toMatch(/NEVER comment on skin tone, race/i);
    expect(VISION_SYSTEM_PROMPT).not.toMatch(/mention this in scan_summary/i);
    expect(VISION_SYSTEM_PROMPT).not.toMatch(/A retake in better light will give clearer results/i);
    expect(VISION_SYSTEM_PROMPT).toMatch(/structured fields only/i);
    expect(HARD_VISION_REJECT_REASONS).toEqual(['too_blurry', 'too_dark', 'not_skin']);
    expect(FACE_ONLY_REJECT_REASONS).toEqual(['not_a_face', 'wrong_subject']);
  });

  test('bodyAreaFromVisionFindings prefers zones; else observed_region; never invents face', () => {
    expect(
      bodyAreaFromVisionFindings({
        findings: [{ zones: ['t_zone', 'left_cheek'] }],
      }),
    ).toBe('T-zone, left cheek');
    expect(
      bodyAreaFromVisionFindings({
        findings: [{ zones: [] }],
        observed_region: 'left shoulder',
      }),
    ).toBe('left shoulder');
    expect(bodyAreaFromVisionFindings({ findings: [{ zones: [] }] })).toBeNull();
  });
});
