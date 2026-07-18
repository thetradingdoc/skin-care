'use strict';

/**
 * Part B (c): body-region skin must pass perceive — face absence is not a hard reject.
 * Legitimate quality rejects (blur / dark / not_skin) still 422.
 */
const { assessCaptureQuality } = require('../services/capture-orchestration/quality-gate');

function jpegish(n = 12000) {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
    Buffer.alloc(n, 0x40),
    Buffer.from([0xff, 0xd9]),
  ]);
}

describe('body-region skin — quality gate is region-agnostic', () => {
  test('leg-sized JPEG passes unmetered quality gate for tag=skin', () => {
    const q = assessCaptureQuality({
      buffer: jpegish(),
      mimeType: 'image/jpeg',
      tag: 'skin',
    });
    expect(q.ok).toBe(true);
    expect(q.quality_issues).not.toContain('not_a_face');
    expect(q.quality_issues).not.toContain('wrong_subject');
  });
});

describe('body-region skin — face absence is not a hard reject', () => {
  let db;
  let insertSpy;
  const prevAv = process.env.PATIENT_RECORD_AV_DEV_BYPASS;

  beforeEach(() => {
    process.env.PATIENT_RECORD_AV_DEV_BYPASS = '1';
    jest.resetModules();
  });

  afterEach(() => {
    if (insertSpy) insertSpy.mockRestore();
    if (db) db.close();
    if (prevAv === undefined) delete process.env.PATIENT_RECORD_AV_DEV_BYPASS;
    else process.env.PATIENT_RECORD_AV_DEV_BYPASS = prevAv;
    jest.resetModules();
  });

  test.each([
    ['lower-leg', 'lower leg', 'Mild dryness on the lower leg.'],
    ['shoulder', 'left shoulder', 'Uneven tone on the left shoulder.'],
    ['neck', 'neck', 'Mild redness along the neck.'],
  ])(
    'orchestrateCapture skin + legacy not_a_face (%s) → structured draft, not 422',
    async (fileStem, region, summary) => {
      jest.doMock('../services/capture-orchestration/perceive', () => ({
        perceiveSkinVision: jest.fn(async () => ({
          ok: true,
          vision: {
            // Legacy model shape — must be neutralized, not hard-failed.
            quality: 'wrong_subject',
            reject_reason: 'not_a_face',
            user_message: 'This looks like a body part — we need your face for this scan.',
            observed_region: region,
            findings: [
              {
                id: 'dryness_body',
                label: 'Dryness',
                plain_language: summary,
                severity: 1,
                zones: [],
                confidence: 0.8,
              },
            ],
            scan_summary: summary,
            concern_scores: { dryness: 1 },
            health_scores: { hydration: 55, clarity: 60, evenness: 58, barrier: 50 },
            fit_skin_tone: 'medium',
            fitzpatrick_estimate: 'III',
            positive_observations: [],
          },
        })),
        perceiveDocOcr: jest.fn(async () => ({ ok: false, text: '' })),
      }));

      const factsRepo = require('../repositories/patient-record-facts-repo');
      const { ensureTables: ensureMeter } = require('../services/ai-capture-meter');
      const { orchestrateCapture } = require('../services/capture-orchestration');

      db = require('better-sqlite3')(':memory:');
      factsRepo.ensurePatientRecordFactsTable(db);
      ensureMeter(db);
      insertSpy = jest.spyOn(factsRepo, 'insertFact');

      const result = await orchestrateCapture({
        db,
        tag: 'skin',
        aiOrManual: 'ai',
        sessionId: `sess_body_${fileStem}`,
        patientId: `pat_body_${fileStem}`,
        buffer: jpegish(),
        mimeType: 'image/jpeg',
        fileName: `${fileStem}.jpg`,
        isPlus: true,
        requestId: `req_body_${fileStem}`,
      });

      expect(result.ok).toBe(true);
      expect(result.status).not.toBe(422);
      expect(result.error_code).not.toBe('QUALITY_GATE_FAILED');
      expect(result.draft).toBeTruthy();
      expect(result.draft.body_area).toBe(region);
      expect(result.draft.ai_suggestion).toBeTruthy();
      expect(String(result.draft.ai_suggestion.text || '')).toMatch(
        /leg|shoulder|neck|dryness|tone|redness/i,
      );
      expect(insertSpy).toHaveBeenCalled();
    },
  );

  test('orchestrateCapture skin + too_blurry still → 422 QUALITY_GATE_FAILED', async () => {
    jest.doMock('../services/capture-orchestration/perceive', () => ({
      perceiveSkinVision: jest.fn(async () => ({
        ok: true,
        vision: {
          quality: 'reject',
          reject_reason: 'too_blurry',
          user_message: 'Photo is too blurry.',
          findings: [],
          scan_summary: '',
        },
      })),
      perceiveDocOcr: jest.fn(async () => ({ ok: false, text: '' })),
    }));

    const factsRepo = require('../repositories/patient-record-facts-repo');
    const { ensureTables: ensureMeter } = require('../services/ai-capture-meter');
    const { orchestrateCapture } = require('../services/capture-orchestration');

    db = require('better-sqlite3')(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
    ensureMeter(db);
    insertSpy = jest.spyOn(factsRepo, 'insertFact');

    const result = await orchestrateCapture({
      db,
      tag: 'skin',
      aiOrManual: 'ai',
      sessionId: 'sess_body_blur',
      buffer: jpegish(),
      mimeType: 'image/jpeg',
      fileName: 'blurry.jpg',
      isPlus: true,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(422);
    expect(result.error_code).toBe('QUALITY_GATE_FAILED');
    expect(result.quality.quality_issues).toContain('too_blurry');
    expect(insertSpy).not.toHaveBeenCalled();
  });
});

describe('normalizeVisionPayload — face-only rejects neutralized', () => {
  test('not_a_face + body finding → ok quality, observed_region preserved', () => {
    const { normalizeVisionPayload, bodyAreaFromVisionFindings } = require('../services/face-read-vision');
    const result = normalizeVisionPayload({
      quality: 'wrong_subject',
      reject_reason: 'not_a_face',
      observed_region: 'lower leg',
      findings: [
        {
          id: 'dryness_leg',
          label: 'Dryness',
          plain_language: 'Mild dryness on the lower leg.',
          severity: 1,
          zones: [],
          confidence: 0.85,
        },
      ],
      concern_scores: { dryness: 1 },
      scan_summary: 'Mild dryness on the lower leg.',
      fit_skin_tone: 'medium',
    });
    expect(result.reject_reason).toBeNull();
    expect(result.quality).toBe('ok');
    expect(result.observed_region).toBe('lower leg');
    expect(bodyAreaFromVisionFindings(result)).toBe('lower leg');
    expect(result.findings[0].zones).toEqual([]);
  });
});
