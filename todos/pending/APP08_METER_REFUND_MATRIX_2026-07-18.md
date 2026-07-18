# APP-08 — Meter refund matrix (reconciled with SEC-31)

## Consume path (SEC-31, Wave 3)

| Source | Consume rule |
|--------|----------------|
| `welcome_bonus` | `UPDATE … remaining = remaining - 1 WHERE remaining > 0` must return `changes === 1` before inserting usage |
| `paid_credits` | ledger `consumeCredit` |
| `monthly` | SQLite transaction: count consumed + insert |
| `plus` | insert only (unlimited) |

## Refund path (APP-08, same module)

| `meter_source` | On `refundFailedIfNeeded` |
|----------------|---------------------------|
| `welcome_bonus` | Atomic restore: `remaining = MIN(quota, remaining + 1)` where `remaining < quota` and not expired; `welcome_restored = changes === 1` |
| `paid_credits` | `refundCredit` → `credit_restored` |
| `monthly` / `plus` / other | Status flip `consumed` → `refunded` restores quota via count semantics; no welcome/credit restore |

Idempotent: second refund returns `already_refunded` without double-restoring welcome remaining.

## Reconciliation note

SEC-31 and APP-08 are **one file / one consume↔refund pair** in `ai-capture-meter.js` — not two independent welcome-bonus implementations. Consume decrements with `changes === 1`; refund increments with the same `changes === 1` discipline.

## PDF text-layer (APP-02)

Never meters — no refund needed. Meter-then-refund (`pdf_text_layer_unmetered`) deleted.
