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
const { getDayCounts } = require('../services/progress-kelly-tools');
const {
  recordLastNudge,
  getLastNudge,
  isRepeatNudgeWithinWindow,
  REPEAT_NUDGE_WINDOW_DAYS,
} = require('../services/progress-kelly-nudge-state');
const { generateProgressKellyMessage } = require('../services/progress-kelly-graph');
const { framing, pending_product_signoff } = require('../services/progress-kelly-framing-note');
const factsRepo = require('../repositories/patient-record-facts-repo');

describe('snapshot-coach locked + repeat nudge (type+date only)', () => {
  let db;

  beforeEach(() => {
    process.env.FEATURE_PROGRESS_KELLY = '1';
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
      patient_id: 'pat_n',
      session_id: 'sess_n',
      tag: 'mark',
      ai_or_manual: 'manual',
      structured_json: { date: '2026-07-01', body_location: 'cheek', note: 'spot' },
      compare_group_id: 'cg_n',
      confirmed_at: '2026-07-01T12:00:00.000Z',
    });
    runConsumerLlmStep.mockReset();
  });

  afterEach(() => {
    db.close();
    delete process.env.FEATURE_PROGRESS_KELLY;
  });

  test('framing is locked snapshot-coach (not placeholder)', () => {
    expect(framing).toBe('snapshot_coach');
    expect(pending_product_signoff).toBe(false);
  });

  test('get_day_counts exposes last_message_type/date with no body field', () => {
    recordLastNudge(db, {
      patientId: 'pat_n',
      markId: 'cg_n',
      messageType: 'prompt',
      messageDate: '2026-07-18',
    });
    const counts = getDayCounts(db, {
      userId: 'pat_n',
      patientId: 'pat_n',
      markId: 'cg_n',
    });
    expect(counts.success).toBe(true);
    expect(counts.last_message_type).toBe('prompt');
    expect(counts.last_message_date).toBe('2026-07-18');
    expect(counts).not.toHaveProperty('last_message_body');
    expect(counts).not.toHaveProperty('body');

    const stored = getLastNudge(db, { patientId: 'pat_n', markId: 'cg_n' });
    expect(Object.keys(stored).sort()).toEqual([
      'last_attempt_at',
      'last_message_date',
      'last_message_type',
    ]);
  });

  test('nudge table never stores message body columns', () => {
    recordLastNudge(db, {
      patientId: 'pat_n',
      markId: 'cg_n',
      messageType: 'observation',
      messageDate: '2026-07-18',
    });
    const cols = db.prepare(`PRAGMA table_info(progress_kelly_nudge_state)`).all().map((c) => c.name);
    expect(cols).toEqual(
      expect.arrayContaining([
        'patient_id',
        'mark_id',
        'last_message_type',
        'last_message_date',
        'last_attempt_at',
      ]),
    );
    expect(cols).not.toContain('body');
    expect(cols).not.toContain('last_message_body');
    expect(cols).not.toContain('content');
  });

  test('within window same prompt type → fallback (no verbatim repeat)', async () => {
    recordLastNudge(db, {
      patientId: 'pat_n',
      markId: 'cg_n',
      messageType: 'prompt',
      messageDate: new Date().toISOString().slice(0, 10),
      // Outside rate-limit window so we exercise repeat-nudge, not rate_limited
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
      patientId: 'pat_n',
      markId: 'cg_n',
      sessionId: 'sess_n',
    });

    expect(out.status).toBe('nothing_new');
    expect(out.success).toBe(true);
    expect(out.reason).toBe('repeat_nudge_avoided');
    expect(out.client_action).toBe('suppress');
    expect(out.message).toBeNull();
    expect(out.fallback).toBe(false);
    expect(REPEAT_NUDGE_WINDOW_DAYS).toBe(3);
  });

  test('within window different message_type → allowed and recorded', async () => {
    recordLastNudge(db, {
      patientId: 'pat_n',
      markId: 'cg_n',
      messageType: 'prompt',
      messageDate: new Date().toISOString().slice(0, 10),
      attemptedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    });
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
      patientId: 'pat_n',
      markId: 'cg_n',
      sessionId: 'sess_n',
    });

    expect(out.fallback).toBeUndefined();
    expect(out.success).toBe(true);
    expect(out.message.message_type).toBe('observation');
    const nudge = getLastNudge(db, { patientId: 'pat_n', markId: 'cg_n' });
    expect(nudge.last_message_type).toBe('observation');
  });

  test('outside window same type → repetition allowed', () => {
    const last = {
      last_message_type: 'prompt',
      last_message_date: '2026-07-01',
    };
    expect(
      isRepeatNudgeWithinWindow(last, 'prompt', {
        todayIso: '2026-07-10',
        windowDays: 3,
      }),
    ).toBe(false);
  });

  test('outside window generation may repeat prompt type', async () => {
    const tenDaysAgo = new Date();
    tenDaysAgo.setUTCDate(tenDaysAgo.getUTCDate() - 10);
    recordLastNudge(db, {
      patientId: 'pat_n',
      markId: 'cg_n',
      messageType: 'prompt',
      messageDate: tenDaysAgo.toISOString().slice(0, 10),
      attemptedAt: tenDaysAgo.toISOString(),
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
      patientId: 'pat_n',
      markId: 'cg_n',
      sessionId: 'sess_n',
    });
    expect(out.fallback).toBeUndefined();
    expect(out.success).toBe(true);
    expect(out.message.message_type).toBe('prompt');
  });
});
