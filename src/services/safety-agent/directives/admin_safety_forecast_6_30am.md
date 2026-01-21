# Admin Safety Forecast Directive

## Goal

Generate a predictive risk intelligence email for leadership at 6:30 AM CST, Monday-Friday. This system moves from **summarizing the past** (daily safety announcements) to **predicting the next 24 hours** based on weather, crew composition, and equipment status.

## Trigger

- **Schedule**: `30 12 * * 1-5` (6:30 AM CST = 12:30 UTC, Mon-Fri)
- **Edge Function**: `admin-safety-forecast-cron`
- **Skip**: Weekends automatically (cron handles this)

## Inputs

### 1. Active Work Sites (Required)
- **Table**: `public.work_sites`
- **Filter**: `is_active = true`
- **Fields**: `id`, `name`, `latitude`, `longitude`, `region`
- **Purpose**: GPS coordinates for weather API calls

### 2. Today's Crew Assignments (Required)
- **Tables**: `public.job_progress_trackers` + `public.job_crew_assignments` + `public.app_users`
- **Join**: Jobs → Crew Assignments → App Users
- **Fields**: `user_id`, `full_name`, `hire_date`, `experience_level`, `work_site_id`
- **Purpose**: Calculate crew experience metrics per site

### 3. Employee Experience Data (Required)
- **Table**: `public.app_users`
- **Fields**: `hire_date`, `experience_level`
- **Calculations**:
  - `isNewHire`: `hire_date` within last 12 months
  - `hasExpert`: At least one crew member with `experience_level = 'expert'`

### 4. Open Equipment Defects (Required)
- **Table**: `public.vehicle_maintenance_log`
- **Filter**: `status != 'resolved'`
- **Purpose**: Equipment risk multiplier

### 5. Weather Forecasts (External API)
- **Service**: OpenWeatherMap One Call API 3.0
- **Input**: Latitude/longitude from work_sites
- **Output**: Wind gusts, heat index, precipitation probability, alerts
- **Window**: Next 8 hours (work shift)

## Execution Scripts

Execute in order:

1. **`getActiveWorkSites.ts`**
   - Query work_sites table for active sites
   - Return array of `{ id, name, latitude, longitude, region }`

2. **`getCrewAssignments.ts`**
   - For each site, get today's crew via job assignments
   - Calculate: `totalCount`, `newHireCount`, `hasExpert`
   - Default `experience_level='journeyman'` if `hire_date` is missing

3. **`getWeatherForecast.ts`**
   - Call OpenWeatherMap for each unique lat/lon
   - Calculate heat index using NWS formula
   - Extract max wind gust, precipitation prob for next 8 hours
   - Cache responses to avoid redundant API calls

4. **`getOpenDefects.ts`**
   - Query vehicle_maintenance_log for unresolved defects
   - Filter by trucks assigned to today's crews
   - Classify as 'critical' or 'warning' based on defect type

5. **`calculateRiskScore.ts`**
   - Input: Weather, crew, equipment, temporal factors
   - Output: Risk score (1.0-5.0) with level, drivers, recommendations
   - Multiplicative formula (each factor multiplies base score)

6. **`formatSafetyForecastEmail.ts`**
   - Generate HTML email body with:
     - Executive summary (overall risk level)
     - Site-by-site breakdown
     - Recommended actions per site
     - Company-wide factors
   - Include both text/plain and text/html parts

7. **`sendGmailSMTP.ts`** (reuse existing)
   - Send to `ADMIN_EMAIL_RECIPIENTS` environment variable
   - Subject format: `⚠️ [LEVEL] Safety Forecast - [Date]`

8. **`sendLeadershipPushNotifications.ts`**
   - Only if risk >= ELEVATED (score >= 2.0)
   - Target roles: `admin`, `general_foreman`, `safety_officer`
   - Use existing `admin-create-notification` Edge Function

## Risk Score Calculation

### Base Score: 1.0

### Weather Multipliers
| Condition | Multiplier | Notes |
|-----------|------------|-------|
| Wind gusts 25-30 mph | 1.2x | Moderate wind risk |
| Wind gusts >30 mph | 1.0 + (gust-25)*0.03 | Graduated scaling |
| Heat index 90-95°F | 1.15x | High heat |
| Heat index >95°F | 1.3x | Extreme heat |
| Precipitation >50% | 1.1x | Wet conditions |
| Active NWS alerts | 1.5x | Severe weather |

