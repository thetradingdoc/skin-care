# Touche camera-first + contextual commerce

> **SUPERSEDED (2026-07-16) — historical record only.**  
> This file is **not** the current product SSOT. In-app IA, capture, facts, and trust are owned by  
> **[`TOUCHE_AGENTIC_ARCHITECTURE.md`](./TOUCHE_AGENTIC_ARCHITECTURE.md)** (5-tab shell, Progress lander, `orchestrateCapture`, policy gates).  
> Keep this document for commerce/deep-link archaeology and the camera-first rebuild train. Do not treat “Check sole home / no tab bar” as current.

**Former status (at close of camera-first train):** Phases 0–5 **code-complete**. Acceptance: 0–2 accepted; Phase 3 accepted with **device carve-outs**; Phase 4/5 API/commerce + blocking bugfixes landed — **device smoke** (056–059 / 108–109 / 114) still open before treating as fully launch-ready. Shopify theme **094–097 LAST**.  
**Last updated (as SSOT):** 2026-07-14 · **Superseded:** 2026-07-16  
**Full backlog:** Cursor plan `touche_camera-first_rebuild_5aa81835` — **117 tickets TOUCH-001 … TOUCH-117**  
**Mock:** `touche_complete_journey_with_commerce.html` (1–21) + Screen **6c** Get the App (iOS only)

## One-line (historical — camera-first train)

Free camera journal (**Check** = sole home) on `app.trytouche.com` + native; money only on Shopify via cart permalinks + webhooks; store theme redesign is **last**.  
*(Nav claim obsolete — see agentic SSOT for current 5-tab / Progress lander.)*

## Locked decisions

| Topic | Lock |
|-------|------|
| Money | Shopify checkout only. App free for camera / verdict / diary. |
| Commerce | Deep link out → checkout → webhook back. No native cart, no Multipass. |
| Cart URL | Base: `https://trytouche.com/cart/{variant_id}:1?discount=CODE` (client may append UTM). |
| Commerce CTA kill-switch | `COMMERCE_CTAS_ENABLED` is authoritative when set (`0` force off / `1` force on); unset falls back to variant-map presence. |
| Shopify customer tag | Merge `app_member` into existing tags (GET → merge → PUT). Never blind-replace. |
| Admin commerce routes | `requireAdminAuth` required at route registration (fail-fast; no silent passthrough). |
| Deep links | `patientapp://` only. Never `touche://`. |
| DB | SQL. Not MongoDB. |
| Severity default | `low` / `some` / `a_lot` → ranks 1 / 2 / 3. |
| Severity advanced | Optional 1–10 sliders when Profile toggle on (TOUCH-102/103). |
| Nav | **Historical:** No tab bar; Check sole home. **Superseded** by 5-tab Progress lander — see agentic SSOT. |
| Shop | Contextual only. |
| Profile | Allergens block before progressive/advanced fields toggle (TOUCH-086). |
| Profile progressive fields | Budget, location/climate, procedure date, advanced toggle — **collected for future personalization; not yet wired to recommendation/routine logic.** Hormone cycle not built. Procedure date **is** consumed by safe-mode (TOUCH-100/101). |
| Post-procedure | Date **+** safe-mode engine (TOUCH-100/101). |
| Post-OTP Get the App | **iOS only.** Custom interstitial. Android/desktop → Check. |
| Native push | **Built** TOUCH-114–116 (permission, daily reminder, agent-line/delta). Physical OS prompt still confirm-before-ship on device. 6c may mention reminders only when push ships same train. |
| Check chrome brand | Strip skin‧care. **Show** compact real **touche** mark (`#F7591F`, `ToucheMarkCompact`) on **Check / bottle / spot**. |
| Account deletion | **Required** TOUCH-098/099 — App Store 5.1.1(v). |
| Acrylate-free | Distinct from generic Safe (TOUCH-104). |
| Dead letters | Reconcile on signup + ops for sku_unmapped (TOUCH-105/106). |
| Camera denied | Fallbacks TOUCH-107–109. |
| Accessibility | Pre–App Store pass TOUCH-117 (not Phase 0 blocker). |
| Shopify theme | Phase 6 last (TOUCH-094–097). |
| care_program | Buried (not primary monetization). |

## Explicitly deferred (documented — not dropped)

