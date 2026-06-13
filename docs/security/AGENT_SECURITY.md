# Agent security

**Last updated:** 2026-06-12

## Kelly rails

Tool allowlists per lane: [`services/kelly-rails/tool-allowlists.js`](../../middleware-platform/services/kelly-rails/tool-allowlists.js).

Golden negative tests: [`scripts/e2e-kelly-rails-golden-conversations.cjs`](../../middleware-platform/scripts/e2e-kelly-rails-golden-conversations.cjs).

Env: `KELLY_MAX_TOOL_ITERATIONS` (default 6).

## Consumer rails

[`services/consumer-rails/consumer-tool-allowlists.js`](../../middleware-platform/services/consumer-rails/consumer-tool-allowlists.js) — `insight` vs `journey` graph tool sets.

Env: `CONSUMER_RAILS_MAX_TOOL_ITERATIONS` (default 3).

## Principles

- Agents call middleware tools, not raw DB
- Payment and scheduling tools forbidden in education lanes
- Prompt contracts forbid disallowed tool vocab per turn
