# Directive: Weekly Safety Trends Report

> **Status**: STUB - Not yet implemented

## Purpose
Generate a weekly safety trends report comparing hazard patterns week-over-week to identify emerging risks and areas for improvement.

## Trigger
- **Scheduled**: Weekly (Monday morning recommended)
- **Manual**: On-demand generation with custom date range

## Required Inputs
| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `weekEndDate` | string (YYYY-MM-DD) | Last Sunday | End of the week to analyze |
| `compareWeeks` | number | 2 | Number of weeks to compare |

## Data Sources

### JSA Submissions by Week
```sql
SELECT 
  date_trunc('week', created_at) as week,
  COUNT(*) as jsa_count,
  -- Aggregate hazard fields
  -- Aggregate PPE fields
  -- Count near-misses
FROM public.daily_jsa
WHERE created_at >= :startDate
GROUP BY date_trunc('week', created_at)
ORDER BY week DESC;
```

## Planned Analysis

### Week-over-Week Deltas
- Hazard frequency changes
- New hazards appearing
- PPE compliance trends
- Near-miss patterns

### Segmentation (Future)
- By job type
- By crew
- By location

## Output Format (Planned)

```json
{
  "title": "Weekly Safety Trends - Week of Jan 6, 2026",
  "period": {
    "currentWeek": "2026-01-06 to 2026-01-12",
    "previousWeek": "2025-12-30 to 2026-01-05"
  },
  "summary": "JSA submissions up 15%. Falls remain top hazard.",
  "trends": [
    {
      "hazard": "Falls from height",
      "currentCount": 12,
      "previousCount": 8,
      "change": "+50%",
      "trend": "increasing"
    }
  ],
  "focusAreas": [
    "Review fall protection procedures",
    "Conduct ladder safety toolbox talk"
  ]
}
```

## Acceptance Criteria
- [ ] Compares at least 2 weeks
- [ ] Highlights significant changes (>20%)
- [ ] Provides actionable focus areas
- [ ] All statistics grounded in data

