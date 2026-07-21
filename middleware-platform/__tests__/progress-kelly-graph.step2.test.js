'use strict';

jest.mock('../services/consumer-rails/node-runner', () => {
  const actual = jest.requireActual('../services/consumer-rails/node-runner');
  return {
    ...actual,
    runConsumerLlmStep: jest.fn(),
  };
});

jest.mock('../services/progress-kelly-judge', () => ({
  checkGuardrailJudge: jest.fn(async () => ({ passed: true })),
}));

const Database = require('better-sqlite3');
const { runConsumerLlmStep } = require('../services/consumer-rails/node-runner');
const { checkGuardrailJudge } = require('../services/progress-kelly-judge');
const {
  generateProgressKellyMessage,
  PROGRESS_KELLY_SYSTEM_PROMPT,
} = require('../services/progress-kelly-graph');
const factsRepo = require('../repositories/patient-record-facts-repo');

describe('progress-kelly-graph Step 2 generation', () => {
  let db;

  beforeEach(() => {
    process.env.FEATURE_PROGRESS_KELLY = '1';
    delete process.env.FEATURE_PROGRESS_KELLY_JUDGE;
    db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
    db.exec(`
      CREATE TABLE patient_routine_templates (
        id TEXT PRIMARY KEY, session_id TEXT, patient_id TEXT, name TEXT NOT NULL,
        start_date TEXT, is_active INTEGER DEFAULT 1, updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE patient_routine_daily_entries (
        id TEXT PRIMARY KEY, template_id TEXT, session_id TEXT, patient_id TEXT, entry_date TEXT
      );
      CREATE TABLE patient_routine_daily_item_logs (
        id TEXT PRIMARY KEY, daily_entry_id TEXT, completed INTEGER DEFAULT 0
      );
    `);
    factsRepo.insertFact(db, {
      patient_id: 'pat_pk',
      session_id: 'sess_pk',
      tag: 'mark',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-07-01', body_location: 'cheek', note: 'mark A' },
      compare_group_id: 'cg_pk',
      confirmed_at: '2026-07-01T12:00:00.000Z',
    });
    runConsumerLlmStep.mockReset();
    checkGuardrailJudge.mockClear();
    checkGuardrailJudge.mockResolvedValue({ passed: true });
  });

  afterEach(() => {
    db.close();
    delete process.env.FEATURE_PROGRESS_KELLY;
  });

  test('system prompt is snapshot coach', () => {
    expect(PROGRESS_KELLY_SYSTEM_PROMPT).toMatch(/Kelly/);
    expect(PROGRESS_KELLY_SYSTEM_PROMPT).toMatch(/snapshot coach/i);
    expect(PROGRESS_KELLY_SYSTEM_PROMPT).toMatch(/missed a streak/i);
  });

  test('valid LLM JSON → success message', async () => {
    runConsumerLlmStep.mockResolvedValue({
      success: true,
      content: JSON.stringify({
        message_type: 'observation',
        body: 'You have 1 confirmed photo for this mark.',
        day_reference: null,
        action: { label: 'Compare', type: 'compare' },
      }),
      tools_used: [],
    });

    const out = await generateProgressKellyMessage(db, {
      sessionId: 'sess_pk',
      patientId: 'pat_pk',
      markId: 'cg_pk',
    });

    expect(runConsumerLlmStep).toHaveBeenCalledWith(
      expect.objectContaining({ graphKind: 'progress' }),
    );
    expect(out.success).toBe(true);
    expect(out.fallback).toBeUndefined();
    expect(out.message.body).toMatch(/1 confirmed photo/);
    expect(checkGuardrailJudge).toHaveBeenCalled();
  });

  test('schema failure → fallback message (not raw failure)', async () => {
    runConsumerLlmStep.mockResolvedValue({
      success: true,
      content: JSON.stringify({
        message_type: 'observation',
        body: 'Looking clearer!',
        day_reference: null,
        action: { label: 'Compare', type: 'compare' },
        clarity_pct: 22,
      }),
      tools_used: [],
    });

    const out = await generateProgressKellyMessage(db, {
      sessionId: 'sess_pk',
      patientId: 'pat_pk',
      markId: 'cg_pk',
    });

    expect(out.success).toBe(true);
    expect(out.fallback).toBe(true);
    expect(out.prior_failure.reason).toBe('schema_validation_failed');
    expect(checkGuardrailJudge).not.toHaveBeenCalled();
  });

  test('non-JSON prose → fallback via schema_validation_failed', async () => {
    runConsumerLlmStep.mockResolvedValue({
      success: true,
      content: 'Your skin looks 40% better this week.',
      tools_used: [],
    });

    const out = await generateProgressKellyMessage(db, {
      sessionId: 'sess_pk',
      patientId: 'pat_pk',
      markId: 'cg_pk',
    });

    expect(out.fallback).toBe(true);
    expect(out.prior_failure.reason).toBe('schema_validation_failed');
  });
});
