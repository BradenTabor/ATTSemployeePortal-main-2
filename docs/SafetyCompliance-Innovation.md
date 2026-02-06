# Safety Compliance — Innovation & Prioritization

**Date:** February 4, 2026  
**Repository:** ATTSemployeePortal-main-2  
*(Deliverable: Plan 3 — Innovation Research & Prioritization. Inputs: Phase 1 inventory, Plan 2 compliance gaps. Compliance score updated to 76% after OSHA mapping expansion.)*

---

## 1. Pain point summary

Compiled from Phase 1 and existing docs:

- **Form fatigue:** Three separate morning forms (JSA, DVIR, Equipment) — ~15–20 min total; no unified “start of day” flow.
- **No DVIR/Equipment offline:** Submissions require online connection; photos not queued; field workers in low-signal areas lose data or delay submission.
- **No real-time compliance feedback:** Users see success toast but no ongoing “compliance status” or streak until 9 AM email.
- **Smart defaults:** Exist for DVIR and JSA (get-smart-defaults Edge Function); Equipment form has no smart defaults.
- **No mid-day JSA update:** If conditions change (weather, new hazard), no in-app flow to update the day’s JSA.
- **Incident reporting friction:** Incident Logging Modal only from Admin Dashboard; no quick “Report Incident” for field/supervisors on mobile.
- **Voice input:** Already on Incident, DVIR, and JSA StepConditions; not on Equipment or all long-text fields.
- **Accessibility:** Lighthouse Accessibility 100%; pa11y-ci and E2E accessibility tests exist; no in-form help or tooltips.

---

## 2. Industry research summary

### Competitor / market

- **Offline forms:** GoFormz, FORM, and similar EHS platforms emphasize offline-capable forms with sync when back online — aligns with ATTS gap (DVIR/Equipment offline).
- **Features common in market:** Digital JHA/JSA, LOTO forms, hot work permits, photo capture, digital signatures, workflow routing, integrations (Procore, etc.). ATTS already has JSA, DVIR, Equipment, signatures, and photos; differentiator is internal tool + AI safety announcements.
- **Pricing:** External tools often $5–80/user/month; ATTS is internal — cost leadership opportunity.

### Regulatory

- **OSHA electronic submission (2026):** Establishments must electronically submit OSHA 300A (and 300, 301) via Injury Tracking Application (ITA). ATTS has 300/301 export and 5-year retention; adding automated 300A generation/post would close compliance gap.
- **Heat illness prevention (proposed):** OSHA proposed rule (Aug 2024) for heat injury/illness prevention in outdoor and indoor work. When final, may require heat hazard plans and controls — opportunity to add heat index or heat-stress fields to JSA.

### Emerging tech

- **Voice AI:** Voice-to-text is mature (Web Speech API); ATTS already uses it in three places; expanding to Equipment and all long-text is low effort.
- **Computer vision:** PPE detection from photos is emerging; high effort but differentiator.
- **Offline + sync:** Industry standard for field apps; ATTS has pattern for JSA; extending to DVIR/Equipment with photo persistence is high value.

---

## 3. Prioritization matrix

Scoring: Impact 1–10, Effort 1–10, Value = Impact/Effort. Strategic fit: +1 to Value if compliance mandate or blocks other work.

| # | Feature | Impact | Effort | Value | Strategic | Category | Status |
|---|---------|--------|--------|-------|-----------|----------|--------|
| 1 | Offline DVIR/Equipment with photo persistence | 9 | 4 | 2.25 | Yes | Mobile/UX | New |
| 2 | Expand voice-to-text to Equipment & all long-text | 8 | 3 | 2.67 | No | Form | Enhancement |
| 3 | Quick Incident Reporting (mobile/widget) | 9 | 5 | 1.8 | Yes | Mobile/UX | New |
| 4 | Smart defaults for Equipment form | 7 | 4 | 1.75 | No | Form | Enhancement |
| 5 | Automated OSHA 300A annual summary | 9 | 6 | 1.5 | Yes | Compliance | Enhancement |
| 6 | AI hazard suggestions in JSA | 10 | 5 | 2.0 | Yes | AI | New |
| 7 | Weather / heat index in JSA | 7 | 4 | 1.75 | Yes | Integration | New |
| 8 | Unified morning check-in (one flow, conditional) | 9 | 7 | 1.29 | No | Form | New |
| 9 | Real-time compliance dashboard (supervisor) | 8 | 5 | 1.6 | No | Analytics | Enhancement |
| 10 | LOTO acknowledgment in JSA | 7 | 4 | 1.75 | Yes | Compliance | Enhancement |
| 11 | Digital signature canvas (replace text-only where needed) | 7 | 4 | 1.75 | No | Form | Enhancement |
| 12 | Mid-day JSA update | 7 | 5 | 1.4 | No | Form | New |
| 13 | Template library (pre-built JSAs) | 8 | 5 | 1.6 | No | Form | New |
| 14 | Equipment QR/NFC scan to auto-fill | 8 | 5 | 1.6 | No | Form | New |
| 15 | Certification expiration reminders (already exist; ensure coverage) | 7 | 2 | 3.5 | No | Training | Implemented |
| 16 | Photo compression before upload (reduce data) | 6 | 3 | 2.0 | No | Mobile/UX | Enhancement |
| 17 | Progress indicator on long forms | 6 | 3 | 2.0 | No | UX | Enhancement |
| 18 | Role-based dashboard (employee vs manager view) | 7 | 5 | 1.4 | No | Analytics | Partial |
| 19 | Multi-language (e.g. Spanish) | 9 | 6 | 1.5 | No | Accessibility | New |
| 20 | Computer vision PPE detection | 10 | 7 | 1.43 | No | AI | New |
| 21 | Privacy case field (29 CFR 1904.12) | 7 | 3 | 2.33 | Yes | Compliance | Enhancement |
| 22 | 180-day new case logic (29 CFR 1904.6) | 6 | 5 | 1.2 | Yes | Compliance | New |
| 23 | Form 301 within 7 days workflow | 7 | 4 | 1.75 | Yes | Compliance | Enhancement |
| 24 | OSHA report reminder (1904.39: 8hr/24hr) | 7 | 3 | 2.33 | Yes | Compliance | Enhancement |

*Rows 21–24 added after OSHA Recordkeeping Guide mapping expansion.*

---

## 4. UI/UX recommendations

- **Progress indicator:** Add step/progress indicator to JSA wizard and long forms (DVIR, Equipment) to reduce perceived length and abandonment.
- **Role-based dashboard:** Safety Analytics and Dashboard already vary by role; refine so field employees see “Today’s tasks” and compliance status first; managers see team compliance and alerts.
- **Mobile FAB or quick action:** Floating action button or prominent “Submit JSA” / “Report Incident” on mobile to reduce navigation and support quick incident reporting.
- **Card-based form layout:** Consider card-based sections for Equipment and DVIR (e.g. Vehicle / Trailer / Aerial as cards) to improve scannability on small screens.
- **Offline indicator:** Clear banner or icon when offline, plus “Queued for sync” for JSA so users know status.
