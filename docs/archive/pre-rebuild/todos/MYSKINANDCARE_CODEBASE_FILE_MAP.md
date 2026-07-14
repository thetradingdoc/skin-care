# myskinandcare codebase — file map (as-is)

**Last updated:** 2026-07-12  
**Purpose:** Describe what exists in the repo and what each area does **today**, not the roadmap.  
**Companion:** [`MYSKINANDCARE_CODEBASE_AUDIT.md`](MYSKINANDCARE_CODEBASE_AUDIT.md) (gaps/bugs), [`MYSKINANDCARE_TOUCHELABS_SOFT_LAUNCH_TODOS.md`](MYSKINANDCARE_TOUCHELABS_SOFT_LAUNCH_TODOS.md) (launch tasks).

> The repo is a **shared Somo + Skin & Care monorepo** (~2k files). This map is complete for **consumer journal surfaces** (`patient-app`, landing, consumer routes/services). Non-consumer areas (Kelly voice, RCM, provider portal, Stedi) are summarized by folder so you know what they are without listing every file.

---

## 0. How the pieces connect (as-is)

```
myskinandcare.com          patient-app (Expo iOS)
 (skin-care-landing)  --->  OTP / deep link handoff
         |                         |
         v                         v
   api.callsomo.com / api.myskinandcare.com
         middleware-platform (Express, Cloud Run)
         |           |            |
         v           v            v
   SQLite(+PG)   Azure/local     face-read-inference
   routines      media upload    (inference/face-read)
   journal       spots           optional GPT vision
   shelf/conflict
```

**Not wired today:** Shopify/trytouche.com (store exists; no product IDs in this codebase).  
**Separate product surface:** Twilio/Retell/Kelly voice + provider RCM (same middleware, not journal primary path).

---

## 1. Repository top level

