# Directive: Daily Safety Announcement

> **Status**: ACTIVE - Scheduled for 7:00 AM CST Monday-Friday

## Purpose
Generate a daily safety announcement based on recent safety submissions from multiple data sources:
- **JSA** (Job Safety Analysis) forms
- **DVIR** (Daily Vehicle Inspection Reports)
- **Daily Equipment Inspections**

The announcement should be grounded in actual data and highlight trends, hazards, equipment issues, and PPE reminders.

## CRITICAL: Character Limits

The announcement body text has strict character limits:

| Field | Target | Maximum | Notes |
|-------|--------|---------|-------|
| `body` | **238 chars** | **283 chars** | NEVER exceed max. Includes spaces/punctuation. |
| `summary` | N/A | **240 chars** | For push notifications and SMS |

These limits are enforced programmatically via `validateBodyLength()` and `validateSummaryLength()`.

## Trigger

- **Scheduled**: Daily at **7:00 AM America/Chicago**, Monday through Friday only
- **Manual**: On-demand generation via Edge Function invocation
- **Skip weekends**: Automatically skip Saturday and Sunday

## Cron Schedule

```sql
-- 7:00 AM CST = 13:00 UTC (standard time) / 12:00 UTC (daylight time)
SELECT cron.schedule(
  'safety-announcement-7am',
  '0 13 * * 1-5',  -- Mon-Fri at 13:00 UTC (7 AM CST)
  $$
  SELECT net.http_post(
    url := 'https://[project].supabase.co/functions/v1/generate-safety-announcement',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"windowHours": 48}'::jsonb
  );
  $$
);
```

**Note:** Adjust UTC hour for DST (12:00 UTC during CDT, 13:00 UTC during CST).

## Required Inputs

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `windowHours` | number | **48** | Hours to look back for safety submissions |
| `minSubmissions` | number | 3 | Minimum total submissions required to generate announcement |
| `mode` | string | "auto_publish" | "draft" or "auto_publish" |
| `dryRun` | boolean | false | If true, generate but don't save/notify |

## Data Sources

### 1. JSA Submissions (Primary)
```sql
SELECT id, user_id, hazards_present, ppe, weather_conditions, weather_hazards, 
       jobs_performed, notes, created_at
FROM public.daily_jsa
WHERE created_at >= NOW() - INTERVAL ':windowHours hours'
ORDER BY created_at DESC;
```

**Key Fields:**
- `hazards_present`: JSONB object like `{ "Falls": true, "Electrical Contact": true }`
- `ppe`: JSONB object like `{ "Hard Hat": { required: true, condition: "good" } }`
- `weather_conditions`: JSONB with `conditions` and `modifiers` objects
- `weather_hazards`: Text field for additional weather notes
- `notes`: Text field - check for "near miss" or "close call" mentions

### 2. DVIR Reports (Vehicle Safety)
```sql
SELECT id, user_id, truck_number, vehicle_trailer_checklist, aerial_checklist,
       notes, aerial_notes, deficiency_corrected, mechanic_remarks, created_at
FROM public.dvir_reports
WHERE created_at >= NOW() - INTERVAL ':windowHours hours'
ORDER BY created_at DESC;
```

**Key Fields:**
- `vehicle_trailer_checklist`: JSONB - check for `false` or `"fail"` values
- `aerial_checklist`: JSONB - check for `false` or `"fail"` values
- `deficiency_corrected`: Indicates resolved issues

### 3. Equipment Inspections
```sql
SELECT id, user_id, equipment_type, equipment_number, general_checklist, 
       specific_checklist, notes, created_at
FROM public.daily_equipment_inspections
WHERE created_at >= NOW() - INTERVAL ':windowHours hours'
ORDER BY created_at DESC;
```

**Key Fields:**
- `general_checklist`: JSONB - check for `false`, `"fail"`, or `"no"` values
- `specific_checklist`: JSONB - check for `false`, `"fail"`, or `"no"` values
- `equipment_type`: Type of equipment inspected
- `equipment_number`: Equipment identifier

## Logic

### Step 1: Check Weekday
Only run Monday through Friday. Skip silently on weekends.

### Step 2: Fetch All Safety Data
Query all three tables in parallel for data within the time window.

### Step 3: Validate Minimum Data
If total submissions across all sources < `minSubmissions`, generate a "low data" notice instead.

### Step 4: Aggregate Trends
From **JSA**:
- Top hazards by frequency (count `true` values in `hazards_present`)
- Common PPE requirements (count `required: true` in `ppe`)
- Near-miss indicators (search `notes` for keywords)
- Weather conditions

From **DVIR**:
- Vehicle deficiency count
- Top vehicle/aerial issues (items marked `false` or `"fail"`)
- Truck numbers with issues

From **Equipment**:
- Equipment inspection issue count
- Top equipment issues by frequency
- Equipment types with most issues

### Step 5: Generate Announcement (LLM)
Use versioned prompt (v2) to generate announcement text synthesizing all data sources.

