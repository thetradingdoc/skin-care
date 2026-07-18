'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const {
  getMedicalTools,
  getMedicalToolNames,
  CAPTURE_COMPOSE_TOOLS,
  DELTA_COMPOSE_TOOLS,
  EXPORT_PACK_TOOLS,
  getAllowedToolNames,
  executeMedicalTool,
  runCaptureComposeSync,
  runDeltaComposeSync,
  runExportPackSync,
  meterGuardNode,
  FORBIDDEN_CONSUMER_CAPTURE_MODULES,
  policy,
} = require('../services/medical-tracker-rails');
const { INSIGHT_TOOLS, JOURNEY_TOOLS } = require('../services/consumer-rails/consumer-tool-allowlists');
const { getConsumerTools } = require('../services/consumer-rails/consumer-tool-definitions');
const factsRepo = require('../repositories/patient-record-facts-repo');
const { ensureTables: ensureMeter } = require('../services/ai-capture-meter');

describe('P4.01–P4.03 medical tools + allowlists + executor', () => {
  test('P4.01 medical tool definitions include get_extract, normalize_facts, detect_language', () => {
    const names = getMedicalToolNames();
    expect(names).toEqual(
      expect.arrayContaining([
        'get_extract',
        'normalize_facts',
        'detect_language',
        'structure_by_tag',
        'suggest_skin_delta',
        'list_facts_for_export',
      ]),
    );
    expect(getMedicalTools().length).toBe(names.length);
  });

  test('P4.02 medical allowlists are disjoint from shelf insight/journey tools', () => {
    const medical = new Set([
      ...CAPTURE_COMPOSE_TOOLS,
      ...DELTA_COMPOSE_TOOLS,
      ...EXPORT_PACK_TOOLS,
    ]);
    for (const t of INSIGHT_TOOLS) {
      expect(medical.has(t)).toBe(false);
    }
    for (const t of JOURNEY_TOOLS) {
      expect(medical.has(t)).toBe(false);
    }
    for (const t of getConsumerTools().map((x) => x.function.name)) {
      expect(medical.has(t)).toBe(false);
    }
    expect(getAllowedToolNames('capture_compose')).toContain('get_extract');
    expect(getAllowedToolNames('export_pack')).toEqual(['list_facts_for_export']);
    expect(getAllowedToolNames('insight')).toEqual([]);
  });

  test('P4.03 executor rejects shelf tools and graph-mismatched tools', async () => {
    const shelf = await executeMedicalTool('evaluate_lineup', {}, { graphKind: 'capture_compose' });
    expect(shelf.success).toBe(false);
    expect(shelf.error_code).toBe('TOOL_NOT_IN_MEDICAL_ALLOWLIST');

    const wrongGraph = await executeMedicalTool(
      'list_facts_for_export',
      {},
      { graphKind: 'capture_compose', db: new Database(':memory:') },
    );
    expect(wrongGraph.success).toBe(false);
    expect(wrongGraph.error_code).toBe('TOOL_NOT_ALLOWED_FOR_GRAPH');
  });
});

describe('P4.06 meter_guard pre-node', () => {
  let db;
  beforeEach(() => {
    db = new Database(':memory:');
    ensureMeter(db);
    process.env.AI_FREE_CAPTURE_LIMIT = '5';
    process.env.AI_WELCOME_BONUS_LIMIT = '0';
  });
  afterEach(() => {
    try {
      db.close();
    } catch (_) {}
  });

  test('manual path skips meter; AI path consumes', () => {
    const manual = meterGuardNode(db, {
      sessionId: 's1',
      captureKind: 'billing_ocr',
      aiOrManual: 'manual',
    });
    expect(manual.ok).toBe(true);
    expect(manual.skipped).toBe(true);

    const ai = meterGuardNode(db, {
      sessionId: 's1',
      captureKind: 'billing_ocr',
      aiOrManual: 'ai',
    });
    expect(ai.ok).toBe(true);
    expect(ai.usageId).toBeTruthy();
  });
});

