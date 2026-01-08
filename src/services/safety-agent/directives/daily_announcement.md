# Directive: Daily Safety Announcement

> **Status**: STUB - LLM integration not yet implemented

## Purpose
Generate a daily safety announcement based on recent JSA (Job Safety Analysis) submissions. The announcement should be grounded in actual data and highlight trends, hazards, and PPE reminders.

## CRITICAL: Character Limits

The announcement body text has strict character limits:

| Field | Target | Maximum | Notes |
|-------|--------|---------|-------|
| `body` | **238 chars** | **283 chars** | NEVER exceed max. Includes spaces/punctuation. |
| `summary` | N/A | **240 chars** | For push notifications and SMS |

These limits are enforced programmatically via `validateBodyLength()` and `validateSummaryLength()`.

## Trigger
- **Scheduled**: Daily (time TBD, likely morning)
- **Manual**: On-demand generation

## Required Inputs
| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `windowHours` | number | 24 | Hours to look back for JSA submissions |
| `minSubmissions` | number | 3 | Minimum JSAs required to generate announcement |
| `mode` | string | "draft" | "draft" or "auto_publish" |

## Data Sources

### JSA Submissions
```sql
SELECT *
FROM public.daily_jsa
WHERE created_at >= NOW() - INTERVAL ':windowHours hours'
ORDER BY created_at DESC;
```

## Logic (Planned)

### Step 1: Fetch Recent JSAs
Query for JSAs within the time window.

### Step 2: Validate Minimum Data
If submissions < `minSubmissions`, generate a "low data" notice instead.

### Step 3: Aggregate Trends
- Top hazards by frequency
- Common PPE requirements
- Near-miss indicators
- Job types represented

### Step 4: Generate Announcement (LLM)
Use versioned prompt to generate announcement text.

### Step 5: Validate Grounding
Ensure all claims in the announcement can be traced to source data.

### Step 6: Save as Draft
Insert into announcements table with status "draft".

### Step 7: Optional Auto-Publish
If mode is "auto_publish", change status to "published" and notify.

## Output Format

```json
{
  "title": "Safety Update - January 8, 2026",
  "body": "15 JSAs filed. Top hazard: Falls (7). Check fall protection before climbing. Cold today—watch for ice. Stay alert, wear PPE.",
  "summary": "Top hazards: falls, electrical. Wear hard hats and safety glasses.",
  "sections": {
    "overview": "...",
    "topHazards": [...],
    "ppeReminders": [...],
    "expectations": [...]
  },
  "metadata": {
    "windowStart": "2026-01-07T09:00:00Z",
    "windowEnd": "2026-01-08T09:00:00Z",
    "jsaCount": 15,
    "promptVersion": "v1",
    "generatedAt": "2026-01-08T09:05:00Z",
    "bodyCharCount": 127,
    "summaryCharCount": 72
  }
}
```

**Note**: The `body` above is 127 characters—well within the 238 target and 283 max limit.

## Grounding Rules
See `directives/grounding_and_safety.md` for detailed rules.

## Acceptance Criteria
- [ ] Only uses data from JSA submissions (no fabrication)
- [ ] Includes counts/evidence for all claims
- [ ] **Body is <= 283 characters (target 238)**
- [ ] **Summary is <= 240 characters**
- [ ] Draft mode does not auto-publish
- [ ] Prompt version is recorded
- [ ] Character counts are included in metadata

