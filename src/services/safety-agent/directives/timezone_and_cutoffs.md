# Directive: Timezone and Cutoff Handling

## Purpose
Define how dates, times, and cutoffs are handled throughout the safety-agent module to ensure consistent behavior across time zones and DST transitions.

## Primary Timezone
**America/Chicago (Central Time)**

All user-facing times and business logic use Central Time:
- 9:00 AM cutoff for compliance
- Daily boundaries for form submissions
- Report dates for DVIR and equipment inspections

## Database Storage

### Timestamps (timestamptz)
- Stored in UTC
- PostgreSQL handles conversion automatically
- Example: `created_at`, `cutoff_time`, `sent_at`

### Dates (date)
- Stored as date without timezone
- Should represent the "business day" in Central Time
- Example: `date_for`, `report_date`, `inspection_date`

## Cutoff Calculation

### Problem
We need to compare `created_at` (UTC timestamp) against a local time cutoff.

### Solution
Convert the local cutoff to UTC before comparison:

```typescript
// Goal: Find submissions before 9:00 AM Chicago on 2026-01-08

// Step 1: Build local datetime
const localDateTime = "2026-01-08T09:00:00";

// Step 2: Convert to UTC (accounting for CST = UTC-6 or CDT = UTC-5)
const cutoffUtc = buildCutoffTimestamp("2026-01-08", "09:00", "America/Chicago");
// Result: 2026-01-08T15:00:00.000Z (in CST) or 2026-01-08T14:00:00.000Z (in CDT)

// Step 3: Query
SELECT * FROM dvir_reports
WHERE report_date = '2026-01-08'
  AND created_at < '2026-01-08T15:00:00.000Z';
```

## DST Considerations

### Chicago Timezone Offset
- Standard Time (CST): UTC-6
- Daylight Time (CDT): UTC-5

### DST Transitions (2026)
- Spring Forward: March 8, 2026 at 2:00 AM → 3:00 AM
- Fall Back: November 1, 2026 at 2:00 AM → 1:00 AM

### Handling Strategy
1. Always use IANA timezone identifier (`America/Chicago`)
2. Let Intl.DateTimeFormat handle DST calculations
3. Never hardcode UTC offsets
4. Store business dates as `date` type, not derived from UTC

## Date Resolution

### "Today" in Central Time
```typescript
function getTodayInTimezone(timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date()); // Returns YYYY-MM-DD
}
```

### Why This Matters
A request at 11:00 PM Chicago time (5:00 AM UTC next day) should still use the Chicago date, not the UTC date.

## Common Pitfalls

### ❌ Don't Do This
```typescript
// Wrong: Hardcoded offset
const cutoff = new Date(`${dateFor}T09:00:00-06:00`);

// Wrong: Ignoring timezone
const today = new Date().toISOString().split('T')[0];

// Wrong: Assuming server timezone
const localDate = new Date().toLocaleDateString();
```

### ✅ Do This
```typescript
// Correct: Use timezone-aware functions
const cutoff = buildCutoffTimestamp(dateFor, "09:00", "America/Chicago");
const today = getTodayInTimezone("America/Chicago");
```

## Testing Edge Cases

1. **DST Transition Days**: Test March 8 and November 1
2. **Midnight Boundary**: Test 11:00 PM to 1:00 AM Chicago
3. **Early Morning UTC**: Test when UTC date differs from Chicago date