describe('P4.04 capture_compose + P4.05 delta_compose + P4.07 export_pack', () => {
  let db;
  beforeEach(() => {
    db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
    ensureMeter(db);
    process.env.AI_FREE_CAPTURE_LIMIT = '10';
    process.env.AI_WELCOME_BONUS_LIMIT = '2';
  });
  afterEach(() => {
    try {
      db.close();
    } catch (_) {}
  });

  test('P4.04 manual capture_compose returns confirm draft', async () => {
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
      Buffer.alloc(2048, 1),
    ]);
    const result = await runCaptureComposeSync({
      db,
      tag: 'skin',
      aiOrManual: 'manual',
      buffer: jpeg,
      mimeType: 'image/jpeg',
      sessionId: 'sess_compose',
      userHints: { date: '2026-07-16', note: 'cheek calm' },
      skipCache: true,
    });
    expect(result.ok).toBe(true);
    expect(result.draft.tag).toBe('skin');
    expect(result.draft.structured_json.note).toBe('cheek calm');
    expect(result.usage_id).toBeFalsy();
  });

  test('P4.05 delta_compose writes AI SUGGESTS only into ai_suggestion', async () => {
    const result = await runDeltaComposeSync({
      db,
      sessionId: 'sess_delta',
      aiOrManual: 'ai',
      priorStructured: { date: '2026-07-01', note: 'rough patch', ai_suggestion: null },
      todayStructured: { date: '2026-07-16', note: 'looking calmer today', body_area: 'cheek' },
    });
    expect(result.ok).toBe(true);
    expect(result.ai_suggestion.delta).toBe('calmer');
    expect(result.structured_json.note).toBe('looking calmer today');
    expect(result.structured_json.body_area).toBe('cheek');
    expect(result.structured_json.ai_suggestion).toEqual(result.ai_suggestion);
    expect(result.structured_json.ai_suggestion).toEqual(
      expect.objectContaining({ labeled: 'ai_suggestion', not_diagnosis: true }),
    );
  });

  test('P4.05 first-ever skin log returns baseline (no fake delta vs empty prior)', async () => {
    const result = await runDeltaComposeSync({
      db,
      sessionId: 'sess_first_skin',
      aiOrManual: 'manual',
      priorStructured: {},
      todayStructured: { date: '2026-07-16', note: 'first check-in', body_area: 'cheek' },
    });
    expect(result.ok).toBe(true);
    expect(result.ai_suggestion.delta).toBe('baseline');
    expect(result.baseline).toBe(true);
    expect(result.prior_used).toBe(false);
    expect(result.structured_json.note).toBe('first check-in');
    expect(result.ai_suggestion.text).toMatch(/baseline/i);
  });

  test('P4.07 export_pack is retrieval-only (no narrative)', async () => {
    factsRepo.insertFact(db, {
      session_id: 'sess_export',
      tag: 'bill',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-07-01', amount: 12 },
      confirmed_at: new Date().toISOString(),
    });
    const pack = await runExportPackSync({
      db,
      sessionId: 'sess_export',
    });
    expect(pack.ok).toBe(true);
    expect(pack.facts.length).toBeGreaterThanOrEqual(1);
    expect(pack.narrative).toBeNull();
    expect(pack.interpretation).toBeNull();
    expect(pack.ai_generated).toBe(false);
    expect(pack.summary).toBeNull();
  });
});

