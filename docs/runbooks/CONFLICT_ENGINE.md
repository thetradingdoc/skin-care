# Conflict Engine runbook

## Feature flag

Set `PATIENT_CONFLICT_ENGINE_V1=1` on middleware-platform to enable evaluate-backed layering-check (default in dev).

## Graph unavailable UX

When the ingredient conflict graph cannot load (`conflict_graph_unavailable` or `graph_unavailable: true`):

1. **Today / Scan / Verdict** — show amber banner: *Ingredient compatibility data is temporarily unavailable.*
2. **Do not** block photo upload or shelf scan; OBF + shelf rows still persist.
3. **BFI ring** — hide or show last snapshot from `patient_routine_lineup_snapshots` if available.
4. **Public evaluate** — return HTTP 503 with `{ success: false, error: 'conflict_graph_unavailable' }`.

### Ops checklist

- Confirm SQLite graph tables populated (`ingredient_interactions`, CosIng index).
- Check Cloud Run / local logs for `createIngredientConflictGraph` failures.
- Re-run catalog ingest if graph row count is zero.

## Metrics (T6-14)

Log or export via `recordPatientPortalEvent`:

| Event | When |
|-------|------|
| `conflict.evaluate.request` | GET/POST `/api/patient/routine/evaluate` |
| `conflict.evaluate.public` | POST `/api/public/routine/evaluate` |
| `bfi.elevated` | BFI &lt; 80 in evaluate response |
| `bfi.critical` | BFI &lt; 60 |
| `shelf.scan` | Barcode scan success |
| `shelf.verdict_action` | remove / keep |

## Mobile smoke

1. Sign in → complete bio calibration if prompted.
2. Scan tab → manual add product → Verdict screen with score.
3. Today → BFI ring + conflict count.
4. Progress → 8-day grid + improvement bars.
5. Capture photo → preflight banner when lineup not safe.

Before Playwright or production deploy, verify the Expo web export includes conflict-engine routes:

```bash
node scripts/verify-consumer-hosting.cjs
```

Requires `app/(tabs)/scan.html` and `app/verdict/[productId].html` in `hosting-dist-consumer`. If missing, run `node scripts/build-consumer-hosting.cjs` or `node middleware-platform/scripts/ensure-conflict-engine-hosting.cjs`.

## API quick reference

| Endpoint | Purpose |
|----------|---------|
| `GET /api/patient/routine/evaluate` | Full lineup verdict + BFI |
| `POST /api/patient/shelf/products/scan` | Barcode → OBF → shelf |
| `POST /api/public/routine/evaluate` | Anonymous 2-product teaser |
| `GET /api/patient/home/barrier-insight` | Dip explanation |
| `POST /api/patient/shelf/products/:id/verdict-action` | remove \| keep |
