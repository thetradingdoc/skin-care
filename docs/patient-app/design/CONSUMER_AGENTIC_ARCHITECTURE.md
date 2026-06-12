# Consumer Agentic Architecture

**Last reviewed:** 2026-06-12

Runtime flags and graph layout for myskinandcare consumer v3 (Phases 2–4).

**Prod verification:** `node middleware-platform/scripts/verify-prod-consumer-env.cjs` — see also [CONFLICT_ENGINE.md](../../runbooks/CONFLICT_ENGINE.md).

## Environment flags

| Flag | Default | Effect |
|------|---------|--------|
| `LANGGRAPH_CONSUMER_EVAL_ROLLOUT_PCT` | `0` | `1` = evaluate via 5-node analysis graph |
| `FEATURE_V3_INSIGHTS` | `0` | Gates `GET /shelf/products/:id/insight` |
| `FEATURE_V3_INSIGHTS_LLM` | `0` | `1` = LLM tool loop for insight composition |
| `NEXT_GEN_PIPELINE` | `0` | `1` = journey agent for `GET /home/next-actions` |
| `LANGGRAPH_USE_POSTGRES` | off | PostgresSaver when `POSTGRES_URL` set |
| `CONSUMER_RAILS_MAX_TOOL_ITERATIONS` | `3` | LLM tool loop cap |

## Phase 2 — Analysis graph (deterministic)

`middleware-platform/services/consumer-analysis-graph.js`

```
load_consumer_context → resolve_lineup_slots → ingredient_conflict_node
  → barrier_metrics_node → format_evaluate_response
```

- Redis cache: `consumer:eval:{owner}:{lineup_hash}` (900s)
- Fallback: `runEvaluatePipelineSync` on graph failure

## Phase 3 — Insight composer (LLM + tools)

`middleware-platform/services/consumer-insight-graph.js`

```
attach_guidance → compose_insight_llm → format_insight
```

Tools: `get_product_details`, `evaluate_lineup`, `get_routine_phase`, `get_bio_profile`, `get_barrier_insight`, `retrieve_ingredient_monographs`

Fallback: `computeProductInsight` when LLM disabled or fails.

## Phase 4 — Journey agent (LLM + tools)

`middleware-platform/services/consumer-journey-agent.js`

```
analyze_goals → anticipate_needs_llm → format_next_actions
```

- Goals table: `patient_goals` (watch_spot, improve_routine, reduce_conflicts)
- API: `GET /api/patient/home/next-actions`
- UI: `NextActionCard` on Home tab
- Fallback: `ruleBasedActions` when `NEXT_GEN_PIPELINE=0` or LLM fails

## Shared tooling

`middleware-platform/services/consumer-rails/`

- `checkpointer.js` — PostgresSaver / MemorySaver
- `consumer-tool-executor.js` — tool implementations
- `node-runner.js` — bounded LLM + tool loop via `LLMRouter`

## Deploy checklist

1. Set Secret Manager / Cloud Run env: all four consumer flags, `REDIS_URL`, optional `POSTGRES_URL` + `LANGGRAPH_USE_POSTGRES=true`.
2. Run migrations `057_patient_goals` (SQLite) and `0003_patient_goals.sql` (Postgres).
3. Deploy middleware to **staging** with flags `=1`; run `npm run test:e2e:live-journey` against staging/local API.
4. Deploy patient-app static hosting (`npm run dev:consumer-local` build pipeline).
5. Flip **production** flags explicitly when ready (generator defaults prod to `0`).

## Redis

`REDIS_URL` is optional but recommended in production. Without Redis, eval/insight caches miss every request (higher latency and LLM cost). Cache misses log `[consumer-analysis-graph] cache_miss` when `REDIS_URL` is set.

## Re-run tests

```bash
cd middleware-platform
npm run test:consumer-prod-ready
```
