# Directive: Daily Safety Announcement

## Goal

Generate a single, warm, personalized safety announcement each weekday at 5:00 AM Central by aggregating the last 48 hours of JSA, DVIR, and Equipment Inspection data and synthesizing it with an LLM. Optionally publish the announcement and send push notifications to users.

## Inputs

- **Time trigger**: 5:00 AM America/Chicago, Monday–Friday (or cron equivalent in UTC).
- **Data window**: Configurable lookback (default 48 hours). All aggregation uses this window.
- **Environment**: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Optional: `ANNOUNCEMENTS_MODE` (`draft` | `auto_publish`), `DRY_RUN`.

## Tools / Scripts

- **Execution**: `src/services/safety-agent/execution/generateDailySafetyAnnouncement.ts`
  - `fetchAllSafetyData()` – fetch JSA, DVIR, Equipment data for window
  - `aggregateAllSafetyData()` – aggregate hazards and top items
  - `generateDailySafetyAnnouncement()` – LLM generation with strict character limits
- **Publish**: `execution/publishAnnouncement.ts` – write to `safety_announcements` and optionally trigger push
- **Prompts**: `prompts/v3/` (or version in use) – system/user prompt for tone (warm, caring, no stats in body)

## Outputs

- **Database**: Row in `safety_announcements` with `body`, `summary`, `metadata`, `status` (`draft` or `published`).
- **Push notifications**: If published and notifications enabled, users receive the `summary` (or body) via push.
- **Logs**: Generation timing, character counts, and any validation failures.

## Business Rules

1. **Grounding**: Only mention conditions/hazards present in the provided data; never fabricate.
2. **Character limits**: Body target 238 chars, max 283; summary max 240 (enforced in code).
3. **Tone**: Warm greeting ("Hey ATTS Family,"), appreciation, caring close ("Stay safe out there!"). No statistics or hazard counts in the body.
4. **Anonymity**: No employee names or identifying details in the announcement.
5. **Content priority**: Near-misses → weather → equipment/vehicle issues → PPE reminders.

## Edge Cases

- **No data in window**: Generate a short, generic safety reminder (e.g. PPE, hydration); do not fail.
- **OpenAI unavailable**: Log error; do not write announcement. Retry on next run or alert.
- **Duplicate run**: Idempotency by date: one announcement per calendar day (America/Chicago). If one exists for "today", skip or replace per policy.
- **Very long LLM output**: Truncate to `BODY_MAX_CHAR_LIMIT` and validate with `validateBodyLength` / `validateSummaryLength` before save.

## Acceptance Criteria

- [ ] Announcement generated once per weekday at 5 AM Central.
- [ ] Body and summary within character limits and tone guidelines.
- [ ] Content grounded only in provided data.
- [ ] Draft or published correctly written to `safety_announcements`.
- [ ] Push sent only when published and notifications enabled.
