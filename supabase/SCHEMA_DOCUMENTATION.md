# ATTS Employee Portal - Database Schema Documentation

**Last Updated:** 2025-12-23  
**Database:** Supabase (PostgreSQL)  
**Total Tables:** 11

---

## Table of Contents

1. [Schema Overview](#schema-overview)
2. [Entity Relationship Diagram](#entity-relationship-diagram)
3. [Tables Reference](#tables-reference)
4. [Functions Reference](#functions-reference)
5. [RLS Policy Summary](#rls-policy-summary)
6. [Security Model](#security-model)
7. [Migration Guidelines](#migration-guidelines)

---

## Schema Overview

The ATTS Employee Portal database consists of 11 core tables organized around:

- **User Management**: `app_users` for roles and profile data
- **Job Tracking**: `job_progress_trackers`, `job_milestones`, `job_crew_assignments`, `job_progress_updates`
- **Time Off**: `rto_requests` for vacation/PTO requests
- **Inspections**: `dvir_reports`, `daily_equipment_inspections` for compliance
- **Communications**: `announcements`, `announcement_metadata`, `contact_requests`

---

## Entity Relationship Diagram

```
┌─────────────────┐
│   auth.users    │ (Supabase Auth)
│─────────────────│
│ id (PK)         │
│ email           │
│ raw_user_meta   │
└────────┬────────┘
         │ 1:1
         ▼
┌─────────────────┐
│   app_users     │
│─────────────────│
│ id (PK)         │
│ user_id (FK)    │───────────────────────────────────────┐
│ email           │                                       │
│ full_name       │                                       │
│ role            │                                       │
│ drivers_license*│                                       │
└────────┬────────┘                                       │
         │                                                 │
    ┌────┴─────┬──────────────┬──────────────┐            │
    │          │              │              │            │
    ▼          ▼              ▼              ▼            │
┌────────┐ ┌────────┐ ┌────────────┐ ┌────────────┐       │
│rto_req │ │dvir_rep│ │daily_equip │ │contact_req │       │
└────────┘ └────────┘ └────────────┘ └────────────┘       │
                                                           │
┌──────────────────────────────────────────────────────────┘
│
│  ┌───────────────────────────────┐
│  │   job_progress_trackers       │
│  │───────────────────────────────│
│  │ id (PK)                       │
│  │ created_by (FK) ──────────────┼───► auth.users
│  │ job_name, status              │
│  │ tracking_type                 │
│  └───────────┬───────────────────┘
│              │
│     ┌────────┼────────┐
│     │        │        │
│     ▼        ▼        ▼
│ ┌────────┐ ┌────────┐ ┌─────────────┐
│ │mileston│ │crew_asn│ │progress_upd │
│ │es      │ │gn      │ │ates        │
│ └────────┘ └────┬───┘ └─────────────┘
│                 │
└─────────────────┘


┌─────────────────┐     ┌─────────────────────┐
│  announcements  │     │ announcement_metadata│
│─────────────────│     │─────────────────────│
│ id (PK)         │     │ id (PK)             │
│ title, message  │     │ last_sync           │
│ author, date    │     │ total_count         │
└─────────────────┘     └─────────────────────┘
```

---

## Tables Reference

### 1. app_users

**Purpose:** Extends auth.users with application-specific data including roles and driver's license info.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key (auto-generated) |
| `user_id` | UUID | NO | FK to auth.users(id), unique |
| `email` | TEXT | YES | Synced from auth.users |
| `full_name` | TEXT | YES | User's display name |
| `role` | TEXT | NO | One of: employee, admin, manager, mechanic, foreman, general_foreman, safety_officer |
| `avatar_url` | TEXT | YES | Path to user avatar in Supabase Storage (avatars bucket) |
| `drivers_license_number` | TEXT | YES | DL number |
| `drivers_license_class` | TEXT | YES | DL class (A, B, C, etc.) |
| `drivers_license_expiration` | TEXT | YES | DL expiration date |
| `created_at` | TIMESTAMPTZ | NO | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | YES | Auto-updated on modification |

**Indexes:**
- `idx_app_users_user_id` on (user_id)
- `idx_app_users_role` on (role)
- `idx_app_users_has_avatar` on ((avatar_url IS NOT NULL))

---

### 2. announcements

**Purpose:** Company-wide announcements displayed on the dashboard.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `title` | TEXT | NO | Announcement title |
| `message` | TEXT | YES | Short message content |
| `content` | TEXT | YES | Long-form content |
| `author` | TEXT | YES | Author name |
| `date` | DATE | NO | Announcement date |
| `raw_data` | JSONB | YES | Original data from external sync |
| `synced_at` | TIMESTAMPTZ | YES | Last sync timestamp |
| `created_at` | TIMESTAMPTZ | YES | Record creation |
| `updated_at` | TIMESTAMPTZ | YES | Auto-updated |

**Indexes:**
- `idx_announcements_date` on (date DESC)
- `idx_announcements_created_at` on (created_at DESC)
- `idx_announcements_synced_at` on (synced_at DESC)

---

### 3. announcement_metadata

**Purpose:** Tracks sync status for external announcement sources.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `last_sync` | TIMESTAMPTZ | YES | Last sync timestamp |
| `total_count` | INTEGER | YES | Total announcements count |
| `updated_at` | TIMESTAMPTZ | YES | Auto-updated |

---

### 4. rto_requests

**Purpose:** Request Time Off (vacation/PTO) submissions and approvals.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `user_id` | UUID | YES | FK to auth.users (for RLS) |
| `full_name` | TEXT | NO | Employee name |
| `email` | TEXT | NO | Employee email |
| `start_date` | DATE | NO | First day of time off |
| `end_date` | DATE | NO | Last day of time off |
| `reason` | TEXT | NO | Reason for request |
| `notes` | TEXT | YES | Additional notes |
| `status` | TEXT | YES | Pending, Approved, or Denied |
| `submitted_at` | TIMESTAMPTZ | YES | Submission timestamp |
| `updated_at` | TIMESTAMPTZ | YES | Auto-updated |

**Indexes:**
- `idx_rto_requests_user_id` on (user_id)
- `idx_rto_requests_status` on (status)
- `idx_rto_submitted_at` on (submitted_at DESC)
- `idx_rto_requests_status_submitted` on (status, submitted_at DESC)

---

### 5. job_progress_trackers

**Purpose:** Main job/project tracking table with timeline or span-based tracking.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `created_by` | UUID | YES | FK to auth.users (creator) |
| `job_name` | TEXT | NO | Job name/title |
| `job_location` | TEXT | YES | DEPRECATED: Use circuit |
| `circuit` | TEXT | YES | Circuit identifier |
| `job_description` | TEXT | YES | Description |
| `job_specs` | TEXT | YES | Specifications |
| `start_date` | DATE | YES | Start date (required for timeline) |
| `end_date` | DATE | YES | End date (required for timeline) |
| `status` | TEXT | NO | active, completed, paused, cancelled |
| `tracking_type` | TEXT | NO | timeline or job_progress |
| `estimated_total_spans` | INTEGER | YES | For span tracking |
| `estimated_total_feet` | NUMERIC | YES | For span tracking |
| `span_progress_metric` | TEXT | YES | spans or feet |
| `notes` | TEXT | YES | Additional notes |
| `created_at` | TIMESTAMPTZ | NO | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NO | Auto-updated |

**Indexes:**
- `idx_job_progress_trackers_created_by` on (created_by)
- `idx_job_progress_trackers_status` on (status)
- `idx_job_progress_trackers_tracking_type` on (tracking_type)
- `idx_job_progress_trackers_circuit` on (circuit)
- `idx_job_progress_trackers_dates` on (start_date, end_date)

---

### 6. job_milestones

**Purpose:** Checkpoints/milestones within a job.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `job_id` | UUID | NO | FK to job_progress_trackers |
| `title` | TEXT | NO | Milestone title |
| `description` | TEXT | YES | Description |
| `target_date` | DATE | YES | Target completion date |
| `sort_order` | INTEGER | NO | Display order |
| `is_completed` | BOOLEAN | NO | Completion status |
| `completed_at` | TIMESTAMPTZ | YES | When completed |
| `completed_by` | UUID | YES | FK to auth.users |
| `created_at` | TIMESTAMPTZ | NO | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | YES | Auto-updated |

**Indexes:**
- `idx_job_milestones_job_id` on (job_id)
- `idx_job_milestones_sort_order` on (job_id, sort_order)
- `idx_job_milestones_completed_by` on (completed_by)

---

### 7. job_crew_assignments

**Purpose:** Junction table linking users to jobs they're assigned to.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `job_id` | UUID | NO | FK to job_progress_trackers |
| `user_id` | UUID | NO | FK to auth.users |
| `assigned_at` | TIMESTAMPTZ | NO | Assignment timestamp |
| `assigned_by` | UUID | YES | FK to auth.users (assigner) |

**Constraints:**
- UNIQUE(job_id, user_id)

**Indexes:**
- `idx_job_crew_assignments_job_id` on (job_id)
- `idx_job_crew_assignments_user_id` on (user_id)
- `idx_job_crew_assignments_job_user` on (job_id, user_id)
- `idx_job_crew_assignments_user_job` on (user_id, job_id)
- `idx_job_crew_assignments_assigned_by` on (assigned_by)

---

### 8. job_progress_updates

**Purpose:** Span-based progress entries for job_progress tracking type.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `job_id` | UUID | NO | FK to job_progress_trackers |
| `user_id` | UUID | NO | FK to auth.users |
| `full_name` | TEXT | NO | Submitter name |
| `email` | TEXT | NO | Submitter email |
| `circuit` | TEXT | NO | Circuit identifier |
| `date` | DATE | NO | Work date |
| `spans_completed` | INTEGER | NO | Number of spans completed |
| `span_length_feet` | NUMERIC | NO | Length per span |
| `span_length_category` | TEXT | NO | Category (general) |
| `equipment` | TEXT | NO | jerraff, bucket, or mulcher |
| `job_title` | TEXT | NO | Job title |
| `total_feet_completed` | NUMERIC | GENERATED | spans * length |
| `notes` | TEXT | YES | Additional notes |
| `created_at` | TIMESTAMPTZ | NO | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NO | Auto-updated |

**Indexes:**
- `idx_job_progress_updates_job_id` on (job_id)
- `idx_job_progress_updates_user_id` on (user_id)
- `idx_job_progress_updates_date` on (date)
- `idx_job_progress_updates_job_date` on (job_id, date)

---

### 9. dvir_reports

**Purpose:** Daily Vehicle Inspection Reports for DOT compliance.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `user_id` | UUID | YES | FK to auth.users |
| `truck_number` | TEXT | NO | Vehicle identifier |
| `mileage` | NUMERIC | NO | Current mileage |
| `drivers_name` | TEXT | NO | Driver name |
| `vehicle_trailer_checklist` | JSONB | YES | Inspection items |
| `aerial_checklist` | JSONB | YES | Aerial lift items |
| `notes` | TEXT | YES | General notes |
| `final_driver_signature` | TEXT | YES | Signature file path |
| `general_foreman_signature` | TEXT | YES | Signature file path |
| `mechanic_signature` | TEXT | YES | Signature file path |
| `oil_dipstick_path` | TEXT | NO | Photo file path |
| `created_at` | TIMESTAMPTZ | NO | Submission timestamp |
| `updated_at` | TIMESTAMPTZ | YES | Auto-updated |

**Indexes:**
- `idx_dvir_reports_user_id` on (user_id)
- `idx_dvir_reports_user_created` on (user_id, created_at DESC)

---

### 10. daily_equipment_inspections

**Purpose:** Equipment inspection records for various equipment types.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `user_id` | UUID | YES | FK to auth.users |
| `submitted_by` | TEXT | YES | Submitter name |
| `equipment_type` | TEXT | NO | Type of equipment |
| `equipment_number` | TEXT | NO | Equipment identifier |
| `inspection_date` | DATE | NO | Inspection date |
| `template` | TEXT | YES | Inspection template used |
| `notes` | TEXT | YES | General notes |
| `general_checklist` | JSONB | YES | General inspection items |
| `specific_checklist` | JSONB | YES | Equipment-specific items |
| `overview_photo_path` | TEXT | YES | Photo file path |
| `damage_photo_path` | TEXT | YES | Photo file path |
| `attachments_photo_path` | TEXT | YES | Photo file path |
| `hydraulic_photo_path` | TEXT | NO | Photo file path |
| `mechanic_fixes` | TEXT | YES | Mechanic notes |
| `last_mechanic_updated_at` | TIMESTAMPTZ | YES | Last mechanic update |
| `created_at` | TIMESTAMPTZ | NO | Submission timestamp |
| `updated_at` | TIMESTAMPTZ | YES | Auto-updated |

**Indexes:**
- `idx_daily_equipment_inspections_user_id` on (user_id)
- `idx_daily_equipment_inspections_user_date` on (user_id, inspection_date DESC)
- `idx_daily_equipment_inspections_equipment_type` on (equipment_type)

---

### 11. contact_requests

**Purpose:** Contact form submissions from employees.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `user_id` | UUID | YES | FK to auth.users |
| `name` | TEXT | NO | Submitter name |
| `email` | TEXT | NO | Submitter email |
| `topic` | TEXT | NO | Message topic/category |
| `message` | TEXT | NO | Message content |
| `submitted_at` | TIMESTAMPTZ | NO | Submission timestamp |
| `updated_at` | TIMESTAMPTZ | YES | Auto-updated |

**Indexes:**
- `contact_requests_user_idx` on (user_id)
- `contact_requests_submitted_at_idx` on (submitted_at DESC)
- `idx_contact_requests_topic` on (topic)

---

## Functions Reference

### Helper Functions (for RLS policies)

| Function | Returns | Description |
|----------|---------|-------------|
| `public.is_admin()` | BOOLEAN | Returns true if current user is admin |
| `public.is_admin_or_manager()` | BOOLEAN | Returns true if admin or manager |
| `public.is_mechanic()` | BOOLEAN | Returns true if mechanic |
| `public.is_admin_or_mechanic()` | BOOLEAN | Returns true if admin or mechanic |

All helper functions use `SECURITY DEFINER` to bypass RLS and prevent infinite recursion.

### Data Functions

| Function | Returns | Description |
|----------|---------|-------------|
| `public.get_user_profiles()` | TABLE | Returns all users (admin-only) |
| `public.get_job_progress(job_id)` | JSON | Calculates job progress % |
| `public.handle_new_user()` | TRIGGER | Creates app_users on signup |
| `public.update_updated_at_column()` | TRIGGER | Auto-updates updated_at |

---

## RLS Policy Summary

### Policy Pattern

All tables follow this pattern:
1. **Users can read their own data** - `user_id = auth.uid()`
2. **Admins have elevated access** - `public.is_admin()`
3. **Specific roles get specific access** - `public.is_admin_or_mechanic()`

### Per-Table Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `app_users` | Own only | Own only | Service role | Service role |
| `announcements` | All (public) | All (webhook) | Service role | Service role |
| `rto_requests` | Own + Admin | Own | Admin | Admin |
| `job_progress_trackers` | Assigned + Admin | Admin | Admin | Admin |
| `job_milestones` | Assigned + Admin | Admin | Admin | Admin |
| `job_crew_assignments` | Own + Admin | Admin | Admin | Admin |
| `job_progress_updates` | Own + Admin | Assigned | Own + Admin | Own + Admin |
| `dvir_reports` | Own + Admin | Own | - | - |
| `daily_equipment_inspections` | Own + Mech/Admin | Own | Mech/Admin | - |
| `contact_requests` | Own + Admin | Own | - | - |

---

## Security Model

### Roles

| Role | Description | Capabilities |
|------|-------------|--------------|
| `employee` | Default role | Submit forms, view own data, view assigned jobs |
| `admin` | Administrator | Full access to all data and management functions |
| `manager` | Team manager | Same as admin for most operations |
| `mechanic` | Equipment mechanic | View/update equipment inspections |

### Authentication Flow

1. User signs up via Supabase Auth
2. `on_auth_user_created` trigger fires
3. `handle_new_user()` creates app_users record with role='employee'
4. Admin promotes users via service role or get_user_profiles() function

### RLS Bypass

- **Service Role**: Bypasses all RLS automatically
- **SECURITY DEFINER Functions**: Bypass RLS for specific operations
- **anon Role**: Limited to public read policies (announcements)

---

## Migration Guidelines

### Naming Convention

Use full timestamp format: `YYYYMMDDHHmmss_description.sql`

```bash
# Generate new migration
supabase migration new add_new_feature
```

### Best Practices

1. **Always use IF NOT EXISTS / IF EXISTS** for idempotency
2. **Use TIMESTAMPTZ** (not TIMESTAMP) for all timestamp columns
3. **Add updated_at triggers** to all tables with mutable data
4. **Use helper functions** (is_admin, etc.) in RLS policies, not direct queries
5. **Never query a table within its own RLS policy** (causes infinite recursion)
6. **Add indexes** on foreign keys and frequently filtered columns
7. **Set search_path** on all SECURITY DEFINER functions

### Testing Migrations

```bash
# Reset local database and run all migrations
supabase db reset

# Check migration status
supabase migration list

# Check for schema drift vs remote
supabase db diff
```

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-23 | Initial documentation created during migration audit |
| 2025-12-23 | Added schema consolidation migration (missing triggers, indexes) |
| 2025-12-23 | Added final RLS policy consolidation migration |

