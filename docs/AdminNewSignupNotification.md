# Admin notification on new signup

When someone signs up and creates an account, all users with the **admin** role receive a push notification (and in-app notification).

**Requirement:** Admins only receive push if they have enabled notifications in the app (so they have at least one active row in `push_subscriptions`). In-app notifications appear regardless.

## Setup status

- [x] **Edge Function deployed** — `notify-admins-new-signup` is deployed on the linked project.
- [ ] **Database Webhook** — Create once in Supabase Dashboard (step 2 below).

## How it works

1. User signs up on the Home page → `supabase.auth.signUp()` creates a row in `auth.users`.
2. Database trigger `on_auth_user_created` runs and inserts a row into `app_users` (via `handle_new_user()`).
3. A **Database Webhook** fires on `app_users` INSERT and POSTs to an Edge Function. You can use either:
   - **`admin-create-notification`** (recommended): Accepts internal auth via `x-internal-key`; no user JWT required. Use this when the webhook sends `Authorization: Bearer <anon_key>` (gateway requirement); the function uses `x-internal-key` and ignores the JWT to avoid "missing sub claim" errors.
   - **`notify-admins-new-signup`**: Dedicated signup handler; also uses `x-internal-key`.
4. The Edge Function creates a `notification_events` row targeting `role = admin`, then calls `notifications-dispatch` and `notifications-worker` so admins receive the notification.

## Setup (one-time)

1. **Deploy the Edge Function**
   ```bash
   supabase functions deploy notify-admins-new-signup
   ```
   Ensure `INTERNAL_SECRET` is set in Edge Function secrets (same value as for `admin-create-notification`).

