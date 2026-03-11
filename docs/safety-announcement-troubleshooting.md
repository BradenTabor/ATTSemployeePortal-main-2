# Safety Announcement Not Showing – Troubleshooting

If the 5 AM daily safety message does not appear in the app, work through this checklist.

## 1. Cron job authentication (most common cause)

The cron can run with auth in two ways:

### Option A: Use Vault (recommended – one-time setup in Dashboard)

If your project has the **Vault** extension enabled (Supabase Dashboard → Project Settings → Extensions, or Database → Extensions), migration `20260319120005_safety_announcement_5am_use_vault.sql` switches the 5 AM job to read the key from Vault.

1. In Supabase Dashboard go to **Project → Vault** (or **Database → Vault**). If you don’t see Vault, enable the extension first.
2. Open **Secrets** and create a new secret:
   - **Name:** `CRON_SERVICE_ROLE_KEY`
   - **Value:** your project’s **service_role** key (Settings → API → Project API keys → `service_role`).
3. Save. The next 5 AM Central run will use this key and the announcement should be created.

No local script or DB URL needed.

### Option B: Run the deploy script (injects key into cron)

Alternatively, run the deploy script so the cron job in the DB uses your service role key:

```bash
SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>" \
SUPABASE_DB_URL="<your-database-uri>" \
./scripts/deploy-cron-auth.sh
```

- **Service role key:** Supabase Dashboard → Settings → API → Project API keys → `service_role` (secret).
- **Database URL:** Supabase Dashboard → Project Settings → Database → Connection string → URI (e.g. Session or Transaction mode).

You can also set these in `.env`; the script reads `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DB_URL` from the environment.

After running the script, the next 5 AM Central run should succeed and create an announcement.

## 2. Verify the Edge Function

Trigger the function manually to confirm it can generate and save an announcement:

```bash
curl -X POST 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/generate-safety-announcement' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -d '{"windowHours": 48, "skipWeekendCheck": true}'
```

- If you get `401` and a hint about the placeholder key, complete step 1.
- If you get `200` and `"status": "success"`, the function and DB insert work; the issue is likely the cron auth (step 1).

## 3. Check cron execution and logs

- **Cron runs:** In the database, query `cron.job_run_details` (or use the `cron_job_runs` view if present) for job name `safety-announcement-5am` around 10:00 UTC (5 AM Central). Confirm whether runs exist and if `return_message` shows an error (e.g. HTTP 401).
- **Edge Function logs:** Supabase Dashboard → Edge Functions → `generate-safety-announcement` → Logs. Look for requests at 10:00 UTC; 401 responses will log “Unauthorized” and, if the placeholder was sent, a hint to run `deploy-cron-auth.sh`.

## 4. App display logic

The app shows “today’s” safety message only when:

- The **latest** announcement (by `date` descending) has `date` equal to **today in America/Chicago**.
- So if no row was inserted for today (e.g. cron failed with 401), the latest row may be yesterday’s and the app correctly shows no “today” message.

Fixing the cron auth (step 1) and ensuring the function runs at 5 AM Central should restore the daily message.

## Summary

| Symptom | Likely cause | Action |
|--------|----------------|--------|
| No announcement in app today | Cron sent placeholder key → 401 | Run `./scripts/deploy-cron-auth.sh` with real key and DB URL |
| 401 when calling Edge Function manually | Wrong or missing `Authorization` header | Use valid service role key in `Authorization: Bearer ...` |
| Cron runs but no row in `announcements` | Function error (OpenAI, DB, etc.) | Check Edge Function logs at 10:00 UTC; fix secrets/errors |
