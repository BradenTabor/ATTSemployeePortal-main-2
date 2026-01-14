# Directive: Smart Form Defaults (AI-Assisted)

> **Status**: ACTIVE - On-demand via Edge Function
> **Version**: v1.0.0
> **Created**: 2026-01-15

## Purpose

Suggest safe, non-critical default values for repetitive form fields in DVIR and Daily JSA forms using:
1. **Deterministic history** (last used / most frequent values)
2. **Optional AI tie-breaking** (only when candidates are ambiguous)

Goals:
- Reduce form completion time by ~30%
- Reduce data entry errors
- Maintain user control (suggestions are optional, never auto-applied)

## Trigger

- **On-demand**: When user opens DVIR or JSA form
- **Endpoint**: `GET /functions/v1/get-smart-defaults`
- **Input**: `{ form_type: 'dvir' | 'jsa' }`

## Eligible Fields

### DVIR Form Fields (Allowlist)
| Field | Type | Notes |
|-------|------|-------|
| `truck_number` | string | Equipment identifier |
| `chipper_number` | string | Equipment identifier |
| `trailer_number` | string | Equipment identifier |
| `truck_gvwr` | string | Vehicle weight rating |
| `trailer_chipper_gvwr` | string | Trailer weight rating |
| `medical_card_required` | boolean | YES/NO |
| `has_medical_card` | boolean | YES/NO |
| `copy_of_registration` | boolean | YES/NO |
| `copy_of_insurance` | boolean | YES/NO |

### JSA Form Fields (Allowlist)
| Field | Type | Notes |
|-------|------|-------|
| `work_location` | string | Job site location |
| `circuit_number` | string | Electrical circuit |
| `nearest_hospital` | string | Emergency facility |
| `nearest_clinic` | string | Emergency facility |
| `oc_contact` | string | **CONTACT FIELD** - Never send to AI |
| `doc_contact` | string | **CONTACT FIELD** - Never send to AI |
| `gf_contact` | string | **CONTACT FIELD** - Never send to AI |
| `safety_contact` | string | **CONTACT FIELD** - Never send to AI |

### FORBIDDEN Fields (Never Suggest)
These fields are explicitly excluded from suggestions:
- `hazards_present` - Safety-critical, requires real-time assessment
- `ppe` - Safety-critical, varies by job
- `weather_conditions` - Real-time data
- `vehicle_trailer_checklist` - Requires actual inspection
- `aerial_checklist` - Requires actual inspection
- `notes` / `aerial_notes` - User-written content
- `signatures` - Legal requirement
- `photos` - Evidence requirement
- `mileage` - Changes daily

## Data Sources

### Query: User Submission History
```sql
-- DVIR History
SELECT truck_number, chipper_number, trailer_number, truck_gvwr,
       trailer_chipper_gvwr, medical_card_required, has_medical_card,
       copy_of_registration, copy_of_insurance, created_at
FROM public.dvir_reports
WHERE user_id = :userId
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 50;

-- JSA History
SELECT work_location, circuit_number, nearest_hospital, nearest_clinic,
       oc_contact, doc_contact, gf_contact, safety_contact, created_at
FROM public.daily_jsa
WHERE user_id = :userId
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 50;
```

## Privacy Boundaries

### Allowed in AI Prompts
- Truck/trailer/chipper numbers (operational identifiers)
- Location names (work sites, hospitals, clinics)
- Circuit numbers (operational identifiers)
- Aggregated frequency counts
- Recency information (days ago)

### FORBIDDEN in AI Prompts
- **Contact person names** (oc_contact, doc_contact, gf_contact, safety_contact)
- User names or emails
- Notes/comments (user-written text)
- Signatures (never)
- Photos (never)
- Checklist details (P/F values)

### Contact Field Handling
Contact fields must NEVER be sent to OpenAI. Instead:
1. Use deterministic recency fallback (most recently used value)
2. If tie exists, pick the first candidate (most recent)
3. Mark confidence as 'low' for contact suggestions

## Confidence Calculation

| Level | Threshold | Description | UX Behavior |
|-------|-----------|-------------|-------------|
| **High** | ≥80% | Value appears in 80%+ of last 7 submissions | Green indicator |
| **Medium** | 50-79% | Value appears in 50-79% of submissions | Blue indicator |
| **Low** | <50% | Value appears in <50% OR AI tie-break used | Gray indicator |

### Formula
```typescript
const percentage = (candidateCount / totalSubmissions) * 100;
if (percentage >= 80) return 'high';
if (percentage >= 50) return 'medium';
return 'low';
```

## AI Tie-Break Logic

### When AI is Called
AI is ONLY called when:
1. Deterministic analysis finds a tie (2+ candidates with equal frequency)
2. The field is NOT a contact field
3. DRY_RUN mode is disabled

### AI System Prompt
```
You are a form default selector for a tree service company employee portal.
Your task is to select the best default value when multiple candidates have equal frequency.

Rules:
1. ONLY select from the provided candidates (never invent new values)
2. Prefer more recent usage over older usage
3. Provide a brief, factual reason (max 10 words)
4. Return JSON only

Format: { "field": "field_name", "value": "selected_value", "reason": "brief explanation" }
```

