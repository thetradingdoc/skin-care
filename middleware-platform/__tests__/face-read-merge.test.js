'use strict';

const {
  mergeFaceReadResults,
  isGateReject,
  buildGateRejectFaceRead,
  buildWrongSubjectFaceRead,
} = require('../services/face-read-merge');

describe('face-read-merge', () => {
  const cvPass = {
    apparent_age_estimate: 32,
    quality: 'ok',
    model_id: 'opencv-dnn-age-gender-v1',
    model_version: '2.0.0',
    face_bbox: { x: 0.2, y: 0.1, w: 0.5, h: 0.6 },
    zone_polygons: { forehead: [[0.3, 0.1], [0.7, 0.1], [0.6, 0.25]] },
    quality_flags: [],
  };

  const visionOk = {
    concern_scores: {
      hyperpigmentation: 3,
      texture: 2,
      dryness: 0,
      redness: 0,
      acne: 1,
      pores: 0,
      dark_circles: 0,
      oiliness: 0,
    },
    findings: [
      { id: 'hyperpigmentation', label: 'Dark spots', severity: 3, zones: ['left_cheek'] },
    ],
    scan_summary: 'Visible uneven tone on cheeks.',
    positive_observations: ['Even hydration'],
    fit_skin_tone: 'medium',
    model_id: 'gpt-4o-face-read-v1',
  };

  test('gate reject returns structured face_read without age', () => {
    const cvReject = {
      reject_reason: 'not_a_face',
      user_message: 'No face detected.',
      quality: 'no_face',
      quality_flags: ['no_face'],
      model_id: 'opencv-dnn-age-gender-v1',
    };
    expect(isGateReject(cvReject)).toBe(true);
    const merged = mergeFaceReadResults(cvReject, null);
    expect(merged.reject_reason).toBe('not_a_face');
    expect(merged.apparent_age_estimate).toBeUndefined();
    expect(merged.findings).toEqual([]);
  });

  test('wrong_subject from vision overrides cv pass', () => {
    const merged = mergeFaceReadResults(cvPass, {
      reject_reason: 'wrong_subject',
      user_message: 'This looks like a hand.',
    });
    expect(merged.reject_reason).toBe('wrong_subject');
    expect(merged.apparent_age_estimate).toBeUndefined();
  });

  test('merge keeps age from CV and findings from vision', () => {
    const merged = mergeFaceReadResults(cvPass, visionOk);
    expect(merged.apparent_age_estimate).toBe(32);
    expect(merged.findings).toHaveLength(1);
    expect(merged.concern_scores.hyperpigmentation).toBe(3);
    expect(merged.zone_polygons.forehead).toBeDefined();
    expect(merged.scan_summary).toContain('cheeks');
  });

  test('vision_failed flag when vision errors', () => {
    const merged = mergeFaceReadResults(cvPass, null, { visionError: 'timeout' });
    expect(merged.quality_flags).toContain('vision_failed');
    expect(merged.apparent_age_estimate).toBe(32);
    expect(merged.findings).toEqual([]);
  });

  test('buildGateRejectFaceRead helper', () => {
    const out = buildGateRejectFaceRead({
      reject_reason: 'face_too_small',
      user_message: 'Move closer.',
    });
    expect(out.reject_reason).toBe('face_too_small');
    expect(out.user_message).toBe('Move closer.');
  });

  test('buildWrongSubjectFaceRead helper', () => {
    const out = buildWrongSubjectFaceRead({ user_message: 'Need your face.' });
    expect(out.reject_reason).toBe('wrong_subject');
    expect(out.health_scores).toEqual({});
    expect(out.age_unreliable).toBe(false);
  });

  test('merge passes health_scores from vision', () => {
    const merged = mergeFaceReadResults(cvPass, {
      ...visionOk,
      health_scores: { hydration: 72, clarity: 44, evenness: 38, barrier: 61 },
    });
    expect(merged.health_scores.hydration).toBe(72);
    expect(merged.health_scores.clarity).toBe(44);
    expect(merged.age_unreliable).toBe(false);
  });

  test('age_unreliable for deep skin with vision failure', () => {
    const merged = mergeFaceReadResults(cvPass, {
      fit_skin_tone: 'dark',
      fitzpatrick_estimate: 'VI',
      concern_scores: {},
      findings: [],
      quality: 'ok',
    }, { visionError: 'timeout' });
    expect(merged.age_unreliable).toBe(true);
    expect(merged.apparent_age_estimate).toBe(32);
  });

  test('age_unreliable for Fitz VI low quality empty findings', () => {
    const merged = mergeFaceReadResults(cvPass, {
      fitzpatrick_estimate: 'VI',
      fit_skin_tone: 'dark',
      concern_scores: {},
      findings: [],
      quality: 'low',
    });
    expect(merged.age_unreliable).toBe(true);
  });
});