**Priority Order for Content:**
1. Near-misses (highest priority - safety-critical)
2. Equipment failures/deficiencies
3. Top hazards from JSA
4. PPE reminders
5. Weather considerations

### Step 6: Validate Grounding
Ensure all claims in the announcement can be traced to source data.
- No fabricated statistics
- No invented incidents
- All counts must match query results

### Step 7: Validate Character Limits
- Body must be <= 283 characters (target 238)
- Summary must be <= 240 characters
- Truncate intelligently if needed (prefer sentence/word boundaries)

### Step 8: Save to Announcements Table
Insert into `announcements` table with:
- `author`: "Safety AI"
- `title`: "Safety Briefing - {date}"
- `message`: Generated body text
- `date`: Today's date

### Step 9: Send Push Notification
Create notification event with:
- `category`: "safety_alert"
- `severity`: "high"
- `target_type`: "all"
- Dispatch to all users via push notification

## Output Format

```json
{
  "title": "Safety Briefing - January 11, 2026",
  "body": "26 safety reports filed. Top hazard: Falls (8). Vehicle issue: 2 brake light failures. Check fall protection and inspect brakes before departure. Stay alert!",
  "summary": "Top hazard: Falls (8 reports). 2 vehicle brake issues. Check fall protection and brakes.",
  "sections": {
    "overview": "Based on 26 submissions in the last 48 hours (18 JSAs, 5 DVIRs, 3 equipment inspections)",
    "topHazards": [
      { "hazard": "Falls from height", "count": 8, "note": "Check fall protection" },
      { "hazard": "Electrical contact", "count": 4, "note": "Maintain safe clearances" }
    ],
    "equipmentAlerts": [
      "2 trucks with brake light issues - verify before departure",
      "1 chipper chain tension needs adjustment"
    ],
    "ppeReminders": ["Hard hat required", "Safety glasses when operating equipment"],
    "expectations": [
      "Complete pre-work JSA before starting any task",
      "Inspect equipment before use",
      "Report any deficiencies immediately"
    ]
  },
  "metadata": {
    "windowStart": "2026-01-09T13:00:00Z",
    "windowEnd": "2026-01-11T13:00:00Z",
    "jsaCount": 18,
    "dvirCount": 5,
    "equipmentCount": 3,
    "totalSubmissions": 26,
    "nearMissCount": 1,
    "promptVersion": "v2",
    "model": "gpt-4o-mini",
    "generatedAt": "2026-01-11T13:05:00Z",
    "bodyCharCount": 158,
    "summaryCharCount": 82
  }
}
```

## Low Data Handling

When fewer than `minSubmissions` total submissions are available:

```json
{
  "title": "Safety Reminder - January 11, 2026",
  "body": "Limited safety data today (4 submissions). Standard reminder: Complete JSA before work. Inspect equipment. Wear required PPE. Report hazards immediately.",
  "summary": "Limited data today. Focus on standard safety: JSA, equipment checks, PPE.",
  "sections": {
    "overview": "Limited safety submissions in the last 48 hours (n=4)",
    "topHazards": [],
    "equipmentAlerts": [],
    "ppeReminders": [
      "Always wear required PPE for your task",
      "Inspect equipment before use"
    ],
    "expectations": [
      "Complete your JSA before starting work",
      "Use stop work authority when needed",
      "Report any unsafe conditions"
    ]
  }
}
```

## Error Handling

| Error | Action |
|-------|--------|
| Weekend day | Skip silently, return `{ status: 'skipped', reason: 'weekend' }` |
| Database connection failed | Log error, return failure status |
| OpenAI API failure | Log error, retry once, then fail gracefully |
| No data at all | Generate "no data" announcement with standard reminders |
| Character limit exceeded | Truncate at word/sentence boundary, log warning |

## Grounding Rules
See `directives/grounding_and_safety.md` for detailed rules.

**Key Principles:**
- Every claim must be traceable to source data
- No fabricated incidents or statistics
- No employee names or identifying details
- Acknowledge low data explicitly when applicable

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for announcement generation |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key for database access |
| `INTERNAL_SECRET` | No | For push notification dispatch |
| `TIMEZONE` | No | Default: America/Chicago |

## Supabase Edge Function

**Name:** `generate-safety-announcement`
**Deploy:** `supabase functions deploy generate-safety-announcement`

## Acceptance Criteria

- [x] Uses data from JSA, DVIR, and Equipment tables
- [x] Analyzes 48-hour window by default
- [x] Includes counts/evidence for all claims
- [x] **Body is <= 283 characters (target 238)**
- [x] **Summary is <= 240 characters**
- [x] Scheduled for 7 AM CST Monday-Friday
- [x] Skips weekends silently
- [x] Sends push notification to all users
- [x] Prompt version is recorded in metadata
- [x] Character counts are included in metadata
- [x] Low data handling with standard reminders

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2026-01-08 | Initial directive (JSA only) |
| v2 | 2026-01-11 | Multi-source (JSA + DVIR + Equipment), 7 AM schedule, 48h window |