### AI User Prompt Template
```
Field: {field_name}
Candidates:
- {value1}: Used {count1}x (most recent: {days1} days ago)
- {value2}: Used {count2}x (most recent: {days2} days ago)

Select the best default value.
```

### AI Response Validation
After receiving AI response:
1. Parse JSON response
2. Verify `value` exists in original candidate list
3. If validation fails → return null (no suggestion for this field)
4. If validation passes → use AI suggestion with source='ai_tiebreak'

## Output Schema

```typescript
interface SmartDefaultsResponse {
  suggestions: {
    [fieldName: string]: {
      value: string | boolean;
      reason: string;
      confidence: 'high' | 'medium' | 'low';
      source: 'frequency' | 'recency' | 'ai_tiebreak';
    };
  };
  method: 'deterministic' | 'ai_assisted' | 'disabled' | 'error';
  warnings?: string[];
  meta: {
    submissions_analyzed: number;
    processing_time_ms: number;
    from_cache?: boolean;
    logic_version?: string;
  };
}
```

## Fallback Behavior

| Scenario | Behavior |
|----------|----------|
| No prior submissions | Return empty suggestions, no error |
| OpenAI API failure | Fall back to deterministic-only |
| Schema validation failure | Fall back to deterministic-only |
| Rate limit exceeded | Return cached response or empty |
| Feature disabled | Return `{ method: 'disabled' }` |

## Caching Strategy

### Response Cache (Deno KV)
- **Key**: `smart_defaults:{user_id}:{form_type}:{date}`
- **TTL**: 1 hour
- **Rationale**: User unlikely to change trucks mid-day

### Cache Invalidation
- Short TTL approach (1 hour) - no explicit invalidation needed
- New form submission doesn't immediately invalidate (acceptable for MVP)

## Rate Limiting

- **Limit**: 10 requests per user per hour
- **Storage**: Deno KV with 1-hour expiry
- **Response**: HTTP 429 if exceeded

## Telemetry Events

| Event | When | Payload |
|-------|------|---------|
| `smart_defaults_shown` | Panel displayed | form_type, suggestion_count, method |
| `smart_defaults_applied_field` | Single field applied | form_type, field_name, confidence |
| `smart_defaults_applied_all` | Apply All clicked | form_type, fields_applied |
| `smart_defaults_dismissed` | Panel dismissed | form_type, suggestions_count, applied_count |
| `smart_defaults_fetch_failed` | API error | form_type, error |

## User Notification Behavior

### Toast Notification
When suggestions load successfully:
- **Toast appears**: "Smart Suggestions Ready" with count (e.g., "5 field suggestions available")
- **Position**: Bottom-right corner (app default)
- **Duration**: 4 seconds (app default)
- **Condition**: Only shown if suggestions exist (not on empty response)

### Scroll-to-Panel
After suggestions load:
- Page automatically scrolls to `#smart-defaults-panel`
- Uses smooth scroll behavior
- 300ms delay to allow panel animation to complete
- Ensures users who scrolled down don't miss suggestions

### Silent Failures
On API error or empty response:
- No toast shown (avoid disrupting form UX)
- Form continues to work normally
- Error logged to telemetry for debugging

## Feature Flag

### Environment Variable
```bash
SMART_DEFAULTS_ENABLED=true  # Set to 'false' to disable
DRY_RUN=false                # Set to 'true' to skip AI calls
```

### Kill Switch
If issues arise in production:
1. Set `SMART_DEFAULTS_ENABLED=false` in Supabase secrets
2. Edge Function returns `{ method: 'disabled' }` immediately
3. Frontend shows no suggestions panel
4. No user disruption - forms work normally

## Rollback Triggers

Monitor these metrics daily:
- Form submission rate drops >20% from baseline → Investigate
- Error rate increases >10% from baseline → Disable feature
- OpenAI costs exceed $50/day → Disable AI tie-breaker, use deterministic only
- Suggestion acceptance rate <30% → UX issue, iterate on panel design

## Error Handling

| Error | Action |
|-------|--------|
| Database connection failed | Log error, return empty suggestions |
| OpenAI API failure | Log error, fall back to deterministic |
| Invalid form_type | Return HTTP 400 |
| Unauthorized | Return HTTP 401 |
| Rate limited | Return HTTP 429 |
| Schema validation failed | Log warning, skip invalid field |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | For AI tie-breaking |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key |
| `SMART_DEFAULTS_ENABLED` | No | Default: true |
| `DRY_RUN` | No | Default: false |

## Acceptance Criteria

- [x] Uses only allowlisted fields (no hazards, checklists, signatures)
- [x] Server-side only AI calls (no client key exposure)
- [x] Deterministic-first (AI only for ties)
- [x] Contact fields never sent to AI
- [x] JSON schema validation for AI output
- [x] Fallback on schema failure
- [x] Telemetry events implemented
- [x] Feature flag implemented
- [x] Rate limiting active
- [x] Caching implemented
- [ ] Baseline metrics collected (Phase 0)
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Phased rollout executed

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0.0 | 2026-01-15 | Initial directive |
