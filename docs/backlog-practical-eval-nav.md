# Backlog: Practical Evaluation Navigation Entry Point

## Summary

Certifications with `has_practical_eval: true` (Bucket Trimmer, Geo-Boy, Groundsman, Jarraff Trimmer, Skid Steer, and **Electrical Qualification**) have practical evaluation templates seeded in the database and a working **PracticalEvaluation** page (`src/pages/certifications/PracticalEvaluation.tsx`), but **there is no UI entry point** for admins or general foremen to start or discover practical evaluations.

## Current State

- **Route:** `/resources/certification/:certSlug/practical/:userId` — exists and is protected (admin, general_foreman only).
- **Page:** Loads templates from `practical_evaluation_templates`, renders checklist, submits via `useSubmitPracticalEvaluation()`.
- **Gap:** No link from CertificationCard, Resources page, or admin certifications hub to this URL. Users must manually navigate or guess the path.
- **Consequence:** Enabling `has_practical_eval = true` on a cert (e.g. Electrical Qualification) creates an expectation that practical evals can be completed, but there is no way to fulfill it through the UI.

## Recommended Backlog Item

1. **Add entry point for practical evaluations**
   - From CertificationCard: when cert has `has_practical_eval` and user has `written_passed`, show a “Schedule practical” or “Practical eval” action that links to the practical eval flow (e.g. `/resources/certification/:slug/practical/:userId` for the current user, or an admin flow to select user).
   - From admin certifications hub (e.g. CertificationsHub “Worker qualifications” or pending certs): list users with `written_passed` who need practical eval, with a button to open PracticalEvaluation for that user.
2. **Optionally:** List of “Pending practical evaluations” in admin so all certs with practical evals are discoverable in one place.

## Link to This Work

- Electrical Qualification test and study guide (March 2026) enable the written test and practical eval template for `electrical-qualification`. The same nav gap applies; fixing it benefits all certs with practical evals.

## References

- `src/pages/certifications/PracticalEvaluation.tsx`
- `src/components/certifications/CertificationCard.tsx` (no current link to practical)
- Route in `App.tsx`: `ProtectedRoute allowedRoles={["admin", "general_foreman"]}` for PracticalEvaluation
