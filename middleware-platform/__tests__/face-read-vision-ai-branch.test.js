'use strict';

/**
 * H6 — AI vision branch with FACE_READ_VISION_ENABLED=1 and mocked OpenAI response.
 */

describe('H6 face-read vision AI branch (flag on)', () => {
  const prevFlag = process.env.FACE_READ_VISION_ENABLED;
  const prevKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.FACE_READ_VISION_ENABLED = '1';
    process.env.OPENAI_API_KEY = 'sk-test-fake';
    jest.resetModules();
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env.FACE_READ_VISION_ENABLED;
    else process.env.FACE_READ_VISION_ENABLED = prevFlag;
    if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevKey;
    jest.restoreAllMocks();
  });

  test('analyzeWithVision returns normalized payload when OpenAI responds', async () => {
    const visionJson = {
      apparent_age_estimate: 34,
      quality: 'ok',
      reject_reason: null,
      fit_skin_tone: 'medium',
      fitzpatrick_estimate: 'III',
      concern_scores: { acne: 1, dryness: 0, hyperpigmentation: 0, redness: 0, texture: 0, pores: 0, dark_circles: 0, oiliness: 0 },
      findings: [
        {
          id: 'mild_acne',
          label: 'Mild bumps',
          plain_language: 'A few bumps on the chin.',
          severity: 1,
          zones: ['chin'],
          confidence: 0.8,
        },
      ],
      health_scores: { hydration: 70, clarity: 75, evenness: 80, barrier: 72 },
      scan_summary: 'Mild chin bumps; otherwise calm.',
      positive_observations: ['Even tone'],
      not_diagnosis: true,
    };

    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(visionJson) } }],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      }),
    }));

    const { analyzeWithVision } = require('../services/face-read-vision');
    const result = await analyzeWithVision(Buffer.from('fake-jpeg'), 'image/jpeg');
    expect(result).toBeTruthy();
    expect(result.apparent_age_estimate).toBe(34);
    expect(result.findings).toHaveLength(1);
    expect(result._usage.prompt_tokens).toBe(100);
    expect(global.fetch).toHaveBeenCalled();
  });

  test('analyzeWithVision returns null when flag off (manual path)', async () => {
    process.env.FACE_READ_VISION_ENABLED = '0';
    jest.resetModules();
    const { analyzeWithVision } = require('../services/face-read-vision');
    const result = await analyzeWithVision(Buffer.from('fake-jpeg'), 'image/jpeg');
    expect(result).toBeNull();
  });
});