| Item | Ticket | Scope note |
|------|--------|------------|
| Weather / UV ambient nudge | **TOUCH-112** (docs only) | **Not implemented** in Phase 0–5. No build ticket attaches engine/UI work. |
| Multi-concern priority / concurrent routines | **TOUCH-113** (docs only) | **Deferred — data-model before UI.** No Phase 0–5 implementation ticket. |
| Regional / local availability | Deferred — sourcing | Not a consumer UI ticket in this rebuild |
| Hormone-cycle tracking | Not in backlog | Not collected; not built |
| Budget / climate → live recommendation wiring | Fields only until a later phase | TOUCH-088/089 collect only |

## Screen 6c OS branch

```
[Token Auth Successful] → Detect OS
  iOS → custom Get-the-App → Download | Continue → Check
  Android/Desktop → Check directly
```

## Severity map

| UI | Enum | Chart rank |
|----|------|------------|
| low | `low` | 1 |
| some | `some` | 2 |
| a lot | `a_lot` | 3 |
| calm | `yes` / `no` | — |

Default UI is plain language. Optional advanced 1–10 sliders only when Profile toggle is on (TOUCH-102/103). Never invent raw 0–10 storage without that toggle.

## Commerce flow

```
Verdict / alert / profile “shop”
  → Screen 17 honesty interstitial
  → https://trytouche.com/cart/{variant}:1?discount=JOURNAL20 (+ optional UTM)
  → Shopify checkout (payment stays on Shopify)
  → orders/create webhook (match email | dead-letter; tag merge app_member)
  → patientapp://order-confirmation
  → auto shelf + re-run evaluate
```

No native cart. No Multipass. Deep-link scheme remains `patientapp://` only.

## Cursor plan link

Full Jira backlog: plan file `touche_camera-first_rebuild_5aa81835.plan.md` (tickets TOUCH-001…117).

## Build focus order

1. TOUCH-001–012 + 098/099 + 112/113 + 110  
2. TOUCH-013–038 + 009 + 104 + 107 + **114**  
3. TOUCH-039–052 + 102/103 + **115/116**  
4. TOUCH-053–068 + 100/101 + 108/109 + 111  
5. TOUCH-069–093 + 105/106  
6. **TOUCH-117** a11y before App Store submit  
7. TOUCH-094–097 **LAST** trytouche.com theme  

## Phase status

| Phase | Status | Notes |
|-------|--------|-------|
| 0 | **Accepted** | Hard-verified cold boot / Back / tokens |
| 1 | **Accepted** | Runtime confirm: TOUCH-099 + TOUCH-026 closed on real `middleware-dev.db`; TOUCH-114 device still open |
| 2 | **Accepted** | Diary/Proof/severity/push nudges — TOUCH-036–052 + 091/102/103/115/116 |
| 3 | **Accepted (device carve-outs)** | Chemistry/shelf/alerts + safe-mode. Still open on device: 056–059, 108/109; TOUCH-101 ambient paint confirmed on Expo web |
| 4 / 5 | **Accepted for API/commerce + bugfixes** | Blocking fixes: tag merge, `COMMERCE_CTAS_ENABLED` override, admin auth fail-fast, Profile allergens-first. Not fully launch-ready until device smoke + theme LAST |
| 6 | **LAST** | Shopify theme TOUCH-094–097 — do not start until app-side device smoke closes |

### Confirm before ship (remaining)

| Item | Ticket | Status |
|------|--------|--------|
| Account purge on real DB | **TOUCH-099** | **Confirmed** — runtime SQLite before/after + stale session 401 |
| Pending product → shelf | **TOUCH-026** | **Confirmed** — OTP confirm → live `POST /api/patient/shelf/products` |
| Push permission (device) | **TOUCH-114** | **Open** — needs physical iOS / Simulator OS prompt |
| Bottle entry + bands + camera-denied | **056–059 / 108–109** | **Open** — needs device/Simulator |
| App Store URL reconcile | **TOUCH-029 ↔ TOUCH-110** | **Open** — blocked on App Store Connect listing (TOUCH-110) |

### Carry into later phases (correctly deferred — not fake-passed)

| Ticket | Goes to | Reason |
|--------|---------|--------|
| **TOUCH-104** | **Phase 3 first** (after TOUCH-054) | Acrylate-free badge needs evaluate hard_no / acrylate confirmation engine. |

Phase 2 harden (2026-07-14): TOUCH-036 plan label cleaned; TOUCH-044 Skip writes `patient_routine_daily_item_logs`; TOUCH-050 Proof date picker for 48h backfill window.

## Related docs

- Plan (Jira): `~/.cursor/plans/touche_camera-first_rebuild_5aa81835.plan.md`  
- Deep links: `ARCHITECTURE.md`, `patient-app/app.json` `scheme: patientapp`  
