---
name: design-iteration-preflight
description: >-
  Three iteration passes plus a green ATTS pre-flight board after any public
  admin or safety UI change. Use when the user asks for iteration passes,
  design QA, pre-flight, or before calling a visible surface done.
---

# Design iteration + pre-flight (ATTS)

Do not call visual work done after the first implementation. Run three passes, then the board.

## What an iteration pass is

After the new surface works, walk it looking for design problems **and** chances to deepen the design. Each pass must change something real (copy, hierarchy, empty state, metric definition, motion, density) or record why nothing remains.

## Pass 1 — Honesty

- Can every number be explained in one sentence with its denominator?
- Are empty / error / loading shapes matching the real layout?
- Is any label using `type-display`, `type-instrument`, or `text-glow` on a data surface? If yes, replace with `font-semibold tracking-tight` titles and `text-xs` labels.
- Do parts add up (points, percents, counts)?

## Pass 2 — Hierarchy

- One hero number. Supporting instruments. Detail last.
- Touch targets ≥ 44px. Body text ≥ 14px. Labels ≥ 12px.
- Period / filter state survives refresh when it is shareable (URL).
- Motion ≤ 200ms. `useReducedMotion` on Framer elements.

## Pass 3 — Depth

- Tooltips or footnotes on every non-obvious rate
- At-risk / exception path, not only the happy list
- Mobile and desktop both readable
- Surfaces use `glass.*` / Canopy tokens, not ad-hoc `bg-white/[0.03] backdrop-blur`

## Pre-flight board (must be green)

- [ ] Static: no ghosted type, no 8–9px labels, no unlabeled percents
- [ ] 390 / 768 / 1440: hero, instruments, list, drawer all usable
- [ ] Overflow: no horizontal scroll on 390
- [ ] Reduced motion: no sparkline/draw animation required to understand the number
- [ ] Contrast: bone-50 titles, bone-200/65 body on ink-950
- [ ] Data: unit tests for any formula that can lie
- [ ] Lint / typecheck / build pass

## After the board

If a box is yellow, fix it in this session. Do not defer “we’ll polish later” on a surface leadership will screenshot.
