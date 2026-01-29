# CSV/PDF Exports (Phase 2)

## OSHA 300 Log (CSV)

- **Source:** `osha_300_log` view (recordable, lost_time, and fatality incidents only).
- **Columns:** Case Number, Employee Name, Job Title, Date of Injury or Illness, Where the event occurred, Description (with body parts), Classification, Days Away, Days Restricted, Injury/illness type, Reported at.
- **Where:** Safety Analytics dashboard (“OSHA 300 (CSV)”) and Safety Incidents list (“OSHA 300”).
- **File:** `OSHA-300-Log-YYYY-MM-DD.csv`.

## Safety Analytics Report (PDF)

- **Content:** One-page PDF with period, summary stats (active users, total points, compliance rate, etc.), and top 15 leaderboard table.
- **Where:** Safety Analytics dashboard (“Report (PDF)”).
- **File:** `Safety-Analytics-{period}-YYYY-MM-DD.pdf`.
- **Libraries:** jspdf, jspdf-autotable.

## References

- Phase 2 Plan: `docs/Phase2-Plan.md`
- OSHA 300 export: `src/lib/osha300Export.ts`
- Analytics PDF: `src/lib/analyticsPdfExport.ts`
- View: `public.osha_300_log` (migration `20260120200000_add_osha_compliance_fields_to_safety_incidents.sql`)
