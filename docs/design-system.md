# Design system (Employee Portal)

Single source of truth for spacing, typography, focus, shadows, and motion. Reference this in components and in UX audits.

---

## Spacing scale

Use a consistent scale (Tailwind defaults). Prefer these values; avoid arbitrary values.

| Token   | Value | Use |
|--------|--------|-----|
| 1 (4px)  | 0.25rem | Icon gaps, tight inline |
| 2 (8px)  | 0.5rem  | Within form fields, list item padding |
| 3 (12px) | 0.75rem | Tight (related items in a card) |
| 4 (16px) | 1rem    | Default gap, input padding |
| 6 (24px) | 1.5rem  | Comfortable (between card groups) |
| 8 (32px) | 2rem    | Section spacing |
| 12 (48px)| 3rem    | Generous (between major sections) |

**Rhythm:** Tight (8–12px) inside cards → Comfortable (24–32px) between sections → Generous (48px) between major page areas.

---

## Typography

### Minimum sizes

- **Mobile (default):** No readable label or body text below **12px** (`text-xs`). Reserve 9–10px for nonessential decoration only.
- **Body/copy:** Prefer 14px (`text-sm`) or 16px (`text-base`) for primary content.
- **Scale (Tailwind):** `text-xs` (12px), `text-sm` (14px), `text-base` (16px), `text-lg` (18px), `text-xl` (20px), `text-2xl` (24px).

### Semantic use

- **Page title:** `text-lg sm:text-2xl md:text-3xl font-bold`
- **Section title:** `text-sm font-bold` or `text-base font-semibold`
- **Subtitle / caption:** `text-xs` or `text-sm` with muted color
- **Body:** `text-sm` or `text-base`

---

## Focus (accessibility)

Every interactive element must have a visible focus indicator. Use this pattern consistently.

### Tailwind classes

```css
focus:outline-none
focus-visible:ring-2
focus-visible:ring-emerald-400/50
focus-visible:ring-offset-2
focus-visible:ring-offset-[#0a0f0d]
```

Optional: add `rounded` or `rounded-xl` so the ring follows the shape.

### Shared constant (Dashboard example)

```ts
const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d] rounded-xl';
```

Apply to: links, buttons, icon buttons, cards that act as links/buttons, expandable section headers, form controls (if not already styled).

---

## Shadows

Use 2–3 levels for consistency.

| Level   | Use           | Example (emerald theme) |
|---------|----------------|---------------------------|
| Card    | Default cards  | `0 4px 12px -4px rgba(16, 185, 129, 0.15), inset 0 1px 0 rgba(255,255,255,0.03)` |
| Card hover | Lift on hover | Slightly larger blur / spread |
| Modal   | Overlays       | `shadow-2xl shadow-black/50` |

---

## Motion

- **Respect reduced motion:** Check `prefersReducedMotion` (or `getDeviceCapabilities().prefersReducedMotion`). When true, use `reducedMotionFade` or no animation.
- **Durations:** ~100ms (instant), 150ms (fast), 250ms (normal), 350ms (slow). Avoid >300ms for micro-interactions.
- **Easing:** Prefer `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out) for entrances; avoid `linear` for UI.
- **ScrollReveal:** Use `useReducedMotion()` and `reducedMotionFade` variant when user prefers reduced motion.

---

## Color (semantic)

- **Primary / success:** emerald (e.g. `text-emerald-400`, `border-emerald-500/30`)
- **Warning / pending:** amber
- **Destructive / error:** red
- **Muted text:** `text-white/50`, `text-white/40` — ensure contrast meets WCAG for body text (e.g. 4.5:1).

---

## Checklist for new UI

- [ ] Spacing from scale (no one-off values)
- [ ] Text on mobile ≥ 12px for labels/body
- [ ] Focus-visible ring on all interactive elements
- [ ] Motion respects `prefersReducedMotion`
- [ ] Shadows from design-system levels (if applicable)
