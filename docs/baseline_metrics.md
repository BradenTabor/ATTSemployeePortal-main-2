# Baseline Metrics for Smart Form Defaults

> **Status**: PENDING - Awaiting 7-14 days of data collection
> **Collection Period**: TBD (Start date: TBD)

## Purpose

This document tracks baseline form completion metrics BEFORE the Smart Form Defaults feature is enabled. These metrics are essential for proving ROI after launch.

## Metrics to Collect

### DVIR Form
| Metric | Baseline Value | Target | Notes |
|--------|---------------|--------|-------|
| Median completion time (p50) | TBD | -30% | Time from form_started to form_submitted |
| 90th percentile time (p90) | TBD | -25% | Captures slower completions |
| Daily submission volume | TBD | Maintain | Should not decrease |
| Error rate | TBD | -10% | form_submit_error / total attempts |

### JSA Form
| Metric | Baseline Value | Target | Notes |
|--------|---------------|--------|-------|
| Median completion time (p50) | TBD | -30% | Time from form_started to form_submitted |
| 90th percentile time (p90) | TBD | -25% | Captures slower completions |
| Daily submission volume | TBD | Maintain | Should not decrease |
| Error rate | TBD | -10% | form_submit_error / total attempts |

## Data Collection Query

```sql
-- Run this query after 7-14 days of telemetry collection
-- to establish baseline metrics

-- DVIR Baseline
SELECT 
  'dvir' as form_type,
  COUNT(*) as total_submissions,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_seconds) as p50_seconds,
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY duration_seconds) as p90_seconds,
  AVG(duration_seconds) as avg_seconds
FROM telemetry_events
WHERE event_name = 'form_submitted'
  AND payload->>'form_type' = 'dvir'
  AND created_at >= NOW() - INTERVAL '14 days';

-- JSA Baseline
SELECT 
  'jsa' as form_type,
  COUNT(*) as total_submissions,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_seconds) as p50_seconds,
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY duration_seconds) as p90_seconds,
  AVG(duration_seconds) as avg_seconds
FROM telemetry_events
WHERE event_name = 'form_submitted'
  AND payload->>'form_type' = 'jsa'
  AND created_at >= NOW() - INTERVAL '14 days';
```

## Sample Size Requirements

- **Minimum**: 100 DVIR submissions, 100 JSA submissions
- **Recommended**: 200+ of each for statistical significance
- **Collection Period**: 7-14 days (weekdays only for JSA)

## Telemetry Events Being Collected

The following events are now being logged in DVIR and JSA forms:

1. **form_started** - When user opens the form
   - `form_type`: 'dvir' | 'jsa'
   - `timestamp`: ISO string

2. **form_submitted** - When form is successfully submitted
   - `form_type`: 'dvir' | 'jsa'
   - `duration_seconds`: Time from start to submit
   - `smart_defaults_shown`: Boolean (will be false during baseline)
   - `timestamp`: ISO string

3. **form_submit_error** - When submission fails (if applicable)
   - `form_type`: 'dvir' | 'jsa'
   - `error_code`: Error identifier
   - `timestamp`: ISO string

## Post-Launch Comparison

After Smart Defaults is enabled, compare:

```sql
-- Compare baseline vs post-launch
WITH baseline AS (
  SELECT 
    payload->>'form_type' as form_type,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (payload->>'duration_seconds')::int) as p50
  FROM telemetry_events
  WHERE event_name = 'form_submitted'
    AND created_at BETWEEN '[BASELINE_START]' AND '[BASELINE_END]'
  GROUP BY payload->>'form_type'
),
post_launch AS (
  SELECT 
    payload->>'form_type' as form_type,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (payload->>'duration_seconds')::int) as p50
  FROM telemetry_events
  WHERE event_name = 'form_submitted'
    AND created_at >= '[LAUNCH_DATE]'
  GROUP BY payload->>'form_type'
)
SELECT 
  b.form_type,
  b.p50 as baseline_p50,
  p.p50 as post_launch_p50,
  ROUND(((b.p50 - p.p50) / b.p50 * 100)::numeric, 1) as improvement_pct
FROM baseline b
JOIN post_launch p ON b.form_type = p.form_type;
```

## ROI Calculation

After sufficient post-launch data:

```
Time Saved Per Form = Baseline p50 - Post-Launch p50
Daily Time Saved = Time Saved Per Form × Daily Submissions
Monthly Time Saved = Daily Time Saved × 22 (working days)

If 50 forms/day and 2 minutes saved per form:
Monthly Time Saved = 2 × 50 × 22 = 2,200 minutes = ~37 hours/month
```

## Acceptance Criteria

- [ ] Telemetry deployed to production
- [ ] 7+ days of data collected
- [ ] 100+ DVIR submissions recorded
- [ ] 100+ JSA submissions recorded
- [ ] Baseline values documented in this file
- [ ] ROI targets set based on baseline

---

*This document will be updated with actual values once baseline data collection is complete.*
