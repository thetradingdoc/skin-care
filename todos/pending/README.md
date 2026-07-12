# Pending todo lists

**Last updated:** July 12, 2026  
**Start here** for active work. Completed checklists live in [`../archive/`](../archive/README.md).

**Soft-launch SSOT:** [`MYSKINANDCARE_SOFT_LAUNCH_MASTER_CHECKLIST.md`](MYSKINANDCARE_SOFT_LAUNCH_MASTER_CHECKLIST.md) — **171** individual todos (166 pending, 5 done). Cursor plan: `pr1_soft-launch_safety_2208da17`.  
**Brand SSOT:** [`MYSKINANDCARE_BRAND_CONSISTENCY.md`](MYSKINANDCARE_BRAND_CONSISTENCY.md) — 6 rules + touchpoint map.

---

## Tier 1 — Active product / engineering

| File | Focus |
|------|--------|
| [`MYSKINANDCARE_SOFT_LAUNCH_MASTER_CHECKLIST.md`](MYSKINANDCARE_SOFT_LAUNCH_MASTER_CHECKLIST.md) | **SSOT master** — **171** one-by-one todos (OPS→PR1→UX→brand rules→TF→PR2→PR3→users) |
| [`MYSKINANDCARE_BRAND_CONSISTENCY.md`](MYSKINANDCARE_BRAND_CONSISTENCY.md) | **Brand architecture** — 6 rules + touchpoint map (myskinandcare ↔ touche labs™) |
| [`MYSKINANDCARE_PR1_AND_UI_EXECUTION.md`](MYSKINANDCARE_PR1_AND_UI_EXECUTION.md) | PR1a/PR1b detail notes — defer to master checklist for status |
| [`MYSKINANDCARE_UI_UX_AUDIT.md`](MYSKINANDCARE_UI_UX_AUDIT.md) | **Playwright + visual UI/UX audit** — live host 404, Home/Progress/Track findings, proof/touche gaps, task checklist + screenshots |
| [`MYSKINANDCARE_CODEBASE_AUDIT.md`](MYSKINANDCARE_CODEBASE_AUDIT.md) | **Critical analysis** — file findings, CRITICAL/HIGH gaps, concern→serum matrix, 10 human questions, first 3 PRs |
| [`MYSKINANDCARE_CODEBASE_FILE_MAP.md`](MYSKINANDCARE_CODEBASE_FILE_MAP.md) | **As-is file map** — every patient-app source file + consumer middleware + landing/inference; platform folders summarized |
| [`MYSKINANDCARE_TOUCHELABS_SOFT_LAUNCH_TODOS.md`](MYSKINANDCARE_TOUCHELABS_SOFT_LAUNCH_TODOS.md) | **SSOT soft launch** — Shopify catalog (live GIDs), iOS TestFlight, serum→routine, face-check later, Body recs, agent/library |
| [`IOS_SKINCARE_TRACKER_LAUNCH_TODOS.md`](IOS_SKINCARE_TRACKER_LAUNCH_TODOS.md) | Skin & Care iOS TestFlight — auth, tracking, care_program subscription |
| [`SKIN_AGE_JOURNEY_E2E_TODOS.md`](SKIN_AGE_JOURNEY_E2E_TODOS.md) | Web funnel → sign-in → Today/Progress; face scan (**fix after iOS** per soft-launch plan) |
| [`PROVIDER_UI_RCM_IMPROVEMENT_TODOS.md`](PROVIDER_UI_RCM_IMPROVEMENT_TODOS.md) | Provider visibility — Kelly feed, roster chips, nav, collection resend (**completed**) |
| [`REVENUE_HUB_REDESIGN_TODOS.md`](REVENUE_HUB_REDESIGN_TODOS.md) | Revenue hub — 4-tab shell, UI audit fixes, legacy redirects (**completed**) |
| [`KELLY_CONVERSATION_RAILS_TODOS.md`](KELLY_CONVERSATION_RAILS_TODOS.md) | Short backlog — **SSOT:** [`docs/architecture/KELLY_AGENTIC_RAILS_TARGET_AND_BUILD_PLAN.md`](../../docs/architecture/KELLY_AGENTIC_RAILS_TARGET_AND_BUILD_PLAN.md) |
| [`KELLY_RCM_PIPELINE_TODOS.md`](KELLY_RCM_PIPELINE_TODOS.md) | Kelly identity + RCM backbone + financial rails (TODO-01–24) |
| [`AGENTIC_CHECKOUT_UI_AND_BACKEND_TODOS.md`](AGENTIC_CHECKOUT_UI_AND_BACKEND_TODOS.md) | Open checkout debt (#2, #4–#7, #9–#10, #12) |
| [`Step10-LangChain-LangGraph-LangSmith-todos.md`](Step10-LangChain-LangGraph-LangSmith-todos.md) | Step 10 LangGraph + guardrails (blocked on checkout payment-rail prereqs) |
| [`DERM_PATIENT_QA_REDDIT_PIPELINE_TODOS.md`](DERM_PATIENT_QA_REDDIT_PIPELINE_TODOS.md) | Derm Q&A UI (Phase 8), eval/CI (Phase 6), ops (Phase 7) |
| [`CODE_REVIEW_REFACTOR_TODOS.md`](CODE_REVIEW_REFACTOR_TODOS.md) | **Done (2026-06-10)** — patient repo, server bootstrap, journal split, Vitest, docs |

---

## Tier 2 — Production / infra / compliance

| File | Focus |
|------|--------|
| [`PRODUCTION_READINESS_TASKS.md`](PRODUCTION_READINESS_TASKS.md) | Azure, HIPAA, deploy, monitoring evergreen checklist |
| [`TELEMEDICINE_TODOS.md`](TELEMEDICINE_TODOS.md) | Video consult completion, JWT, case-report pipeline |
| [`CLEAN_PUSH_GCP_TODOS.md`](CLEAN_PUSH_GCP_TODOS.md) | Post-commit deploy + smoke + rollback (5 items open) |
| [`PAYOR_ENTITY_RESOLUTION_TODOS.md`](PAYOR_ENTITY_RESOLUTION_TODOS.md) | Vendor exports, review UI, canonical resolver rollout |

---

## Tier 3 — Small ongoing / launch hygiene

| File | Focus |
|------|--------|
| [`Orchestration-todos.md`](Orchestration-todos.md) | Transcript replay QA, landing↔checkout E2E parity, security checklist refresh |
| [`SOMO_DEMO_LAUNCH_CHECKLIST.md`](SOMO_DEMO_LAUNCH_CHECKLIST.md) | Human/ops P0 before first Somo demo call (code complete) |
| [`LANDING_NAVIGATOR_REGRESSION_TODOS.md`](LANDING_NAVIGATOR_REGRESSION_TODOS.md) | ZIP race/scope regression tests (UI otherwise done) |
| [`PHOTO_TO_BILL_EXTRACTION_TODOS.md`](PHOTO_TO_BILL_EXTRACTION_TODOS.md) | Key rotation + Phase 5 rollout only |

---

## Archived from pending (May 31, 2026)

| Was pending | Now |
|-------------|-----|
| Voice billing, provider trial SIM, journal V1 | [`../archive/VOICE_BILLING_*`](../archive/VOICE_BILLING_SUBSCRIPTION_TODOS_COMPLETED_2026-05-31.md), [`PROVIDER_TRIAL_SIM_*`](../archive/PROVIDER_TRIAL_SIM_TODOS_COMPLETED_2026-05-31.md), [`PATIENT_APP_JOURNAL_*`](../archive/PATIENT_APP_JOURNAL_REDESIGN_V1_COMPLETED_2026-05-31.md) |
| Kelly golden path (Sprints 0–3) | [`../archive/KELLY_CONVERSATION_RAILS_GOLDEN_PATH_COMPLETED_2026-05-31.md`](../archive/KELLY_CONVERSATION_RAILS_GOLDEN_PATH_COMPLETED_2026-05-31.md) |
| Agentic reasoning (unified pipeline) | [`../archive/AGENTIC_REASONING_TODOS_COMPLETED_2026-05-31.md`](../archive/AGENTIC_REASONING_TODOS_COMPLETED_2026-05-31.md) |
| Landing navigator UI (Batches 1–14) | [`../archive/LANDING_NAVIGATOR_UI_UX_TODOS_COMPLETED_2026-05-31.md`](../archive/LANDING_NAVIGATOR_UI_UX_TODOS_COMPLETED_2026-05-31.md) |
| Somo demo agent (code) | [`../archive/DODGECALL_DEMO_AGENT_TODOS_COMPLETED_2026-05-31.md`](../archive/DODGECALL_DEMO_AGENT_TODOS_COMPLETED_2026-05-31.md) |
| Derm Q&A backend (Phases 0–5) | [`../archive/DERM_PATIENT_QA_BACKEND_COMPLETED_2026-05-31.md`](../archive/DERM_PATIENT_QA_BACKEND_COMPLETED_2026-05-31.md) |

---

## Notes

- Do not add VS Code `.code-workspace` files under `todos/`.
- For doc overlap, see [`docs/meta/CANONICAL_DOC_MAP.md`](../../docs/meta/CANONICAL_DOC_MAP.md).
