'use strict';

const LLMRouter = require('../llm-router');
const { getConsumerTools } = require('./consumer-tool-definitions');
const { getAllowedToolNames } = require('./consumer-tool-allowlists');
const { executeTool } = require('./consumer-tool-executor');

const MAX_ITERATIONS = parseInt(process.env.CONSUMER_RAILS_MAX_TOOL_ITERATIONS || '3', 10);

function filterTools(allTools, allowedNames) {
  const set = new Set(allowedNames);
  return allTools.filter((t) => set.has(t?.function?.name));
}

/**
 * Bounded LLM + tool loop for consumer insight / journey / progress graphs.
 */
async function runConsumerLlmStep({ graphKind, systemContent, userContent, ctx }) {
  const allowedNames = getAllowedToolNames(graphKind);
  const tools = filterTools(getConsumerTools(), allowedNames);
  const messages = [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent },
  ];
  const toolsUsed = [];

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    let response;
    try {
      response = await LLMRouter.call({
        messages,
        tools: tools.length ? tools : undefined,
        channel: 'chat',
        maxTokens: 400,
      });
    } catch (e) {
      return { success: false, error: e.message, tools_used: toolsUsed };
    }

    const msg = response?.choices?.[0]?.message;
    if (!msg) break;

    if (msg.tool_calls?.length) {
      messages.push(msg);
      for (const tc of msg.tool_calls) {
        const name = tc.function?.name;
        if (!name || !allowedNames.includes(name)) continue;
        let args = {};
        try {
          args = JSON.parse(tc.function.arguments || '{}');
        } catch (_) {}
        const result = await executeTool(name, args, ctx);
        toolsUsed.push(name);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result).slice(0, 4000),
        });
      }
      continue;
    }

    const content = String(msg.content || '').trim();
    if (content) {
      return { success: true, content, tools_used: toolsUsed, messages };
    }
    break;
  }

  return { success: false, error: 'empty_llm_response', tools_used: toolsUsed };
}

function parseJsonFromLlm(text) {
  const raw = String(text || '').trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1].trim() : raw;
  try {
    return JSON.parse(candidate);
  } catch (_) {
    return null;
  }
}

module.exports = { runConsumerLlmStep, parseJsonFromLlm, MAX_ITERATIONS };
