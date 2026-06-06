# Redemption notifications

Server-built push/in-app notifications for the redemption state machine. Closes the UX loop: employees see status on **My Points**, admins get queued when someone redeems, recipients hear about fulfill/deny.

## Why DB-side (not `admin-create-notification`)

Employees call `redeem_reward` — they are **not** admins. The `admin-create-notification` edge function requires admin role and returns **403** for non-admins (same wall manual awards hit before `notify_manual_award_recipient`). Pending-admin alerts must fire from inside the redemption RPC via **SECURITY DEFINER** inserts into `notification_events`.

Fulfill/deny notifications use the same pattern so copy is authoritative and decoupled from the client.

## Dispatch path

Bare `INSERT INTO notification_events` — the existing **`notification_events_dispatch_on_insert`** trigger calls `notification_events_dispatch_webhook()` → `notifications-dispatch` edge function (pg_net). Same mechanism as `notify_manual_award_recipient` and certification grant triggers.

Column shape: `category`, `severity`, `target_type`, `target_ref`, `actor_user_id`, `entity_type`, `entity_id`, `title`, `body`, `url`.

## Category

All redemption notifications reuse **`admin_notice`** (no new preference category / migration).

## Who gets notified

| Event | RPC | Recipient | Copy (summary) |
|-------|-----|-----------|----------------|
| New pending request | `redeem_reward` | **Admins** (`target_type=role`, `target_ref=admin`) | `{requester} redeemed {item} ({N} pts) — pending fulfillment.` |
| Fulfilled | `fulfill_redemption` | **Requester** (`target_type=user`) | `Your {item} is ready` / handed over |
| Denied | `deny_redemption` | **Requester** | Denied — **your {N} points have been refunded** |
| Canceled | `cancel_redemption` | *(none)* | User canceled themselves |

Admin targeting is **one event per transition** with role fan-out in `notifications-dispatch` (not one row per admin).

## Idempotency

- **Pending admin:** `entity_type=redemption_pending`, `entity_id=redemption.id`. Idempotent `redeem_reward` retry (same `request_id`) returns early **before** notify — no double admin alert.
- **Fulfill / deny:** `entity_type=redemption_fulfilled` / `redemption_denied`. State machine rejects non-pending transitions; helpers skip if a row already exists.

## Best-effort / decoupled

Notification helpers run inside `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING … END` blocks in the RPCs. A notify failure **must not** roll back the hold, fulfill, deny, or refund — the ledger action is authoritative.

## Migration

`20260606160000_redemption_notifications.sql` — internal helpers `_notify_redemption_pending_admins`, `_notify_redemption_fulfilled`, `_notify_redemption_denied` (not granted to `authenticated`).

## My Points UI

`/my-points` shows a read-only **Pending redemptions** block (via `useUserRedemptions` filtered to `status=pending`) so ledger holds in the activity feed are paired with request status.

## Gate

`supabase/.localgate/assertions.sql` — one admin notify on redeem, idempotent redeem retry, fulfill/deny recipient notifies (deny mentions refund), cancel silent, notify failure does not roll back fulfill.