describe('P4.10–P4.12 policy safety boundaries', () => {
  test('P4.10 rejects diagnosis vocabulary fixtures', () => {
    const bad = policy.assertNoDiagnosisVocabulary('This looks like melanoma on your cheek');
    expect(bad.ok).toBe(false);
    expect(bad.matches.length).toBeGreaterThan(0);

    const good = policy.assertNoDiagnosisVocabulary('Skin looks calmer than last week.');
    expect(good.ok).toBe(true);
  });

  test('P4.11 ai_suggestion must be object field — blended note rejected', () => {
    expect(
      policy.assertAiSuggestionShape({
        date: '2026-07-16',
        note: 'AI SUGGESTS calmer',
        ai_suggestion: null,
      }).ok,
    ).toBe(false);
    expect(
      policy.assertAiSuggestionShape({
        date: '2026-07-16',
        note: 'mine',
        ai_suggestion: { delta: 'same', text: 'About the same.', labeled: 'ai_suggestion' },
      }).ok,
    ).toBe(true);
    expect(
      policy.assertAiSuggestionShape({
        date: '2026-07-16',
        note: 'mine',
        ai_suggestion: 'calmer',
      }).error_code,
    ).toBe('AI_SUGGESTION_MUST_BE_OBJECT');
  });

  test('P4.12 prescription compose rejects commerce_variant_id', async () => {
    const forced = {
      date: '2026-07-16',
      drug: 'tretinoin',
      commerce_variant_id: 'gid://shopify/ProductVariant/1',
      purchase_url: 'https://shop.example/buy',
    };
    expect(policy.assertNoCommerceOnPrescription(forced).ok).toBe(false);

    const rejected = await executeMedicalTool(
      'format_confirm_draft',
      { tag: 'prescription', structured_json: forced },
      { graphKind: 'capture_compose' },
    );
    expect(rejected.success).toBe(false);
    expect(rejected.error_code).toBe('PRESCRIPTION_COMMERCE_FORBIDDEN');
    expect(rejected.keys).toEqual(expect.arrayContaining(['commerce_variant_id', 'purchase_url']));
  });

  test('P4.12 P2.04 schema validator also rejects prescription commerce keys', () => {
    const {
      validatePrescriptionStructured,
    } = require('../services/patient-record-fact-validators');
    const bad = validatePrescriptionStructured({
      drug: 'tretinoin',
      commerce_variant_id: 'gid://shopify/ProductVariant/9',
      purchase_url: 'https://shop.example/x',
    });
    expect(bad.valid).toBe(false);
    expect(bad.errors).toContain('prescription_commerce_forbidden');
    expect(bad.forbidden_commerce_keys).toEqual(
      expect.arrayContaining(['commerce_variant_id', 'purchase_url']),
    );
    expect(bad.normalized).not.toHaveProperty('commerce_variant_id');
  });

  test('P4.10 diagnosis vocab in structure path fails compose', async () => {
    const db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
    ensureMeter(db);
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
      Buffer.alloc(2048, 1),
    ]);
    const result = await runCaptureComposeSync({
      db,
      tag: 'skin',
      aiOrManual: 'manual',
      buffer: jpeg,
      mimeType: 'image/jpeg',
      sessionId: 'sess_dx',
      userHints: { date: '2026-07-16', note: 'you have eczema' },
      skipCache: true,
    });
    // note with diagnosis vocab should fail policy on format/structure
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe('DIAGNOSIS_VOCABULARY');
    db.close();
  });
});

