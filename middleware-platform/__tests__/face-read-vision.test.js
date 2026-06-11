'use strict';

const { normalizeVisionPayload } = require('../services/face-read-vision');

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

  test('poor_lighting finding with empty zones passes through', () => {
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
      scan_summary: 'Lighting affected scan quality.',
      quality: 'low',
    });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].zones).toEqual([]);
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
      scan_summary: 'Deep tone scan.',
      quality: 'ok',
    });
    expect(result.findings).toHaveLength(1);
  });

  test('confidence 0.45 filtered for light skin tone', () => {
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
    expect(result.findings).toHaveLength(0);
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