2. **Create the Database Webhook**

   **If the Dashboard keeps reverting "HTTP Request" to "Supabase Edge Functions" when you save**, create the webhook via SQL instead (recommended):

   - If you already have a webhook for **app_users** INSERT in Database → Webhooks, delete it first so only one request is sent per signup.
   - Open [SQL Editor](https://supabase.com/dashboard/project/emqqxfzahmwnehxcpxzp/sql/new) in the Supabase Dashboard.
   - Open the script **`docs/AdminNewSignupNotification_webhook.sql`** in this repo.
   - **Replace `YOUR_INTERNAL_SECRET`** with your `INTERNAL_SECRET` (Edge Functions → Secrets).
   - **Replace `YOUR_ANON_KEY`** with your project’s **anon** public key (Project Settings → API). The Supabase gateway requires a valid JWT in `Authorization`; the function then validates `x-internal-key`.
   - Paste the full script into the SQL Editor and run it.
   - This creates a trigger on `app_users` that POSTs to the Edge Function on every INSERT, with no Dashboard type to revert.

   **Alternatively**, create the webhook in the Dashboard:
   - [Database → Webhooks](https://supabase.com/dashboard/project/emqqxfzahmwnehxcpxzp/database/webhooks) → Create a new webhook.
   - **Table**: `app_users`, **Events**: Insert.
   - **Type**: HTTP Request. **URL**: `https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/admin-create-notification` (or `.../notify-admins-new-signup`).
   - **HTTP Headers**: `x-internal-key` = your `INTERNAL_SECRET`.
   - Save. (If the type flips back to "Supabase Edge Functions" and Save fails, use the SQL method above.)

After this, every new signup (new row in `app_users` with role `employee`) triggers a notification to all admin users.

## Testing

1. **End-to-end (real signup)**  
   Sign up with a **new** email in the app (e.g. a test address). Then:
   - **As an admin**: open the app and check **Notifications** (bell) for “New signup” / “{name} just created an account.”
   - **In Supabase**: **Logs** → **Edge Functions** → select `notify-admins-new-signup` and confirm a recent successful request.
   - **In Supabase**: **Table Editor** → `notification_events` — filter or sort by `created_at` and confirm a row with `category = admin_notice`, `title = New signup`.

2. **Trigger only (no new auth user)**  
   To confirm the trigger and Edge Function without creating a real user, run this in the **SQL Editor** (replace `YOUR_INTERNAL_SECRET` and use a **valid** `user_id` from `auth.users` so the insert succeeds):

   ```sql
   -- Pick an existing auth user id (e.g. your own) to satisfy FK
   INSERT INTO public.app_users (user_id, email, full_name, role)
   SELECT id, 'test-signup@example.com', 'Test Signup', 'employee'
   FROM auth.users LIMIT 1
   ON CONFLICT (user_id) DO NOTHING;
   ```
   If the user already exists in `app_users`, the insert is skipped. To force a new row for testing, use a **new** `user_id` from `auth.users` (e.g. create a real test user first, then run the insert with that id), or temporarily insert with a UUID that exists in `auth.users`. Then check logs and `notification_events` as above.

3. **Call the Edge Function directly**  
   To verify the function in isolation (no trigger). Supabase’s gateway requires a **valid JWT** in `Authorization`; the function then checks **x-internal-key** (your INTERNAL_SECRET). Send **both**:

   ```bash
   curl -X POST 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/notify-admins-new-signup' \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY' \
     -H 'x-internal-key: YOUR_INTERNAL_SECRET' \
     -d '{"type":"INSERT","table":"app_users","schema":"public","record":{"user_id":"00000000-0000-0000-0000-000000000000","email":"test@example.com","full_name":"Test User","role":"employee"},"old_record":null}'
   ```
   - **YOUR_SUPABASE_ANON_KEY**: Project Settings → API → **anon** public key (so the gateway accepts the request).
   - **YOUR_INTERNAL_SECRET**: Edge Functions → Secrets → INTERNAL_SECRET (so the function accepts the request).
   If you get `Invalid JWT`, the Bearer token must be the **anon** (or service_role) key, not the INTERNAL_SECRET. On success you get `{"ok":true,"event_id":"..."}` and a new row in `notification_events`.

## Nothing in Edge Function logs

If you create a new user and **no request appears** in Edge Functions → Logs → `notify-admins-new-signup`, the request never reached the function. Only two causes:

1. **No trigger** — The webhook trigger on `app_users` was never created, or was removed.  
   - **Check:** In SQL Editor run:  
     `SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgrelid = 'public.app_users'::regclass;`  
     You should see `notify_admins_on_new_signup`. If not, run the full script in `docs/AdminNewSignupNotification_webhook.sql` (step 2 in Setup).

2. **Gateway rejecting the request (401)** — The trigger runs and calls `net.http_post`, but the Supabase Edge Function gateway requires `Authorization: Bearer <valid JWT>`. If the trigger only sends `x-internal-key`, the gateway returns 401 and the function is never invoked, so there are no logs.  
   - **Fix:** Open `docs/AdminNewSignupNotification_webhook.sql`, replace **both** `YOUR_INTERNAL_SECRET` and `YOUR_ANON_KEY` (anon key from Project Settings → API), then run the **entire** script in SQL Editor. That recreates the trigger with the correct headers.  
   - **Quick test after fix:** Create another new user (or run the "Trigger only" SQL in Testing #2 with a new `user_id`), then check Edge Function logs again.

## Why didn’t I get a push?

1. **Webhook not reaching the function**  
   The Supabase gateway requires a valid JWT in the `Authorization` header. If the webhook (SQL or Dashboard) only sends `x-internal-key`, the gateway can return 401 and the function never runs.  
   - **Fix:** Use the SQL script and set both `YOUR_INTERNAL_SECRET` and `YOUR_ANON_KEY` (anon key is used for `Authorization: Bearer`). If you created the webhook earlier without the anon key, re-run the script with both values.

2. **Admin has no push subscription**  
   Push is only sent to devices that have subscribed. The admin must have opened the app, allowed browser notifications when prompted, and have at least one active row in `push_subscriptions` (Table Editor → `push_subscriptions`; filter by the admin’s `user_id`; `revoked_at` should be null).  
   - **Fix:** As an admin, open the app, go to Settings (or the page where “Enable notifications” is shown), and enable push. Then trigger a new signup again.

3. **Verify each step**  
   - **Edge Functions → Logs** → `notify-admins-new-signup`: after a signup you should see a successful request. If there is no request, the webhook isn’t firing or the gateway is rejecting it (fix #1).  
   - **Table Editor** → `notification_events`: after signup, a row with `category = admin_notice`, `title = New signup`.  
   - **Table Editor** → `notification_outbox`: rows for each admin user for that event; if `status = skipped` and `last_error = 'No active push subscriptions'`, fix #2.  
   - **Table Editor** → `push_subscriptions`: at least one row per admin with `revoked_at` null.

### Checklist when push never arrives

| Step | Where to check | If missing / wrong |
|------|----------------|--------------------|
| 1. Trigger exists | SQL: `SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.app_users'::regclass AND tgname = 'notify_admins_on_new_signup';` | No rows → run `AdminNewSignupNotification_webhook.sql` with **both** `YOUR_INTERNAL_SECRET` and `YOUR_ANON_KEY`. |
| 2. Function was called | Edge Functions → Logs → `notify-admins-new-signup` | No request after signup → gateway 401; ensure trigger sends `Authorization: Bearer <anon key>`. |
| 3. Event + outbox created | `notification_events` and `notification_outbox` | Event row with `title = 'New signup'`; outbox rows per admin. |
| 4. Admins have push enabled | `push_subscriptions` for admin `user_id`, `revoked_at` null | No rows → have each admin open the app and enable notifications, then retry. |

### Push marked "sent" but I never saw it on my device

If `notification_outbox` shows **status: sent** for your admin user but no notification appeared:

1. **Same device and browser** — Push is per subscription (per browser/device). If you enabled notifications in Chrome on your laptop, you only get push on that Chrome instance. You won’t see it on your phone or in Safari unless you also enable push there.
2. **App tab in focus** — Many browsers (e.g. Chrome) do **not** show a visible notification when the app tab is focused; they only show when the tab is in the background or the browser is minimized. **Test:** Minimize the browser or switch to another tab, then trigger a new signup (or ask someone to), and see if the notification appears.
3. **Site permission** — In browser or OS settings, ensure the app’s origin is **allowed** for notifications (not “blocked” or “quiet”).
4. **Do Not Disturb / Focus** — System-wide DND or Focus mode can suppress notifications.
5. **Re-enable and retry** — As an admin, open the app, go to Settings, turn notifications **off** then **on** again (to refresh the subscription), then trigger another new signup and test with the app tab in the background.
