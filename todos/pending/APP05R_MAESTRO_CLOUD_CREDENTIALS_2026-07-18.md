# APP-05R — Maestro Cloud device nightly (ops / credentials)

**Status:** scheduled follow-up — **does not block Wave 5**.  
**Parent:** APP-05 scaffolding shipped in Wave 4 (workflow + static gate + Maestro YAML).  
**Owner:** engineering ops / whoever provisions GitHub Actions secrets for this repo (same class as deploy secrets).  
**Plan class:** same tracking discipline as SEC-12R / SEC-14R — named ID, sized, not an indefinite footnote.

## Size

**~0.5–1 engineer-day** once credentials exist (wire secrets → first green Maestro Cloud run → mark required or keep optional).  
**Blocked today on:** provisioning outside this session (no `MAESTRO_CLOUD_API_KEY` in repo secrets yet).

## Required secrets / artifacts

| Secret / input | Purpose |
|----------------|---------|
| `MAESTRO_CLOUD_API_KEY` | Maestro Cloud auth |
| `MAESTRO_CLOUD_PROJECT_ID` | Cloud project |
| `MAESTRO_APP_FILE` | Path or URI to uploaded iOS/Android build Maestro can run |
| `TOUCHE_SMOKE_API_BASE` (optional) | Live API base for `app05-nightly-capture-smoke.cjs` |

## Already green without credentials

- `.github/workflows/touche-capture-smoke.yml` — static + APP-04 migration jest
- `middleware-platform/scripts/app05-nightly-capture-smoke.cjs`
- `patient-app/.maestro/capture-confirm-smoke.yaml`
- Maestro Cloud job **skips cleanly** when API key unset (not a silent pass-as-device)

## Done when

1. Secrets provisioned in GitHub (or Maestro Cloud UI + documented).
2. One scheduled run shows Maestro Cloud job **executed** (not skipped) and **green** on capture-confirm smoke.
3. This file updated to **closed** with run URL / date.

## Schedule

Parallel with Wave 5 / after credentials land — **tracked**, same as SEC-12R/14R. Not a product code blocker.
