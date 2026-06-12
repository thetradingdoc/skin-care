'use strict';

jest.mock('../services/llm-router', () => ({
  call: jest.fn(),
}));

jest.mock('../services/consumer-rails/checkpointer', () => ({
  loadLangGraph: jest.fn(async () => null),
  getCheckpointer: jest.fn(async () => null),
}));

const LLMRouter = require('../services/llm-router');
const { parseJsonFromLlm } = require('../services/consumer-rails/node-runner');

describe('consumer-insight-graph llm', () => {
  test('parseJsonFromLlm extracts tool-loop final JSON', () => {
    LLMRouter.call.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: 'Retinol note',
              message: 'Space with BHA.',
              severity: 'caution',
            }),
          },
        },
      ],
    });
    const raw = JSON.stringify({
      title: 'Retinol note',
      message: 'Space with BHA.',
      severity: 'caution',
    });
    const parsed = parseJsonFromLlm(raw);
    expect(parsed.title).toBe('Retinol note');
    expect(parsed.severity).toBe('caution');
  });
});
