'use strict';

const { parseProgressKellyPayload } = require('../services/progress-kelly-schema');
const { parseJsonFromLlm } = require('../services/consumer-rails/node-runner');
const { getDayCounts } = require('../services/progress-kelly-tools');

describe('progress-kelly-schema (Step 2)', () => {
  test('accepts valid message', () => {
    const out = parseProgressKellyPayload({
      message_type: 'observation',
      body: 'You have 2 photos logged for this mark.',
      day_reference: 28,
      action: { label: 'Compare', type: 'compare' },
    });
    expect(out.success).toBe(true);
    expect(out.message.message_type).toBe('observation');
    expect(out.message.day_reference).toBe(28);
  });

  test('accepts null day_reference', () => {
    const out = parseProgressKellyPayload({
      message_type: 'prompt',
      body: 'Log a photo when the light matches your Day 0 shot.',
      day_reference: null,
      action: { label: 'Log photo', type: 'log_photo' },
    });
    expect(out.success).toBe(true);
    expect(out.message.day_reference).toBeNull();
  });

  test('rejects body over 160 chars', () => {
    const out = parseProgressKellyPayload({
      message_type: 'observation',
      body: 'x'.repeat(161),
      day_reference: null,
      action: { label: 'None', type: 'none' },
    });
    expect(out).toEqual(
      expect.objectContaining({ success: false, reason: 'schema_validation_failed' }),
    );
  });

  test('rejects action label over 20 chars', () => {
    const out = parseProgressKellyPayload({
      message_type: 'prompt',
      body: 'Take another photo.',
      day_reference: null,
      action: { label: 'This label is way too long', type: 'log_photo' },
    });
    expect(out.success).toBe(false);
    expect(out.reason).toBe('schema_validation_failed');
  });

  test('rejects unknown percentage key via .strict()', () => {
    const out = parseProgressKellyPayload({
      message_type: 'milestone',
      body: 'Day 28 checkpoint.',
      day_reference: 28,
      action: { label: 'Compare', type: 'compare' },
      improvement_pct: 40,
    });
    expect(out.success).toBe(false);
    expect(out.reason).toBe('schema_validation_failed');
  });

  test('rejects week_count key via .strict()', () => {
    const out = parseProgressKellyPayload({
      message_type: 'milestone',
      body: 'Week framing must fail.',
      day_reference: 28,
      action: { label: 'None', type: 'none' },
      week_count: 4,
    });
    expect(out.success).toBe(false);
  });

  test('rejects invalid message_type', () => {
    const out = parseProgressKellyPayload({
      message_type: 'diagnosis',
      body: 'Nope.',
      day_reference: null,
      action: { label: 'None', type: 'none' },
    });
    expect(out.success).toBe(false);
  });

  test('parseJsonFromLlm + schema: fenced JSON works', () => {
    const raw = parseJsonFromLlm(`\`\`\`json
{"message_type":"observation","body":"Two photos logged.","day_reference":null,"action":{"label":"None","type":"none"}}
\`\`\``);
    const out = parseProgressKellyPayload(raw);
    expect(out.success).toBe(true);
  });

  test('parseJsonFromLlm null → schema_validation_failed path', () => {
    const raw = parseJsonFromLlm('not json at all — Kelly said something prose');
    expect(raw).toBeNull();
    const out = parseProgressKellyPayload(raw);
    expect(out.success).toBe(false);
    expect(out.reason).toBe('schema_validation_failed');
  });
});

describe('progress-kelly-tools day_span removed', () => {
  test('getDayCounts return shape has no day_span', () => {
    // Shape check via a fake failure path still shouldn't invent day_span;
    // success path is covered by marks-compare — assert keys on a constructed success object
    // by reading source contract: only fact_count + distinct_day_count besides mark_id.
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../services/progress-kelly-tools.js'),
      'utf8',
    );
    expect(src).not.toMatch(/day_span/);
    expect(typeof getDayCounts).toBe('function');
  });
});
