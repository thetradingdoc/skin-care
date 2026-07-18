'use strict';

/**
 * Canonical orchestrateCapture + Phase 4 policy gates.
 * Adversarial: diagnosis-shaped prose must fail BEFORE insertFact (never called).
 * Also: runCaptureCompose is not an HTTP capture entrypoint.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const {
  orchestrateCapture,
} = require('../services/capture-orchestration');
const { structureByTag } = require('../services/capture-orchestration/structure-by-tag');
const factsRepo = require('../repositories/patient-record-facts-repo');
const { ensureTables: ensureMeter } = require('../services/ai-capture-meter');
const {
  assertOrchestrationPersistPolicy,
  assertNoCommerceOnPrescription,
} = require('../services/medical-tracker-rails/policy');
const { validatePrescriptionStructured } = require('../services/patient-record-fact-validators');

function tinyJpeg() {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
    Buffer.alloc(4096, 1),
  ]);
}

describe('orchestrateCapture policy gates (canonical HTTP path)', () => {
  let db;
  let insertSpy;
  const prevAvBypass = process.env.PATIENT_RECORD_AV_DEV_BYPASS;

  beforeEach(() => {
    process.env.PATIENT_RECORD_AV_DEV_BYPASS = '1';
    db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
    ensureMeter(db);
    insertSpy = jest.spyOn(factsRepo, 'insertFact');
  });

  afterEach(() => {
    insertSpy.mockRestore();
    db.close();
    if (prevAvBypass === undefined) delete process.env.PATIENT_RECORD_AV_DEV_BYPASS;
    else process.env.PATIENT_RECORD_AV_DEV_BYPASS = prevAvBypass;
  });

  test('adversarial: user note with diagnosis prose — insertFact never called', async () => {
    const result = await orchestrateCapture({
      db,
      tag: 'skin',
      aiOrManual: 'manual',
      sessionId: 'sess_dx_note',
      buffer: tinyJpeg(),
      mimeType: 'image/jpeg',
      userHints: { date: '2026-07-16', note: 'you have eczema on the cheek' },
    });
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe('DIAGNOSIS_VOCABULARY');
    expect(result.vision_fail).toBe(true);
    expect(result.action).toBe('retake');
    expect(result.manual_allowed).toBe(true);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  test('adversarial: full AI path with mocked vision diagnosis — insertFact never called', () => {
    jest.resetModules();
    jest.doMock('../services/capture-orchestration/perceive', () => ({
      perceiveSkinVision: jest.fn(async () => ({
        ok: true,
        vision: {
          scan_summary: 'This looks like melanoma on the left cheek',
          findings: [{ label: 'cheek' }],
          quality: 'ok',
        },
      })),
      perceiveDocOcr: jest.fn(async () => ({ ok: false, text: '' })),
    }));
    // Re-require after mock
    const factsRepoFresh = require('../repositories/patient-record-facts-repo');
    const { ensureTables: ensureMeterFresh } = require('../services/ai-capture-meter');
    const { orchestrateCapture: orchFresh } = require('../services/capture-orchestration');
    const dbFresh = new Database(':memory:');
    factsRepoFresh.ensurePatientRecordFactsTable(dbFresh);
    ensureMeterFresh(dbFresh);
    const insertSpyFresh = jest.spyOn(factsRepoFresh, 'insertFact');

    return orchFresh({
      db: dbFresh,
      tag: 'skin',
      aiOrManual: 'ai',
      sessionId: 'sess_mock_vision_dx',
      buffer: tinyJpeg(),
      mimeType: 'image/jpeg',
      isPlus: true,
      userHints: { date: '2026-07-16', note: 'photo only' },
    }).then((result) => {
      expect(result.ok).toBe(false);
      expect(result.error_code).toBe('DIAGNOSIS_VOCABULARY');
      expect(result.vision_fail).toBe(true);
      expect(insertSpyFresh).not.toHaveBeenCalled();
      insertSpyFresh.mockRestore();
      dbFresh.close();
      jest.dontMock('../services/capture-orchestration/perceive');
      jest.resetModules();
    });
  });

  test('clean labeled free prose still persists (insertFact called once)', async () => {
    const result = await orchestrateCapture({
      db,
      tag: 'skin',
      aiOrManual: 'manual',
      sessionId: 'sess_clean',
      buffer: tinyJpeg(),
      mimeType: 'image/jpeg',
      userHints: { date: '2026-07-16', note: 'cheek feels calmer today', body_area: 'cheek' },
    });
    expect(result.ok).toBe(true);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(result.fact).toBeTruthy();
  });

  test('Rx commerce rejected by policy layer AND schema validator (two layers)', () => {
    const forced = {
      drug: 'tretinoin',
      date: '2026-07-16',
      commerce_variant_id: 'gid://shopify/ProductVariant/1',
      purchase_url: 'https://shop.example/buy',
    };
    const schema = validatePrescriptionStructured(forced);
    expect(schema.valid).toBe(false);
    expect(schema.errors).toContain('prescription_commerce_forbidden');

    // Policy layer independent of schema
    const policy = assertNoCommerceOnPrescription(forced);
    expect(policy.ok).toBe(false);
    expect(policy.error_code).toBe('PRESCRIPTION_COMMERCE_FORBIDDEN');

    // Orchestration: schema fails first (STRUCTURED_VALIDATION_FAILED) — still no insert
  });

  test('adversarial: prescription commerce in userHints — insertFact never called', async () => {
    const result = await orchestrateCapture({
      db,
      tag: 'prescription',
      aiOrManual: 'manual',
      sessionId: 'sess_rx_commerce',
      buffer: tinyJpeg(),
      mimeType: 'image/jpeg',
      userHints: {
        drug: 'tretinoin',
        date: '2026-07-16',
        commerce_variant_id: 'gid://shopify/ProductVariant/9',
        purchase_url: 'https://evil.example/buy',
      },
    });
    expect(result.ok).toBe(false);
    // Schema validator rejects first; either way insert must not run
    expect(insertSpy).not.toHaveBeenCalled();
    expect(['STRUCTURED_VALIDATION_FAILED', 'PRESCRIPTION_COMMERCE_FORBIDDEN']).toContain(
      result.error_code,
    );
  });

  test('policy gate runs assertAiSuggestionShape — bare string suggestion rejected', () => {
    const policy = assertOrchestrationPersistPolicy('skin', {
      date: '2026-07-16',
      note: 'ok',
      ai_suggestion: 'calmer',
    });
    expect(policy.ok).toBe(false);
    expect(policy.error_code).toBe('AI_SUGGESTION_MUST_BE_OBJECT');
  });

  test('labeled free prose without delta is allowed when scrub-clean', () => {
    const policy = assertOrchestrationPersistPolicy('skin', {
      date: '2026-07-16',
      note: 'mine',
      body_area: 'cheek',
      ai_suggestion: {
        text: 'Looks calmer than last week.',
        source: 'face_read_vision',
        labeled: 'ai_suggestion',
        not_diagnosis: true,
      },
    });
    expect(policy.ok).toBe(true);
  });

  test('delta path still enforces assertAiSuggestionTextAllowlisted', () => {
    const policy = assertOrchestrationPersistPolicy('skin', {
      date: '2026-07-16',
      note: 'mine',
      ai_suggestion: {
        delta: 'calmer',
        text: 'Invented clinical prose about the cheek.',
        labeled: 'ai_suggestion',
        not_diagnosis: true,
      },
    });
    expect(policy.ok).toBe(false);
    expect(policy.error_code).toBe('AI_TEXT_NOT_ALLOWLISTED');
  });
});

describe('runCaptureCompose is not an HTTP capture entrypoint', () => {
  const ROOT = path.join(__dirname, '..');
  const ROUTES_DIR = path.join(ROOT, 'routes');
  const BOOTSTRAP_DIR = path.join(ROOT, 'bootstrap');

  function collectJsFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) out.push(...collectJsFiles(p));
      else if (ent.name.endsWith('.js') || ent.name.endsWith('.cjs')) out.push(p);
    }
    return out;
  }

  test('no live route/bootstrap imports runCaptureCompose as capture handler', () => {
    const files = [
      ...collectJsFiles(ROUTES_DIR),
      ...collectJsFiles(BOOTSTRAP_DIR),
      path.join(ROOT, 'server.js'),
    ].filter((f) => fs.existsSync(f));

    const offenders = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      // Ban require/import of capture-compose or runCaptureCompose as a handler
      if (
        /require\(['`].*capture-compose['`]\)/.test(src) ||
        /require\(['`].*medical-tracker-rails['`]\).*runCaptureCompose/.test(src) ||
        /\brunCaptureCompose\b/.test(src) ||
        /\brunCaptureComposeSync\b/.test(src)
      ) {
        // Allow comments that mention the demotion boundary
        const codeLines = src
          .split('\n')
          .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && !l.trim().startsWith('*'));
        const code = codeLines.join('\n');
        if (/\brunCaptureCompose(Sync)?\b/.test(code) || /capture-compose/.test(code)) {
          offenders.push(path.relative(ROOT, file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('patient-records capture path wires orchestrateCapture only', () => {
    const src = fs.readFileSync(path.join(ROUTES_DIR, 'patient-records.js'), 'utf8');
    expect(src).toMatch(/orchestrateCapture/);
    expect(src).not.toMatch(/runCaptureCompose/);
    expect(src).not.toMatch(/capture-compose/);
  });

  test('capture-orchestration is the canonical persist path (policy imported)', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'services/capture-orchestration/index.js'),
      'utf8',
    );
    expect(src).toMatch(/assertOrchestrationPersistPolicy/);
    expect(src).toMatch(/medical-tracker-rails\/policy/);
    expect(src).toMatch(/insertFact/);
    // Policy must run before insertFact in source order for each path
    const policyIdx = src.indexOf('assertOrchestrationPersistPolicy');
    const insertIdx = src.indexOf('factsRepo.insertFact');
    expect(policyIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(policyIdx);
  });
});
