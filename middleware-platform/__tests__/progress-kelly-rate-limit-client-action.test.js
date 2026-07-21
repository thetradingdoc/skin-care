'use strict';

jest.mock('../services/progress-kelly-judge', () => ({
  checkGuardrailJudge: jest.fn(async () => ({ passed: true })),
}));

jest.mock('../services/consumer-rails/node-runner', () => {
  const actual = jest.requireActual('../services/consumer-rails/node-runner');
  return {
    ...actual,
    runConsumerLlmStep: jest.fn(),
  };
});

const Database = require('better-sqlite3');
const { runConsumerLlmStep } = require('../services/consumer-rails/node-runner');
const {
  recordLastNudge,
  recordLastAttempt,
  getLastNudge,
  isWithinRateLimitWindow,
  DEFAULT_MIN_INTERVAL_MINUTES,
} = require('../services/progress-kelly-nudge-state');
const {
  generateProgressKellyMessage,
  withFallback,
} = require('../services/progress-kelly-graph');
const { resolveClientAction, CLIENT_ACTIONS } = require('../services/progress-kelly-client-action');
const factsRepo = require('../repositories/patient-record-facts-repo');

function seedMark(db) {
  factsRepo.ensurePatientRecordFactsTable(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS patient_routine_templates (
      id TEXT PRIMARY KEY, session_id TEXT, patient_id TEXT, name TEXT NOT NULL,
      start_date TEXT, is_active INTEGER DEFAULT 1, updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS patient_routine_daily_entries (
      id TEXT PRIMARY KEY, template_id TEXT, session_id TEXT, patient_id TEXT, entry_date TEXT
    );
    CREATE TABLE IF NOT EXISTS patient_routine_daily_item_logs (
      id TEXT PRIMARY KEY, daily_entry_id TEXT, completed INTEGER DEFAULT 0
    );
  `);
  factsRepo.insertFact(db, {
    patient_id: 'pat_rl',
    session_id: 'sess_rl',
    tag: 'mark',
    ai_or_manual: 'manual',
    structured_json: { date: '2026-07-01', body_location: 'cheek', note: 'spot' },
    compare_group_id: 'cg_rl',
    confirmed_at: '2026-07-01T12:00:00.000Z',
  });
}

function mockOkObservation() {
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
}

describe('Decision #18 rate limit + Decision #24 client_action', () => {
  let db;

  beforeEach(() => {
    process.env.FEATURE_PROGRESS_KELLY = '1';
    delete process.env.PROGRESS_KELLY_MIN_INTERVAL_MINUTES;
    db = new Database(':memory:');
    seedMark(db);
    runConsumerLlmStep.mockReset();
  });

  afterEach(() => {
    db.close();
    delete process.env.FEATURE_PROGRESS_KELLY;
    delete process.env.PROGRESS_KELLY_MIN_INTERVAL_MINUTES;
  });

  test('default interval is 5 minutes', () => {
    expect(DEFAULT_MIN_INTERVAL_MINUTES).toBe(5);
  });

  test('second call within window is rate_limited with zero LLM calls', async () => {
    mockOkObservation();
    const first = await generateProgressKellyMessage(db, {
      patientId: 'pat_rl',
      markId: 'cg_rl',
      sessionId: 'sess_rl',
    });
    expect(first.client_action).toBe('render');
    expect(first.fallback).toBeUndefined();
    expect(runConsumerLlmStep).toHaveBeenCalledTimes(1);

    runConsumerLlmStep.mockClear();
    const second = await generateProgressKellyMessage(db, {
      patientId: 'pat_rl',
      markId: 'cg_rl',
      sessionId: 'sess_rl',
    });

    expect(second.fallback).toBe(true);
    expect(second.prior_failure.reason).toBe('rate_limited');
    expect(second.client_action).toBe('render_fallback');
    expect(runConsumerLlmStep).not.toHaveBeenCalled();
  });

  test('rate_limited does not reset its own clock', async () => {
    const recent = new Date().toISOString();
    recordLastAttempt(db, {
      patientId: 'pat_rl',
      markId: 'cg_rl',
      attemptedAt: recent,
    });
    const before = getLastNudge(db, { patientId: 'pat_rl', markId: 'cg_rl' }).last_attempt_at;

    const out = await generateProgressKellyMessage(db, {
      patientId: 'pat_rl',
      markId: 'cg_rl',
      sessionId: 'sess_rl',
    });
    expect(out.prior_failure.reason).toBe('rate_limited');
    expect(runConsumerLlmStep).not.toHaveBeenCalled();

    const after = getLastNudge(db, { patientId: 'pat_rl', markId: 'cg_rl' }).last_attempt_at;
    expect(after).toBe(before);
  });

  test('outside window both calls generate normally', async () => {
    const old = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    recordLastAttempt(db, {
      patientId: 'pat_rl',
      markId: 'cg_rl',
      attemptedAt: old,
    });
    mockOkObservation();

    const first = await generateProgressKellyMessage(db, {
      patientId: 'pat_rl',
      markId: 'cg_rl',
      sessionId: 'sess_rl',
    });
    expect(first.client_action).toBe('render');
    expect(runConsumerLlmStep).toHaveBeenCalledTimes(1);

    // Keep outside rate window AND clear last type so repeat-nudge does not fire
    recordLastNudge(db, {
      patientId: 'pat_rl',
      markId: 'cg_rl',
      messageType: 'milestone',
      messageDate: new Date().toISOString().slice(0, 10),
      attemptedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    });
    runConsumerLlmStep.mockClear();
    mockOkObservation();

    const second = await generateProgressKellyMessage(db, {
      patientId: 'pat_rl',
      markId: 'cg_rl',
      sessionId: 'sess_rl',
    });
    expect(second.prior_failure?.reason).not.toBe('rate_limited');
    expect(second.client_action).toBe('render');
    expect(runConsumerLlmStep).toHaveBeenCalledTimes(1);
  });

  test('isWithinRateLimitWindow minute math', () => {
    expect(
      isWithinRateLimitWindow(
        { last_attempt_at: new Date(Date.now() - 2 * 60 * 1000).toISOString() },
        { intervalMinutes: 5 },
      ),
    ).toBe(true);
    expect(
      isWithinRateLimitWindow(
        { last_attempt_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
        { intervalMinutes: 5 },
      ),
    ).toBe(false);
  });

  test('client_action mapping: render / render_fallback / suppress', () => {
    expect(
      resolveClientAction({
        success: true,
        message: { message_type: 'prompt', body: 'x', day_reference: null, action: { label: 'None', type: 'none' } },
      }),
    ).toBe(CLIENT_ACTIONS.RENDER);

    expect(
      resolveClientAction(
        withFallback({ success: false, reason: 'guardrail_rejected', guardrail_pass: 'pass1' }),
      ),
    ).toBe(CLIENT_ACTIONS.RENDER_FALLBACK);

    expect(
      resolveClientAction(withFallback({ success: false, reason: 'rate_limited' })),
    ).toBe(CLIENT_ACTIONS.RENDER_FALLBACK);

    expect(
      resolveClientAction(withFallback({ success: false, reason: 'repeat_nudge_avoided' })),
    ).toBe(CLIENT_ACTIONS.SUPPRESS);

    const { buildNothingNewResult } = require('../services/progress-kelly-client-action');
    const nothing = buildNothingNewResult();
    expect(nothing.status).toBe('nothing_new');
    expect(nothing.message).toBeNull();
    expect(nothing.fallback).toBe(false);
    expect(nothing.client_action).toBe(CLIENT_ACTIONS.SUPPRESS);
    expect(nothing.prior_failure).toBeNull();
  });

  test('repeat_nudge_avoided returns nothing_new suppress (not render_fallback)', async () => {
    recordLastNudge(db, {
      patientId: 'pat_rl',
      markId: 'cg_rl',
      messageType: 'prompt',
      messageDate: new Date().toISOString().slice(0, 10),
      attemptedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    });
    runConsumerLlmStep.mockResolvedValue({
      success: true,
      content: JSON.stringify({
        message_type: 'prompt',
        body: 'Log a photo when the light matches Day 0.',
        day_reference: null,
        action: { label: 'Log photo', type: 'log_photo' },
      }),
      tools_used: [],
    });

    const out = await generateProgressKellyMessage(db, {
      patientId: 'pat_rl',
      markId: 'cg_rl',
      sessionId: 'sess_rl',
    });
    // Decision #29 / #35 — full shape, not only client_action
    expect(out.success).toBe(true);
    expect(out.status).toBe('nothing_new');
    expect(out.reason).toBe('repeat_nudge_avoided');
    expect(out.fallback).toBe(false);
    expect(out.message).toBeNull();
    expect(out.prior_failure).toBeNull();
    expect(out.client_action).toBe('suppress');
  });

  test('three distinct reason strings remain distinguishable', () => {
    const reasons = ['rate_limited', 'repeat_nudge_avoided', 'guardrail_rejected'];
    expect(new Set(reasons).size).toBe(3);
    expect(withFallback({ success: false, reason: 'rate_limited' }).prior_failure.reason).toBe(
      'rate_limited',
    );
    const { buildNothingNewResult } = require('../services/progress-kelly-client-action');
    expect(buildNothingNewResult().reason).toBe('repeat_nudge_avoided');
    expect(
      withFallback({ success: false, reason: 'guardrail_rejected' }).prior_failure.reason,
    ).toBe('guardrail_rejected');
  });

  test('feature_disabled does not write nudge/rate state (Decision #26)', async () => {
    delete process.env.FEATURE_PROGRESS_KELLY;
    const before = getLastNudge(db, { patientId: 'pat_rl', markId: 'cg_rl' });
    expect(before.last_attempt_at).toBeNull();

    const out = await generateProgressKellyMessage(db, {
      patientId: 'pat_rl',
      markId: 'cg_rl',
      sessionId: 'sess_rl',
    });
    expect(out.prior_failure.reason).toBe('feature_disabled');
    expect(out.client_action).toBe('render_fallback');
    expect(runConsumerLlmStep).not.toHaveBeenCalled();

    const after = getLastNudge(db, { patientId: 'pat_rl', markId: 'cg_rl' });
    expect(after.last_attempt_at).toBeNull();
    expect(after.last_message_type).toBeNull();
  });
});
