# Skin & Care — product positioning

> **Last reviewed:** 2026-06-11

## SSOT tagline

**The #1 Skincare Journal.**

Use this line on the landing hero, footer, App Store marketing (where allowed), social bios, and support scripts. The face check is the **hook**; the journal is the **product**.

## Supporting copy

| Context | Copy |
|---------|------|
| Hero subtitle | Start with a quick face check. Log one photo a day and see what changes — flares, products, reactions. |
| Primary CTA | Check your skin |
| Diary CTA (reactive users) | Continue tracking your skin |
| Routine CTA (optional path) | Build my routine |
| Footer / secondary | The #1 Skincare Journal. |

## Voice rules

- Lead with **journal / photo log / timeline**, not glow, anti-aging, or care programs.
- Face scan = **baseline photo for the diary**, not a vanity age test.
- Product scan = **safety check before trying something**, not “recommendations.”
- Care plans and routines are **optional** for users who want them — never the default promise for reactive-skin users.

## Banned phrases (consumer-facing)

Do not use in landing, funnel, App Store lead copy, or DMs:

- Track today. Glow tomorrow.
- Facial Age Checker
- We help you look younger
- Build better habits (as primary promise)
- Gives you recommendations (to reactive-skin users)
- Care programs / 8–24 week plan (as lead — OK as secondary feature)

## Funnel segments

| Segment | Quick-check signal | Post-signup `journey_modes` |
|---------|-------------------|----------------------------|
| `reactive_minimal` | `not_really` + Irritated | `['watch']` |
| `diary_first` | `not_really` / `starting_fresh` | `['watch']` |
| `routine_ready` | `yes_regularly` / `sometimes` | `['routine']` |
| `watch_only` | “I just want to track” link | `['watch']` |

## DM template — reactive skin (Lorato-type)

> That makes total sense — reactive skin is exactly why this exists. You don't need a routine. You just take a daily photo (same angle, same light) and over time you can see if your skin is calming down or getting worse. If you ever want to try something, you can scan the product first and it flags harsh ingredients for sensitive skin. It's a diary and a safety check, not a push to add more stuff.

**Never say:** “recommendations,” “build a routine,” or “care program” to this segment unless they ask.

## App Store note

Apple may reject unsubstantiated “#1” in subtitle (30 chars). Use factual subtitle: `Skincare journal & photo log`. Keep full tagline on web hero.

## Phase 2 moat (not shipped)

- Diary export / PDF for dermatologist visits
- Agent-assisted booking: “I see 18 days of flare photos — want me to find a slot?”
- Consumer booking surface in Expo (API exists on legacy web)

See [`user-journey/JOURNEY.md`](../user-journey/JOURNEY.md) for funnel implementation.

## Related docs

- [`SKIN_AND_CARE_GUIDELINES.md`](./SKIN_AND_CARE_GUIDELINES.md) — visual brand
- [`user-journey/JOURNEY.md`](../user-journey/JOURNEY.md) — Skincare Journal Journey
- [`marketing/SEO_CONTENT_PLAN.md`](../marketing/SEO_CONTENT_PLAN.md) — SEO articles
