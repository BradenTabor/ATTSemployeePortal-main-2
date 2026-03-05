# notification-event-dispatch

Optional: invoked by a **Database Webhook** when a row is inserted into `notification_events`. Forwards the event to `notifications-dispatch` so push notifications are delivered. Used for trigger-created events (e.g. external cert grant/revocation).

**Recommended:** Use the **SQL trigger** instead so no Dashboard webhook is needed. Run **`docs/NotificationEventDispatch_webhook.sql`** once (replace `YOUR_INTERNAL_SECRET` and `YOUR_ANON_KEY`), then every INSERT into `notification_events` will call `notifications-dispatch` directly via pg_net.

## Option A: SQL trigger (recommended)

1. Open **`docs/NotificationEventDispatch_webhook.sql`** in this repo.
2. Replace `YOUR_INTERNAL_SECRET` and `YOUR_ANON_KEY`.
3. Run the full script in Supabase Dashboard → SQL Editor.

No need to deploy this Edge Function if you use Option A.

## Option B: Database Webhook + this function

### 1. Deploy the function

```bash
supabase functions deploy notification-event-dispatch
```

Ensure `INTERNAL_SECRET` is set in Edge Function secrets.

### 2. Create the Database Webhook

In **Supabase Dashboard** → **Database** → **Webhooks** → **Create a new webhook**:

- **Table:** `notification_events`, **Events:** Insert.
- **Type:** **HTTP Request**, **URL:** `https://<project-ref>.supabase.co/functions/v1/notification-event-dispatch`
- **HTTP Headers:** `x-internal-key` = your `INTERNAL_SECRET`.
- Save.
