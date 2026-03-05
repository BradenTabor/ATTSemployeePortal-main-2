# Dispatch on notification_events insert

When a row is **inserted** into `notification_events`, something must call **notifications-dispatch** with that event’s `id` so outbox rows are created and push notifications are sent. Events created by **cron** (e.g. cert-expiration-reminder, safety-briefing-reminder-push) already call dispatch in code. Events created by **database triggers** (e.g. external cert grant/revocation from `worker_external_certifications`) do not, so we need a trigger or webhook.

## Setup (one-time)

Use the **SQL trigger** so every INSERT into `notification_events` automatically calls `notifications-dispatch`.

1. Open **`docs/NotificationEventDispatch_webhook.sql`** in this repo.
2. Replace **`YOUR_INTERNAL_SECRET`** with your INTERNAL_SECRET (Supabase → Edge Functions → Secrets).
3. Replace **`YOUR_ANON_KEY`** with your project’s **anon** public key (Project Settings → API).
4. Run the **entire** script in Supabase Dashboard → SQL Editor.

After this, any INSERT into `notification_events` (from triggers, cron, or admin) will trigger a pg_net POST to `notifications-dispatch` with `{ event_id: <new row id> }`, so delivery works for:

- External cert **grant** (admin assigns/verifies a cert)
- External cert **revocation**
- Any future trigger that inserts into `notification_events`

## Verify

1. **Trigger exists**

   In SQL Editor:

   ```sql
   SELECT tgname FROM pg_trigger
   WHERE tgrelid = 'public.notification_events'::regclass
     AND tgname = 'notification_events_dispatch_on_insert';
   ```

   You should see one row.

2. **End-to-end**

   As an admin, assign an external cert to a worker (or revoke one). That insert/update runs the cert lifecycle trigger, which inserts into `notification_events`. The new trigger then POSTs to `notifications-dispatch`. Check Edge Function logs for **notifications-dispatch** and **notification_outbox** for the new event.

## Alternative: Dashboard webhook

Instead of the SQL trigger, you can create a Database Webhook in the Dashboard that calls the **notification-event-dispatch** Edge Function on `notification_events` INSERT. See **`supabase/functions/notification-event-dispatch/README.md`**.