| Path | Role as-is |
|------|------------|
| [`patient-app/`](#2-patient-app-expo-ios) | Consumer iOS/web Expo app (`com.skinandcare.app`) |
| [`middleware-platform/`](#3-middleware-platform) | Monolithic Express API + SQLite/Postgres + services |
| [`unified-dashboard/`](#4-unified-dashboard) | Static portals + **skin-care-landing** Vite SPA |
| [`inference/face-read/`](#5-inferenceface-read) | FastAPI face-age / face-read microservice |
| [`Knowledge/`](#6-knowledge) | ICD/CPT/HCPCS, RAG export, derm rules, eval datasets |
| [`docs/`](#7-docs) | Runbooks, brand, journey, patient-app design |
| [`todos/`](#8-todos) | Pending/archive task lists |
| [`scripts/`](#9-root-scripts) | Brand, hosting, deploy, smoke orchestration |
| [`livekit-agents/`](#10-other-packages) | Python LiveKit experiments |
| [`case-report-service/`](#10-other-packages) | Telemedicine case-report RAG service |
| [`medical-rag-api/`](#10-other-packages) | Optional RAG API helpers |
| [`infra/`](#10-other-packages) | Legacy Azure bicep + edge routing |
| [`config/`](#10-other-packages) | Shared config snippets |
| [`contracts/`](#10-other-packages) | API/contract fragments |
| [`assets/`](#10-other-packages) | Shared icons |
| [`local/`](#10-other-packages) | Local credential templates (gitignored patterns) |
| [`ARCHITECTURE.md`](../../ARCHITECTURE.md) | High-level architecture report |
| [`README.md`](../../README.md) | Entry + quick start |
| [`package.json`](../../package.json) | Root npm scripts (no workspaces field; orchestrates subpackages) |
| `.github/workflows/` | CI: mobile typecheck/EAS, staging deploy, etc. |
| `.cursor/rules/` | Cursor brand/code rules |

---

## 2. `patient-app/` — Expo iOS (full source map)

**Stack:** Expo ~54, React Native, expo-router, SWR (rarely), Vitest.  
**Config:** [`app.json`](../../patient-app/app.json) bundle `com.skinandcare.app`; [`eas.json`](../../patient-app/eas.json) profiles `development` / `preview` / `testflight` / `production`; [`config.ts`](../../patient-app/config.ts) resolves `EXPO_PUBLIC_API_BASE_URL` (default `https://api.callsomo.com`).

### 2.1 Screens — `app/`

| File | What it does today |
|------|-------------------|
| `app/index.tsx` | Cold start: spinner → `resolveInitialRoute()` → replace |
| `app/_layout.tsx` | Root Stack, fonts, deep links (`auth` ticket, subscription success/cancel, `routine/setup`), session-expiry → sign-in; registers legacy capture modals + checkout-chat |
| `app/+html.tsx` | Web HTML shell for Expo web |
| `app/sign-in.tsx` | Email OTP send/confirm; new users CTA to web signup URL; finishes with `resolvePostAuthRoute` |
| `app/(tabs)/_layout.tsx` | Tab bar: Home, Track, Scan, Progress, Profile; **hides** timeline/money/shelf/_journal/today |
| `app/(tabs)/home.tsx` | Main Today: routine BFI/steps/photo **or** journal-first chips/photo; loads template/daily/phase/progress/calendar |
| `app/(tabs)/track.tsx` | Spot ATM hub — list spots, start capture |
| `app/(tabs)/scan.tsx` | Barcode + shelf products → verdict |
| `app/(tabs)/progress.tsx` | Streak, BFI grid, improvements, photo timeline, spots |
| `app/(tabs)/account.tsx` | Profile, journey toggles, care_program Stripe subscribe |
| `app/(tabs)/today.tsx` | **Redirect** → home (legacy) |
| `app/(tabs)/timeline.tsx` | **Redirect** → progress |
| `app/(tabs)/money.tsx` | **Redirect** → progress |
| `app/(tabs)/shelf.tsx` | Re-exports / aliases scan |
| `app/(tabs)/_journal.tsx` | Hidden legacy journal UI |
| `app/onboarding/_layout.tsx` | Onboarding stack |
| `app/onboarding/journey-choose.tsx` | Pick watch/routine/spot (default watch); save profile; route |
| `app/onboarding/scan.tsx` | Native face-read (off default cold path; funnel/deeplink) |
| `app/onboarding/reveal.tsx` | Show face-read results |
| `app/onboarding/concerns.tsx` | Concern pick (funnel bridge) |
| `app/onboarding/signup.tsx` | Funnel signup bridge |
| `app/onboarding/bio-calibration.tsx` | Conditions + prescriptions for better verdicts |
| `app/routine/_layout.tsx` | Routine stack |
| `app/routine/pick.tsx` | Choose concern → POST template |
| `app/routine/setup.tsx` | Redirects to pick (deeplink concern) |
| `app/routine/capture.tsx` | Progress photo camera/library → upload → celebrate Home |
| `app/journal/capture.tsx` | Diary photo + tags → `postJournalDailyPhoto` |
| `app/track/_layout.tsx` | Track stack |
| `app/track/capture.tsx` | Spot photo + body map |
| `app/track/[spotId].tsx` | Spot timeline / snapshots |
| `app/verdict/_layout.tsx` | Verdict stack |
| `app/verdict/[productId].tsx` | Product conflict detail |
| `app/compare.tsx` | Side-by-side photo days |
| `app/checkout-chat.tsx` | Legacy Kelly commerce chat modal |
| `app/scan-entry.tsx` | Legacy quick capture entry |
| `app/capture-*.tsx` | Legacy billing/EOB capture modals → mostly redirects |

### 2.2 Components — `components/`

| Path | Role |
|------|------|
| `BrandWordmark.tsx` | Skin & Care wordmark |
| `OtpForm.tsx` | Email + 6-digit OTP UI |
| `SessionImage.tsx` | Authenticated image fetch for media URLs |
| `PhotoAlignPreview.tsx` / `PhotoGhostOverlay.tsx` | Align new photo vs prior |
| `RoutineStepsHero.tsx` | Older steps hero (partially superseded by Home rows) |
| `SafeHarborRing.tsx` | Legacy score ring |
| `CheckoutHeroicons.tsx` | Checkout chat icons |
| `billing-ui.tsx` / `billing-feedback.tsx` | Buttons, toasts, offline banner |
| `haptic-tab.tsx` | Tab press haptics |
| `external-link.tsx` | Open external URLs |
| `themed-text.tsx` / `themed-view.tsx` / `parallax-scroll-view.tsx` | Expo template leftovers |
| **`conflict/`** | BFI ring/grid, ConflictCard, barcode scanner (native+web), RoutineStepRow, ShelfProductRow, verdict cards, SpacingTimer, GraphUnavailableBanner, ImprovementBar |
| **`journal/`** | Home blocks (log CTA, chips, note, trigger card), recent photos, calendar/list/photos/documents tabs, styles/types |
| **`progress/`** | PhotoStreakHero, SkinMetricSparkCards |
| **`v3/`** | JourneyModeCard, DailyPhotoCta, AtmActionButton, BodyMapPicker, Spot*, GoalsCard, NextActionCard, MetricChipRow, EmptyStateCard, PrimaryFab, SectionLabel, DoctorAlertCard, GrowthSummaryCard |
| **`ui/`** | AppFontsProvider (Gloock+DM Sans), AppIcon, icon-symbol, collapsible |

### 2.3 Lib — `lib/` (client logic)

| File | Role as-is |
|------|------------|
| `patient-api.ts` | Authenticated GET/POST/PATCH/upload to middleware |
| `patient-auth.ts` | Auth error helpers, session-expired handler registry |
| `patient-session.ts` | SecureStore/local session id + email |
| `local-persist.ts` | Web/native key-value persist helper |
| `resolve-post-auth-route.ts` | Post-login routing brain (journey/template/bio/shelf) |
| `journey-mode-storage.ts` | Local journey modes + PATCH consumer profile |
| `routine-capture.ts` | Ensure daily entry + upload progress photo |
| `routine-capture-overlay.ts` | Prior photo URL for ghost overlay |
| `routine-day-mode.ts` | today / backfill / historical + allows_photo |
| `routine-copy.ts` | Celebrate / title strings |
| `routine-steps-display.ts` | Group AM/PM steps + conflict states |
| `routine-compare.ts` | Compare two days’ media |
| `routine-session.ts` | Routine session helpers |
| `journal-api.ts` | Journal photo, check-in, timeline, triggers, improvements |
| `pending-capture-uri.ts` | Library URI handoff (web persist; native memory) |
| `upload-uri.ts` | RN FormData / web Blob for multipart |
| `face-read-api.ts` | `POST /api/public/face-read` |
| `onboarding-storage.ts` | Face-read payload, first-photo flags |
| `onboarding-complete.ts` | Mark onboarding done |
| `skin-age-journey.ts` | Web funnel → app bridge (journey modes from segment) |
| `funnel-segment.ts` | Segment helpers |
| `revealHelpers.ts` / `computeSkinAge.ts` / `computeHealthScores.ts` | Reveal math/copy |
| `conflict-api.ts` | Evaluate lineup, bio, verdict history, next actions, barrier insight |
| `conflict-helpers.ts` / `conflict-types.ts` | Colors, types |
| `spot-store.ts` | Spots CRUD + offline pending queue + migrate |
| `consumer-profile-api.ts` | GET/PATCH consumer profile |
| `goals-api.ts` | Patient goals |
| `consumer-billing.ts` | care_program checkout helpers |
| `billing-capture.ts` | Legacy billing capture APIs |
| `checkoutCatalogHelpers.ts` / `checkoutAnalytics.ts` | Legacy checkout chat catalog |
| `trackPortalEvent.ts` / `trackFunnelEvent.ts` | Analytics events |
| `tulip-path.js` | Path helper remnant |
| `lib/__tests__/*` | Vitest unit tests for session, upload, conflict, onboarding, spots |

### 2.4 Hooks / constants / scripts

| Path | Role |
|------|------|
| `hooks/useOnboardingGate.ts` | `resolveInitialRoute` + re-exports post-auth |
| `hooks/useRequirePatientSession.ts` | Gate protected screens |
| `hooks/useUnifiedLedger.ts` | SWR billing ledger (legacy money) |
| `hooks/use-color-scheme*.ts` / `use-theme-color.ts` | Theme leftovers |
| `constants/routes.ts` | Typed Hrefs + landing URLs + deprecated capture routes |
| `constants/appTokens.ts` / `journalTokens.ts` / `conflictTokens.ts` / `timelineTokens.ts` / `skinCareTokens.ts` / `theme.ts` / `navigationTheme.ts` / `fontFamilies.ts` | Design tokens |
| `constants/billingV1.ts` / `billingTheme.ts` / `brandCopy.ts` / `routineSession.ts` | Billing/copy constants |
| `scripts/verify-testflight-prereqs.cjs` / `testflight-doctor.cjs` / `run-*-asc.cjs` / `smoke-face-read.cjs` / `verify-expo-device.cjs` | TestFlight + device ops |
| `scripts/device-smoke-checklist.md` | Manual smoke steps |
| `package.json` | `typecheck`, `test`, `build:testflight`, `verify:testflight` |

---

## 3. `middleware-platform/` — API (as-is)

**Entry:** `server.js` (large Express boot).  
**DB:** `database.js` (SQLite schema/migrations inline) + optional Postgres (`db/`).  
**Route registration:** `bootstrap/register-api-routes.js`, `bootstrap/register-patient-routes.js`, `bootstrap/build-patient-route-deps.js`, `bootstrap/static-hosting.js`.

### 3.1 Consumer / journal routes (what the app hits)

| Route file | What it does today |
|------------|-------------------|
| `routes/patient-auth.js` | OTP send/confirm, handoff ticket create/exchange |
| `routes/patient-routine.js` | Template, daily, phase, **photo upload**, progress-summary, calendar-range (journal merge), compare helpers |
| `routes/patient-journal.js` | Standalone journal photo/check-in/timeline/triggers/improvements — **gated** by `JOURNAL_MODE_STANDALONE` |
| `routes/patient-spots.js` | Spot CRUD + snapshot upload |
| `routes/patient-shelf.js` | Shelf products list/add |
| `routes/patient-bio-profile.js` | Conditions/prescriptions |
| `routes/patient-consumer-profile.js` | Journey modes, bio_calibration_complete, etc. |
| `routes/patient-goals.js` | Goals |
| `routes/patient-funnel-bridge.js` | After funnel verify: write match/context |
| `routes/patient-checkout-chat.js` | Kelly checkout chat turns |
| `routes/patient-billing-portal.js` | Billing portal + care_program checkout mount points |
| `routes/public-face-read.js` | Public multipart face-read → inference + optional vision merge |
| `routes/public-routines.js` | List/preview concern programs |
| `routes/public-routine-evaluate.js` | Anonymous evaluate (rate-limited) |
| `routes/public-funnel-*.js` | Match, specialists, journey, intake |
| `routes/public-product-scan.js` | Public barcode/product scan |
| `routes/skinrag-routines.js` | Optional SkinRAG routine overlay |
| `routes/stripe-webhook-handler.js` | Stripe events including care_program activation |

Other `routes/patient-*.js` (documents, wallet, insurance, booking, RCM, products, upload-link, profile) serve **portal / telemedicine / billing** continuity — not the v3 journal tab bar.

### 3.2 Other route groups (summary)

| Prefix / area | Files (examples) | Role |
|---------------|------------------|------|
| Voice / Kelly | `kelly.js`, `voice*.js`, `retell-functions.js`, `livekit.js` | Clinic voice agent |
| RCM / Stedi | `rcm.js`, `rcm-public.js`, `stedi-webhooks.js`, `prior-auth.js` | Claims / eligibility |
| Provider / admin | `providers.js`, `admin*.js`, `invoices*.js` | Provider portal APIs |
| Commerce | `public-checkout*.js`, `merchant.js`, `orders.js`, `products.js` | Merchant catalog checkout (not Shopify) |
| Customer | `customer-*.js` | Customer account / wallet / catalog |
| Health / ops | `health.js`, `usage*.js`, `internal-service-ops.js` | Liveness, usage |
| FHIR / clinical | `fhir.js`, `case-report.js`, `diagnostic-report.js` | Clinical integrations |
| RAG | `rag-proxy.js`, `rag-search.js` | Medical RAG proxy |

~109 route modules total under `routes/`.

### 3.3 Consumer-relevant `lib/`

| File | Role |
|------|------|
| `lib/routine-photo-day.js` | One photo → all steps complete, skin_report JSON |
| `lib/routine-day-mode.js` | today/backfill/historical windows |
| `lib/patient-routine-db.js` | Routine table helpers |
| `lib/patient-journal-db.js` | Journal table ensure |
| `lib/journal-condition-tags.js` | Tag labels |
| `lib/journal-timeline-merge.js` | Merge routine + journal calendar |
| `lib/routine-calendar-enrich.js` | Calendar enrichment |
| `lib/routine-compare-helper.js` | Compare days |
| `lib/routine-layering-check.js` | Layering warnings |
| `lib/patient-shelf-api.js` | Shelf helpers |
| `lib/lineup-hash.js` | Lineup identity |
| `lib/skin-care-email-layout.js` | Consumer email chrome |
| `lib/funnel-analytics.js` | Funnel events |
| `lib/portal-analytics-events.js` / `patient-portal-events.js` | Portal analytics |
| `lib/static-hosting-paths.js` | Which static bundles to serve |
| `lib/gcs`-related via services | See storage below |

### 3.4 Consumer-relevant `services/` (of ~336)

| Service | Role as-is |
|---------|------------|
| `concern-routine-service.js` | Load `routines/concern-routines.json`, phases, labels |
| `skinrag-routine-service.js` | Optional SkinRAG overlay when flagged |
| `gcs-billing-storage.js` | **uploadBuffer** — Azure Blob if configured, else `local://` |
| `blob-storage.js` | Azure helpers |
| `face-read-vision.js` / `face-read-merge.js` | GPT vision + merge with CV |
| `skin-age-readings.js` | Persist weekly / funnel ages |
| `spot-snapshot-service.js` | Heuristic same/watch/alert tags (**not CV**) |
| `patient-routine-evaluate-service.js` | Lineup snapshot save |
| `consumer-analysis-graph.js` / `consumer-evaluate-nodes.js` | Conflict evaluate graph |
| `consumer-insight-*.js` | Insight graphs/schemas |
| `consumer-rails/` | Tooling for consumer agent turns (shelf/profile/RAG chunks) |
| `ingredient-*.js` / `skin-conflict-resolver.js` | Ingredient ontology, conflicts, RAG chunks (SQLite FTS) |
| `barrier-insight-service.js` / `barrier-load-calculator.js` | Progress “what caused the dip” |
| `journal-trigger-insights.js` / `journal-improvements.js` | Diary insights APIs |
| `care-program-billing-service.js` | Stripe care_program checkout + activate |
| `patient-bio-profile-service.js` | Bio profile |
| `antivirus-service.js` | Scan uploads (face-read path) |
| `pinecone-rest.js` + layer2 RAG | Medical coding vectors — **not** product recs |

Hundreds of remaining services implement Kelly rails, coding, Stedi, commerce, email, LiveKit, etc.

### 3.5 Data / repos / routines

| Path | Role |
|------|------|
| `routines/concern-routines.json` | **SSOT** for 6 concern programs (acne, anti_aging, hyperpigmentation, hyperpigmentation_dark_skin, barrier_repair, rosacea) |
| `repositories/spot-repo.js` | Spot persistence |
| `repositories/patient-journal-repo.js` | Journal upsert |
| `repositories/consumer-profile-repo.js` | Consumer profile |
| `repositories/patient-goals-repo.js` | Goals |
| `repositories/routine-postgres-repo.js` | Optional PG routine storage |
| `data/` | Static configs / SkinRAG JSON when present |
| `migrations/` | Numbered SQL migrations (incl. journal tables) |
| `database/` | Billing table helpers etc. |
| `middleware/` | Auth, rate limit, patient session, tenant |
| `taxonomy/` | Product category routing JSON |
| `__tests__/` / `e2e/` | Jest + Playwright |

---

## 4. `unified-dashboard/`

| Path | Role as-is |
|------|------------|
| **`skin-care-landing/`** | Consumer marketing + funnel SPA (Vite/React) hosted as myskinandcare.com |
| `skin-care-landing/src/pages/LandingPage.jsx` | Hero “#1 Skincare Journal” |
| `.../ScanPage.jsx` | Camera/upload → face-read (MediaPipe gate) |
| `.../QuickCheckPage.jsx` | Feel / habit / trigger questions |
| `.../RevealPage.jsx` | Findings + CTA branch |
| `.../ConcernsPage.jsx` | Concern pick for routine-ready |
| `.../ForPage.jsx` | Persona landing pages |
| `.../lib/faceReadApi.js` | Public face-read client |
| `.../lib/useFaceGuide.js` | Live MediaPipe face guide |
| `.../lib/faceDetectUpload.js` | Upload face gate |
| `.../lib/skinAgeStorage.js` | sessionStorage keys |
| `.../lib/funnelSegment.js` | Segment → journey modes |
| `.../content/landingContent.js` | Copy SSOT for landing |
| `patients/` | Legacy patient HTML portals |
| `business/` | Provider portal HTML |
| `admin/` | Admin CRM HTML |
| `assets/` | Brand CSS/JS, panda logo, fonts |
| `firebase*.json` | Hosting configs (callsomo vs myskinandcare) |

---

## 5. `inference/face-read/`

| Path | Role |
|------|------|
| `app/` | FastAPI app: `GET /health`, `POST /v1/face-read` |
| `models/` | DNN weights / configs |
| `fixtures/` | Test images |
| `Dockerfile` / `requirements.txt` | Cloud Run image |
| `scripts/` | Local/smoke helpers |
| `README.md` | Contract docs |

Proxied by middleware `routes/public-face-read.js` via `FACE_READ_INFERENCE_BASE_URL`.

---

## 6. `Knowledge/`

| Path | Role |
|------|------|
| `ICD-10 Files/`, `CPT/`, `HCPCS/`, `CDT/` | Code sets for medical coding |
| `RAG/` | Exports (e.g. doctorlittle knowledge JSON for Pinecone) |
| `rules/` | Clinical / derm triage rule JSON |
| `eval/datasets/` | Golden / stratified eval sets |
| `corpus/`, `ontology/`, `prompts/`, `fee-schedules/`, `state/` | Supporting clinical knowledge |

Used by Kelly/RCM/RAG — **not** touche product recommendation.

---

## 7. `docs/` (selected)

| Path | Role |
|------|------|
| `Brand/POSITIONING.md` | Journal-first positioning SSOT |
| `Brand/SKIN_AND_CARE_GUIDELINES.md` | Logo/tokens rules |
| `patient-app/design/V3_SCREEN_MAP.md` | Tab IA (some drift vs code) |
| `patient-app/PRODUCT.md` | Product notes (partially legacy) |
| `user-journey/JOURNEY.md` | Funnel + app journey |
| `runbooks/FACE_READ_INFERENCE.md` | Face-read ops |
| `runbooks/TESTFLIGHT.md` / `APP_STORE_SUBMISSION.md` | iOS ship |
| `deployment/DEPLOY_CONSUMER_V3.md` | Consumer env flags |
| `architecture/`, `security/`, `RCM/`, `voice-agent/` | Platform docs |

---

## 8. `todos/`

| Path | Role |
|------|------|
| `pending/MYSKINANDCARE_CODEBASE_AUDIT.md` | Critical analysis / gaps |
| `pending/MYSKINANDCARE_TOUCHELABS_SOFT_LAUNCH_TODOS.md` | Soft-launch checklist + Shopify GIDs |
| `pending/MYSKINANDCARE_CODEBASE_FILE_MAP.md` | **This file** |
| `pending/IOS_SKINCARE_TRACKER_LAUNCH_TODOS.md` | Older iOS launch checklist |
| `pending/SKIN_AGE_JOURNEY_E2E_TODOS.md` | Funnel E2E todos |
| `pending/README.md` | Index of pending lists |
| `archive/` | Completed todo dumps |

---

## 9. Root `scripts/`

Operational Node scripts for brand sync, Firebase consumer hosting, GCP/Cloud Run deploy helpers, face-read smoke, DNS checklists, CI gates. Prefer `package.json` script names over inventing new entry points. (~100+ files; many archived under `scripts/_archive/`.)

---

## 10. Other packages

| Path | Role as-is |
|------|------------|
| `livekit-agents/` | Python agents for LiveKit transcription / YOLO probes |
| `case-report-service/` | Telemedicine case report + Pinecone RAG |
| `medical-rag-api/` | Embedding/RAG utility scripts |
| `infra/bicep/` | Legacy Azure infrastructure |
| `infra/edge-routing/` | Cloudflare/nginx snippets |
| `config/` | Shared JS config (e.g. escrow timeout) |
| `contracts/` | Shared contract fragments |
| `assets/icons/` | Shared icons |
| `local/` | Local env templates |
| `perf/` | Lighthouse runs |

---

## 11. Photo / data pipelines (which files own which hop)

| Pipeline | Client | API | Storage / side effects |
|----------|--------|-----|------------------------|
| Funnel face-read | landing `faceReadApi.js` / app `face-read-api.ts` | `public-face-read.js` | Inference service; optional vision; sessionStorage — **no journal blob** |
| Routine photo | `routine/capture.tsx` → `routine-capture.ts` | `patient-routine.js` photo | `gcs-billing-storage.uploadBuffer` → media row → `routine-photo-day` completion → optional journal backfill → every 7th day `face-read-vision` |
| Journal photo | `journal/capture.tsx` → `journal-api.ts` | `patient-journal.js` | Same upload helper; **requires** `JOURNAL_MODE_STANDALONE=1` |
| Spot snapshot | `track/capture` → `spot-store.ts` | `patient-spots.js` | Upload + `spot-snapshot-service` heuristics |

---

## 12. What is intentionally absent in code

| Expected product piece | Status in codebase |
|------------------------|-------------------|
| Shopify product GIDs / trytouche URLs | **None** in patient-app or middleware |
| Suppliful | **None** |
| Touché SKU → routine slot map | **None** (planned in soft-launch todos only) |
| Expo push notifications | **Not** in `app.json` plugins |
| Journal SMS reminders | **Not** built |
| `health-turn-service.js` | **File does not exist** |
| `MYSKINANDCARE_USER_JOURNEY_AND_LAUNCH_TODOS.md` | **Not written yet** |

---

## 13. How to use this map

1. **Change Home photo behavior** → `home.tsx` + `routine-capture.ts` / `journal-api.ts` + corresponding route file.  
2. **Change a care plan** → `concern-routines.json` + `concern-routine-service.js`.  
3. **Change conflict / BFI** → `conflict-api.ts` + `consumer-analysis-graph.js` + ingredient services.  
4. **Ship TestFlight** → `eas.json`, `app.json`, `scripts/verify-testflight-prereqs.cjs`.  
5. **Do not** start in `checkout-chat.tsx`, `capture-*.tsx`, or hidden tabs for v3 journal work.

For severity-ordered bugs and the touche serum matrix, see [`MYSKINANDCARE_CODEBASE_AUDIT.md`](MYSKINANDCARE_CODEBASE_AUDIT.md).
