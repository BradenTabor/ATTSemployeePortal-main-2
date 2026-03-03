# Reference: RLS Policy Templates

ATTS uses seven roles: `employee`, `admin`, `manager`, `mechanic`, `general_foreman`, `safety_officer`, `foreman`.
Roles are stored in `auth.users` metadata (`raw_user_meta_data->>'role'`) and mirrored in the `app_users.role` column.
Check existing policies in the migration history to confirm the current access pattern for each role.

## Helper Function (already in DB)

```sql
-- This function exists — do not redefine it
-- Returns the role for the current user
create or replace function public.current_user_role()
returns text as $$
  select raw_user_meta_data->>'role'
  from auth.users
  where id = auth.uid()
$$ language sql stable security definer;
```

---

## Policy Templates

### SELECT — All authenticated users can read

```sql
create policy "<table_name>_select_all_auth"
  on public.<table_name>
  for select
  to authenticated
  using (true);
```

### SELECT — Users can only read their own rows

```sql
create policy "<table_name>_select_own"
  on public.<table_name>
  for select
  to authenticated
  using (submitted_by = auth.uid());
```

### SELECT — Safety officers and admins can read all; others read own

```sql
create policy "<table_name>_select_role_gated"
  on public.<table_name>
  for select
  to authenticated
  using (
    submitted_by = auth.uid()
    or public.current_user_role() in ('admin', 'safety_officer')
  );
```

### SELECT — Admin only

```sql
create policy "<table_name>_select_admin_only"
  on public.<table_name>
  for select
  to authenticated
  using (public.current_user_role() = 'admin');
```

---

### INSERT — All authenticated users

```sql
create policy "<table_name>_insert_auth"
  on public.<table_name>
  for insert
  to authenticated
  with check (submitted_by = auth.uid());
```

Note: Always include `with check (submitted_by = auth.uid())` on INSERT — this prevents
one user from inserting a row attributed to another user.

### INSERT — Specific roles only

```sql
create policy "<table_name>_insert_roles"
  on public.<table_name>
  for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and public.current_user_role() in ('safety_officer', 'admin', 'foreman')
  );
```

---

### UPDATE — Users can update their own rows

```sql
create policy "<table_name>_update_own"
  on public.<table_name>
  for update
  to authenticated
  using (submitted_by = auth.uid())
  with check (submitted_by = auth.uid());
```

### UPDATE — Admin and safety_officer can update any row

```sql
create policy "<table_name>_update_privileged"
  on public.<table_name>
  for update
  to authenticated
  using (
    submitted_by = auth.uid()
    or public.current_user_role() in ('admin', 'safety_officer')
  )
  with check (
    submitted_by = auth.uid()
    or public.current_user_role() in ('admin', 'safety_officer')
  );
```

---

### DELETE — Admin only (most safety records should use this)

```sql
create policy "<table_name>_delete_admin_only"
  on public.<table_name>
  for delete
  to authenticated
  using (public.current_user_role() = 'admin');
```

### No DELETE policy

If no delete policy is defined, no one can delete rows (RLS denies by default).
This is appropriate for OSHA compliance records — document the intention:

```sql
-- Intentionally no DELETE policy. Safety compliance records are immutable.
-- Soft-delete via status column if needed.
```

---

## Common Pattern for Safety Forms

Most safety forms (JSA, DVIR, inspection reports) follow this pattern:

```sql
-- Anyone can submit
create policy "<table>_insert" on public.<table> for insert to authenticated
  with check (submitted_by = auth.uid());

-- Own rows + privileged roles can read
-- Note: general_foreman can also read for crew oversight
create policy "<table>_select" on public.<table> for select to authenticated
  using (submitted_by = auth.uid() or public.current_user_role() in ('admin', 'safety_officer', 'general_foreman'));

-- Admin-only updates (corrections must be audited)
create policy "<table>_update" on public.<table> for update to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- No deletes — compliance records are permanent
-- (no DELETE policy)
```

## Role Hierarchy Quick Reference

| Role | Typical Access |
|---|---|
| `employee` | Own rows only |
| `mechanic` | Own rows + equipment-related tables |
| `foreman` | Own rows + crew member rows |
| `general_foreman` | Own rows + all foreman/crew rows |
| `manager` | Read-all on most tables |
| `safety_officer` | Read-all on safety tables, write on incident/compliance tables |
| `admin` | Full access, including updates and deletes |
