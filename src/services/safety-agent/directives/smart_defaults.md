# Directive: Smart Form Defaults

## Goal

When a user opens a safety form (JSA, DVIR, or Equipment Inspection), pre-populate fields with intelligent defaults derived from that user's recent submissions. When multiple candidate values tie in frequency, use AI only for tie-breaking; never send contact (PII) fields to the LLM.

## Inputs

- **User context**: Authenticated user ID (and optionally date/location if used for filtering).
- **Form type**: `jsa` | `dvir` | `equipment`.
- **Environment**: `OPENAI_API_KEY` (optional; if missing, use deterministic defaults only), `SUPABASE_URL`, user session for RLS.

## Tools / Scripts

- **Candidates**: `src/services/safety-agent/execution/getSmartDefaultsCandidates.ts`
  - Fetches recent submissions for the user and form type, extracts candidate values per field with frequency and last-used.
- **Tie-breaking**: `execution/generateSmartDefaults.ts`
  - When a field has multiple candidates with same frequency, calls LLM to choose one (with brief reason); contact fields use recency fallback only, no AI.
- **Validation**: `execution/validateSmartDefaults.ts`
  - Validates AI response (only allowed values, types) and merges with deterministic suggestions.
- **Contact fields**: `lib/contactFields.ts` – list of fields that must never be sent to AI (recency fallback only).

## Outputs

- **UI**: Form state pre-filled with `suggestions` keyed by field name; user can change any value.
- **Metadata**: Optional `method: 'deterministic' | 'ai_assisted'`, `warnings`, and counts (submissions analyzed, AI calls) for logging/debugging.

## Business Rules

1. **No PII to LLM**: Contact fields (e.g. supervisor, safety contact) are never sent to OpenAI; use recency-based default only.
2. **Only from candidates**: AI may only choose among provided candidate values; never invent new values.
3. **Deterministic first**: If a single value has highest frequency, use it without calling AI.
4. **Validation**: All AI suggestions must be validated against allowed values/types before applying to form.

## Edge Cases

- **No recent submissions**: Return empty suggestions or sensible global defaults; do not call AI.
- **OpenAI unavailable or disabled**: Fall back to deterministic only (e.g. most frequent or most recent).
- **Invalid AI response**: Discard that field's AI suggestion and use deterministic or leave blank.
- **Rate limits**: If many users load forms at once, consider caching or debouncing AI calls per user/form type.

## Acceptance Criteria

- [ ] Deterministic defaults applied from user's recent submissions.
- [ ] AI used only for tie-breaking; contact fields never sent to LLM.
- [ ] All suggestions validated before pre-fill.
- [ ] Form still editable; defaults do not override user's current draft when recovering from persistence.