### Crew Multipliers
| Condition | Multiplier | Notes |
|-----------|------------|-------|
| New hire ratio >50% | 2.5x | High risk |
| New hire ratio 30-50% | 1.8x | Moderate risk |
| No expert on crew (>2 people) | 1.3x | Lack of supervision |

### Equipment Multipliers
| Condition | Multiplier | Notes |
|-----------|------------|-------|
| Critical defects present | 1.0 + (count * 0.2) | Per critical defect |
| Warning defects only | 1.0 + (count * 0.05) | Per warning defect |

### Temporal Multipliers
| Condition | Multiplier | Notes |
|-----------|------------|-------|
| Monday | 1.1x | "Monday effect" |
| Day after holiday | 1.15x | Re-entry risk |

### Risk Levels
| Score Range | Level | Action Required |
|-------------|-------|-----------------|
| 1.0 - 1.4 | LOW | Standard operations |
| 1.5 - 1.9 | MODERATE | Verbal reminder at briefing |
| 2.0 - 2.4 | ELEVATED | Extra supervision + push notification |
| 2.5 - 3.4 | HIGH | Safety officer presence required |
| 3.5 - 5.0 | CRITICAL | Consider postponing work |

## Output

### 1. Email
- **Recipients**: `ADMIN_EMAIL_RECIPIENTS` env var (comma-separated)
- **From**: `GMAIL_USER` env var
- **Subject**: `⚠️ [LEVEL] Safety Forecast - [YYYY-MM-DD]`
- **Format**: Multipart (text/plain + text/html)

### 2. Push Notifications (Conditional)
- **Trigger**: Only if overall risk >= ELEVATED (2.0)
- **Target Roles**: `admin`, `general_foreman`, `safety_officer`
- **Category**: `safety_alert`
- **Severity**: Maps to risk level

### 3. Audit Log
- **Table**: `public.compliance_runs`
- **Type**: `'safety_forecast'`
- **Metadata**: Site count, max risk score, timestamp

## Edge Cases

### No Active Work Sites
- Send simplified email: "No active job sites scheduled for today"
- Still log the run in compliance_runs
- No push notifications

### Weather API Failure
- Use cached forecast from previous day if available
- Add warning banner to email: "⚠️ Weather data may be outdated"
- Log error but don't fail entire run
- Default weather multiplier to 1.0

### Missing hire_date for Employee
- Default to `experience_level='journeyman'` for risk calculation
- Log warning for admin review
- Include note in email: "X employees have missing experience data"

### Empty Crew for Site
- Skip site in risk calculation
- Note in email: "No crew assigned to [Site Name]"

### Weekend Execution (Manual Trigger)
- Allow execution but add banner: "Weekend forecast - verify crew assignments"

## Environment Variables

```bash
# Required
OPENWEATHER_API_KEY=your_api_key_here
GMAIL_USER=allterraintreeservice.po@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
ADMIN_EMAIL_RECIPIENTS=bradenleetabor@gmail.com,shane@alltts.com,dusty@alltts.com,mike@alltts.com,steve@alltts.com,brandon@alltts.com

# Optional
SAFETY_FORECAST_DRY_RUN=false  # Set to true to skip email/notifications
```

## Acceptance Criteria

1. ✅ Email delivered by 6:30 AM CST ±2 minutes
2. ✅ Risk scores are reproducible (deterministic given same inputs)
3. ✅ No invented weather data (must come from API or be marked "unavailable")
4. ✅ Push notifications sent only when risk >= ELEVATED
5. ✅ All runs logged in compliance_runs table
6. ✅ Email includes both text/plain and text/html parts
7. ✅ No employee names in push notifications (privacy)
8. ✅ Weather API calls cached to avoid redundant requests

## Testing

### Unit Tests
- `calculateRiskScore.test.ts` - Test all multiplier combinations
- `getWeatherForecast.test.ts` - Mock API responses, test heat index formula
- `formatSafetyForecastEmail.test.ts` - Test HTML/text generation

### Integration Tests
- Run with `dryRun: true` to verify full flow without sending
- Test with various scenarios:
  - No work sites
  - High-risk weather conditions
  - Crew with all new hires
  - Multiple critical defects

## Related Directives
- `daily_announcement.md` - Morning safety announcements (different purpose)
- `admin_compliance_summary_9am.md` - 9 AM compliance check
- `grounding_and_safety.md` - Data grounding rules