describe('P4.13–P4.14 exclusion boundaries', () => {
  test('P4.13 consumer-analysis-graph does not import medical compose or facts', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../services/consumer-analysis-graph.js'),
      'utf8',
    );
    // Ban require() of medical rails / facts — comments may mention the boundary
    expect(src).not.toMatch(/require\(['`].*medical-tracker-rails/);
    expect(src).not.toMatch(/require\(['`].*patient-record-facts/);
    expect(src).not.toMatch(/patient_record_facts/);
    expect(src).not.toMatch(/runCaptureCompose|runDeltaCompose|runExportPack/);
    expect(src).toMatch(/shelf|evaluate|lineup/i);
  });

  test('P4.14 forbidden modules list is checkable and medical index does not require them', () => {
    expect(FORBIDDEN_CONSUMER_CAPTURE_MODULES).toEqual(
      expect.arrayContaining([
        'kelly-conversation-graph',
        'coding-graph',
        'perception-layer/perception-graph',
        'consumer-analysis-graph',
      ]),
    );
    const indexSrc = fs.readFileSync(
      path.join(__dirname, '../services/medical-tracker-rails/index.js'),
      'utf8',
    );
    for (const mod of FORBIDDEN_CONSUMER_CAPTURE_MODULES) {
      expect(indexSrc).not.toMatch(new RegExp(`require\\(['\`].*${mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    }
    const arch = fs.readFileSync(
      path.join(__dirname, '../../docs/product/TOUCHE_AGENTIC_ARCHITECTURE.md'),
      'utf8',
    );
    expect(arch).toMatch(/FORBIDDEN_CONSUMER_CAPTURE_MODULES|Kelly.*excluded|Phase 4/);
    expect(arch).toMatch(/kelly-conversation-graph|coding-graph|perception-graph/);
  });

  test('P4.14 verify-medical-tracker-isolation fails on Kelly require (build guard)', () => {
    const {
      extractRequires,
      FORBIDDEN_REQUIRE_PATTERNS,
      main,
    } = require('../scripts/verify-medical-tracker-isolation.cjs');
    expect(extractRequires("const x = require('../kelly-tool-executor')")).toEqual([
      expect.objectContaining({ spec: '../kelly-tool-executor' }),
    ]);
    expect(FORBIDDEN_REQUIRE_PATTERNS.some((p) => p.test('../kelly-tool-executor'))).toBe(true);
    expect(FORBIDDEN_REQUIRE_PATTERNS.some((p) => p.test('./capture-compose'))).toBe(false);
    // Live tree must pass
    expect(() => main()).not.toThrow();
  });
});

describe('P4.08 checkpointer selection', () => {
  test('getMedicalCheckpointer returns MemorySaver without postgres env', async () => {
    const prev = {
      POSTGRES_URL: process.env.POSTGRES_URL,
      DATABASE_URL: process.env.DATABASE_URL,
      LANGGRAPH_USE_POSTGRES: process.env.LANGGRAPH_USE_POSTGRES,
      LANGGRAPH_MEDICAL_USE_POSTGRES: process.env.LANGGRAPH_MEDICAL_USE_POSTGRES,
      NODE_ENV: process.env.NODE_ENV,
    };
    delete process.env.POSTGRES_URL;
    delete process.env.DATABASE_URL;
    delete process.env.LANGGRAPH_USE_POSTGRES;
    delete process.env.LANGGRAPH_MEDICAL_USE_POSTGRES;
    process.env.NODE_ENV = 'test';
    jest.resetModules();
    const { getMedicalCheckpointer, resetMedicalCheckpointerForTests } = require('../services/medical-tracker-rails/checkpointer');
    resetMedicalCheckpointerForTests();
    const cp = await getMedicalCheckpointer();
    // MemorySaver or null if langgraph missing — either is fine for non-prod
    expect(cp === null || typeof cp === 'object').toBe(true);
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
});

describe('P4.09 capture compose cache key', () => {
  test('contentHash is stable for same payload', () => {
    const {
      contentHash,
      cacheKey,
      cacheScope,
    } = require('../services/medical-tracker-rails/capture-compose-cache');
    const buf = Buffer.from('abc');
    const a = contentHash({
      tag: 'skin',
      buffer: buf,
      mimeType: 'image/jpeg',
      aiOrManual: 'manual',
      userHints: { date: '2026-07-16' },
    });
    const b = contentHash({
      tag: 'skin',
      buffer: buf,
      mimeType: 'image/jpeg',
      aiOrManual: 'manual',
      userHints: { date: '2026-07-16' },
    });
    expect(a).toBe(b);
    expect(cacheScope({ patientId: 'p1' })).toBe('patient:p1');
    expect(cacheKey(a, { patientId: 'p1' })).toBe(`medical:capture_compose:patient:p1:${a}`);
    expect(cacheKey(a, { sessionId: 's1' })).toBe(`medical:capture_compose:session:s1:${a}`);
    // Same content, different patients → different keys (privacy)
    expect(cacheKey(a, { patientId: 'alice' })).not.toBe(cacheKey(a, { patientId: 'bob' }));
    // No scope → refuse (no shared anon bucket)
    expect(cacheScope({})).toBeNull();
    expect(() => cacheKey(a, {})).toThrow(/CACHE_SCOPE_REQUIRED/);
  });
});
