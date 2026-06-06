# Redemption store — DB layer (increment 1)

Factual reference for developer/admin docs. Placeholder catalog seeded; confirm items/costs with client before launch.

## Tables

- `reward_catalog` — items; `stock_qty NULL` = unlimited inventory
- `redemptions` — requests; `request_id` is client idempotency key (`UNIQUE (user_id, request_id)`)

## State machine

| Transition | Who | Wallet | Stock |
|------------|-----|--------|-------|
| `redeem_reward` | User | Hold: negative `redemption` ledger row immediately | Decrement if tracked |
| `pending → denied` | Admin | Refund: positive `adjustment` row | Restore +1 if tracked (only when refund row written) |
| `pending → canceled` | Owner or admin | Same refund path as deny | Same restore path |
| `pending → fulfilled` | Admin | Hold stays (final spend) | No change |

`approved` enum value reserved; not used in v1 flow.

## Invariants

- **Hold-on-request:** points deducted at redeem time, not at fulfill. Pending balance reflects committed spend.
- **Fulfill is terminal:** no refund on fulfill.
- **Raffle isolation:** hold rows and refund adjustments use `counts_toward_raffle = false`. `get_user_raffle_entries` is unaffected by spending or refunds.
- **Balance:** `get_user_point_balance` sums all ledger amounts including negative redemption holds.
- **Anti-overspend:** `pg_advisory_xact_lock(hashtext('redeem_reward:' || user_id))` serializes per-user redeems so balance read + hold insert are atomic.
- **Redeem idempotency:** same `(user_id, request_id)` returns existing redemption; no second hold.
- **Refund idempotency:** partial unique index on `point_transactions(reference_id)` where `source='adjustment' AND reference_table='redemptions'`. Stock restore gated on `INSERT ... RETURNING id` (no restore when conflict DO NOTHING).
- **Stock race:** `UPDATE ... SET stock_qty = stock_qty - 1 WHERE stock_qty > 0` on redeem; last unit resolves to one success.
- **Unlimited stock:** `stock_qty IS NULL` — no decrement on redeem, no restore on refund (UPDATE skipped).

## RPCs (SECURITY DEFINER, authenticated EXECUTE)

- `redeem_reward(item_id, request_id)`
- `fulfill_redemption(redemption_id, note?)` — admin only
- `deny_redemption(redemption_id, note?)` — admin only; re-deny on denied/canceled is no-op
- `cancel_redemption(redemption_id)` — owner or admin; non-pending raises

No direct user INSERT/UPDATE on `redemptions` or `point_transactions`.

## Gate

`supabase/.localgate/assertions.sql` — behavioral matrix including stock-restore idempotency and NULL-stock safety.
