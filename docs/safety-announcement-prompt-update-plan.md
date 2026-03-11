# Update Safety Announcement System Prompt (revised)

## Where the prompt lives

- **[supabase/functions/generate-safety-announcement/prompts.ts](supabase/functions/generate-safety-announcement/prompts.ts)** — defines `SYSTEM_PROMPT`. The current prompt starts with "You are a caring safety communication assistant" and uses `BODY_TARGET_CHARS` / `BODY_MAX_CHARS` from config.
- **[supabase/functions/generate-safety-announcement/index.ts](supabase/functions/generate-safety-announcement/index.ts)** — builds `systemPromptFull` by appending `cfgCustomPrompt` (admin `custom_prompt_instructions`) after `SYSTEM_PROMPT`. No changes to index.ts for the prompt itself.

---

## Implementation steps

### 1. Replace `SYSTEM_PROMPT` in prompts.ts

- Replace the entire `SYSTEM_PROMPT` template literal with the revised prompt text from the task.
- **Input format bridging:** The new prompt describes input as a "JSON object" (near_misses, weather, equipment_issues). The actual user message is **labeled prose** (e.g. "=== CONTEXT DATA ===", "Top Hazards Identified:", "Near-misses reported:", "Weather conditions:", "Vehicle/Equipment Issues:"). Add a short bridging line so the model is not told one format and given another. Insert immediately after the "INPUT FORMAT" section (or at the end of it):

  **"Note: input may arrive as structured JSON or as labeled prose sections (e.g. Top Hazards, Near-misses, Weather conditions, Vehicle/Equipment Issues). Apply the same rules regardless of format."**

- **Character range vs config:** The new prompt hardcodes **230–280** characters. Config has `BODY_TARGET_CHARS = 238`, `BODY_MAX_CHARS = 283`. Two options:
  - **A. Interpolation:** Keep importing config and use `` `${BODY_TARGET_CHARS}–${BODY_MAX_CHARS}` `` in the prompt wherever the character range is specified. That keeps the prompt in sync if `body_max_chars` is later changed via app_settings. Downside: range becomes 238–283, not 230–280.
  - **B. Decouple (recommended):** Keep the prompt text as **230–280** (product intent). Remove the config import from prompts.ts (no longer needed). Add a comment above `SYSTEM_PROMPT`: **"Character range 230–280 is intentional and decoupled from config.ts/app_settings; update this prompt manually if body limits change."** Index.ts continues to use `cfgBodyMaxChars` for truncation/validation only.

- **Version comment:** Use a grep-friendly, dated comment above `SYSTEM_PROMPT`, e.g.  
  **`// SYSTEM PROMPT v4 — 2026-03-10 — 230-280 chars, no stats, JSON output with message_length`**

### 2. Config import in prompts.ts

- **Verified:** Only `BODY_TARGET_CHARS` and `BODY_MAX_CHARS` are used in prompts.ts (grep). After replacing the prompt, if you choose option B (decouple), remove the entire `import { BODY_TARGET_CHARS, BODY_MAX_CHARS } from './config.ts';` line. If you choose option A (interpolation), keep the import and use those constants in the new prompt text.

### 3. Leave index.ts unchanged

- Custom instructions append and title handling stay as-is. No code changes.

### 4. message_length in response

- **Verified:** Response is parsed with `JSON.parse(completion.choices[0].message.content || '{}')` — no schema or strict typing. Extra keys like `message_length` are ignored; only `generated.message` and `generated.title` are read. No parser change needed.

### 5. Do not change

- Data fetching, aggregation, user prompt construction, response handling (except prompt content), notification, cron.

---

## Verification (after applying)

| Check | How |
|-------|-----|
| Prompt fully replaced | No leftover "You are a caring safety communication assistant" or old v3 wording. |
| Bridging line present | "Note: input may arrive as structured JSON or labeled prose..." (or equivalent) appears in SYSTEM_PROMPT. |
| Custom instructions append | index.ts still builds `systemPromptFull` with `cfgCustomPrompt` after SYSTEM_PROMPT. |
| Config vs range | If decoupled: comment in prompts.ts documents 230–280 vs config. If interpolated: prompt uses config constants. |
| Version comment | Grep for "SYSTEM PROMPT v4" or "2026-03-10" finds the prompt block. |
| Compile / types | Typecheck/lint passes; no errors from prompts.ts or index.ts. |
