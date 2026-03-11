# JSA Sharing (Delegation)

Daily JSA submitters can **share** a JSA with other users so they can view and edit it. Only the owner can change the sharing list; delegated users cannot add/remove people.

## Data model

- **daily_jsa.shared_with_users** (JSONB): array of `{ id, email, full_name, role, added_at, added_by }`. Stored as text/string values; RLS uses `id` (auth.uid() as text) for containment.
- **jsa_sharing_audit**: one row per add/remove of a shared user (jsa_id, action, shared_user_id, changed_by, etc.). Admin-only SELECT; INSERT allowed for authenticated (used by app on update).

## RLS (daily_jsa)

- **SELECT**: owner, or current user’s id in `shared_with_users`, or admin/foreman/general_foreman/safety_officer (supervisor-style).
- **UPDATE**:
  - **jsa_update_own**: owner can update everything except `user_id`.
  - **jsa_update_shared**: user in `shared_with_users` can update but **cannot** change `shared_with_users` or `user_id` (enforced via `get_jsa_shared_users(id)` in WITH CHECK).
  - **jsa_update_admin**: admin/general_foreman/safety_officer can update (e.g. compliance); `user_id` preserved.

## Frontend

- **Share UI**: `JsaUserSelector` (StepReview). Loads shareable users from `app_users` with roles: employee, manager, mechanic, foreman, general_foreman, safety_officer (excludes admin and self). Role list must match `app_users_role_check`.
- **Form state**: `sharedWithUsers` → submitted as `shared_with_users` in insert/update.
- **History**: `JSAHistory` lists JSAs where `user_id = me` OR `shared_with_users` contains `[{ id: me }]` (PostgREST `.or()` + `.cs`). Delegated rows show “Shared with you”; owner rows show “Shared (N)” when N > 0.
- **Audit**: On update, `useJSASubmission` compares previous vs current shared users and inserts into `jsa_sharing_audit` for each add/remove (fire-and-forget).

## Compliance / reporting

- **Admin compliance cron** (9 AM): reads `daily_jsa` (including `shared_with_users`) for the day and builds a “JSA Sharing” section (submitter name + list of shared-with users) in the email.
- **Admin JSA / General Foreman** detail views show a “Shared with” section from `shared_with_users`.

## Verification

- As **owner**: create a JSA, add a shared user, submit; open JSA History and confirm the row shows “Shared (1)” (or more).
- As **shared user**: log in as that user, open JSA History; confirm the same JSA appears with “Shared with you”. Open it and edit (e.g. notes); submit and confirm update succeeds. Confirm the shared user cannot change the “Share” list (only owner can).
- In DB: `SELECT id, user_id, shared_with_users FROM daily_jsa WHERE shared_with_users != '[]'::jsonb LIMIT 5;`
- Audit: `SELECT * FROM jsa_sharing_audit ORDER BY changed_at DESC LIMIT 10;` (as admin).
