# Dashboard (Employee Hub) — Product brief

One-pager: purpose, users, actions, success, out-of-scope. Use this to decide what gets added or cut.

---

## Purpose

The **Employee Hub** (`/dashboard`) is the primary landing experience for authenticated employees. It answers: *What do I need to do today?* and *Where do I go to do it?*

---

## Primary users

- **Field employees** (default role): Complete daily compliance (DVIR, Equipment, JSA), view assigned jobs, read announcements, access forms and resources.
- **Admins** may land here but can navigate to role-specific dashboards (Admin Panel, etc.).

---

## Primary actions (in order of importance)

1. **Complete daily forms** — Compliance strip and quick links to DVIR, Equipment, JSA; time-until-9AM cutoff.
2. **See assigned jobs** — Active Jobs section with link to full list; job cards open job detail.
3. **Stay informed** — Featured announcement and “View all” to announcements.
4. **Quick access** — Pinned favorites, FAB (scroll-to-top + quick form links), All Tools (expandable).
5. **Profile / sign out** — Welcome header avatar → Profile, Settings, Sign out.

---

## Success criteria

- User sees within **~30 seconds** whether they have pending forms and/or active jobs.
- User can **keyboard-navigate** and **screen-reader** the whole dashboard (job cards, View all, section expand, FAB).
- **No critical/serious a11y** issues on dashboard (axe/WAVE or equivalent).
- **Form completion rate** (and optionally dashboard engagement) is measurable and reviewed.

---

## Out-of-scope (for the dashboard page itself)

- In-app messaging or chat.
- Customizable layout (widget order); pinning is in-scope.
- Real-time notifications (handled elsewhere); banner and “Enable notifications” CTA are in-scope.
- Admin-only metrics (lives on admin/telemetry and admin/safety-analytics).

---

## Ownership

- **Product:** Prioritization of sections and features.
- **Design/UX:** Layout, design system, a11y, empty/error states.
- **Engineering:** Implementation, telemetry, performance, a11y in CI.

---

## Review cadence

- **Quarterly:** Is the section order and FAB still right? Are All Tools and Pinned Favorites still relevant?
- **Per release:** Keyboard + screen-reader pass; axe (or equivalent) on dashboard route in CI.
