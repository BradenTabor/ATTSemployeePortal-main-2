---
name: safety-briefing-ui
description: >-
  Build or revise the ATTS daily safety briefing — the mandatory morning
  muster for field roles. Use when changing SafetyBriefingPage, briefing
  questions, quiz feedback, personalization, streak/crew cards, or
  briefing design tokens. Also use when adding a knowledge-check flow
  to any safety ritual.
---

# Safety briefing UI

The briefing is a **four-step morning muster**, not a scroll-and-tap form.

`Today` → `You` → `Check` → `Go`

Workers cannot skip a step. Knowledge questions lock, reveal the correct
answer, and show why it matters. Check-in questions coach. Raw JSA keys
never reach the screen.

## File map

| Layer | Path |
|---|---|
| Page (thin) | `src/pages/SafetyBriefingPage.tsx` |
| Steps + chrome | `src/components/briefing/` |
| Domain (testable) | `src/lib/briefing/` |
| Question pool | `src/config/safetyBriefing.ts` |
| Data | `src/hooks/useSafetyBriefing.ts` |
| Guard | `src/components/SafetyBriefingGuard.tsx` |
| Tokens | `src/lib/briefing/tokens.ts` |
| Copy | `src/lib/briefing/copy.ts` |

Do not put new briefing strings in JSX. Add them to `copy.ts`.
Do not put new question logic in the page. Add it to `buildBriefing.ts`.

## Rules that already burned us

1. **Never use `type-display` or `type-instrument` on this page.** Fraunces WONK + wide tracking produced ghosted, doubled letters on phones. Use `briefing.title` / `briefing.label`. Do not uppercase-track labels.
2. **Never dump snake_case.** `humanizeBriefingLabel('line_clearances_signed')` → "Line clearances needed and signed".
3. **Knowledge questions must have `correctOptionId` + `explanation`.** If they do not teach, they are a check-in.
4. **Reveal immediately.** Lock options on tap. Show correct (green) and wrong (red). Do not wait until submit.
5. **Personalize from real data.** Role card, cert days-left, recent JSA hazards, weather, crew. Fallback copy is a last resort, not the default.
6. **Stay on Canopy tokens.** `glass.*`, `ink` / `bone` / `verdant`. No `type-display`. No new hex in components. No custom font imports.
7. **Motion budget 200ms.** `useReducedMotion` on every `motion.*`. Resting CSS is the finished state — do not hide content at `opacity: 0` without JS.
8. **Touch targets ≥ 44px.** Field workers wear gloves.

## Adding a question

```ts
{
  id: 'ts-13',
  category: 'tree_safety',
  kind: 'knowledge',
  text: '…',
  options: [/* 4 */],
  correctOptionId: 'ts-13-a',
  explanation: 'What to do differently on the site.',
  standardRef: 'ANSI Z133',
  roles: ['mechanic'], // optional
}
```

Check-ins use `kind: 'checkin'` and `coaching: { 'ph-x-c': 'Tell your foreman…' }`.

A live announcement question is generated from today's `topHazards` / PPE / heat when that data exists (`buildLiveAnnouncementQuestion`).

`resolveQuestionPool()` rejects thin admin packs (Yes/No, no explanation, no coaching) and falls back to `QUESTION_POOL`.

## Design direction

Field tailboard at dawn. Deep `ink-950`, verdant accent, bone type, leaf-radius slabs. Instrument readouts for weather. Hazard chips, not comma lists. Step rail in the sticky header — not a long page of identical cards.

## Verify

- Unit: `npx vitest run tests/unit/lib/briefing.test.ts`
- Visual: 390 / 768 / 1440, plus reduced-motion. Confirm no horizontal overflow and no ghosted type.
- Quiz: wrong answer shows the correct one before Continue enables.
- Personalization: a user with JSA hazards sees humanized chips, not keys.
