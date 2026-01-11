# Directive: Admin Rewards Dashboard

> **Status**: IMPLEMENTED - Full read-only admin view

## Purpose

Provide administrators with a comprehensive view of all Safety AI announcement reward claims. This dashboard enables tracking of user engagement with safety announcements through the gamification/rewards system.

## Trigger

- **Manual**: Admin navigates to `/admin/rewards` page
- **Access Control**: Requires `admin` role

## Architecture Layer Mapping

| Layer | Component | Responsibility |
|-------|-----------|----------------|
| **Layer 1 (Directive)** | This document | Defines requirements and data flow |
| **Layer 2 (Orchestration)** | `AdminRewards.tsx` | UI state, routing, user interactions |
| **Layer 3 (Execution)** | `useAdminRewards.ts` | Deterministic Supabase queries |

## Data Sources

### Primary: Announcement Rewards

```sql
SELECT 
  ar.id,
  ar.user_id,
  ar.announcement_id,
  ar.points_awarded,
  ar.claimed_at,
  au.full_name,
  au.email
FROM public.announcement_rewards ar
INNER JOIN public.app_users au ON ar.user_id = au.id
ORDER BY ar.claimed_at DESC;
```

### Table: `public.announcement_rewards`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to auth.users |
| `announcement_id` | uuid | FK to announcements |
| `points_awarded` | integer | Points given (default 1) |
| `claimed_at` | timestamptz | When reward was claimed |

### Joined Data: `public.app_users`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | User ID (matches auth.users) |
| `full_name` | text | User's display name |
| `email` | text | User's email address |

## Features

### 1. Summary Statistics

Display aggregate metrics at the top of the page:

- **Total Claims**: Count of all reward claims
- **Total Points**: Sum of all points_awarded
- **Unique Users**: Count of distinct user_ids

### 2. Search & Filtering

| Filter | Type | Field |
|--------|------|-------|
| Search | text | `app_users.email`, `app_users.full_name` |
| Date From | date | `claimed_at >= date` |
| Date To | date | `claimed_at <= date` |

### 3. Pagination

- Server-side pagination (25 items per page)
- Uses Supabase `.range(from, to)` with `count: 'exact'`
- Displays: "X – Y of Z claims"

### 4. Data Display

**Desktop View**: Table with columns:
- User (avatar + full_name + user_id)
- Email
- Points (badge)
- Claimed Date/Time

**Mobile View**: Card layout with same data in stacked format

## Security

### RLS Policies Required

The following RLS policies must exist on `announcement_rewards`:

1. **Admins can read all rewards** (for this dashboard)
   ```sql
   CREATE POLICY "Admins can read all rewards"
     ON public.announcement_rewards
     FOR SELECT
     TO authenticated
     USING (public.is_admin());
   ```

2. **Service role full access** (for backend operations)

### Access Control

- Page-level: Protected route requires `admin` role
- Query-level: RLS policy `is_admin()` grants SELECT access

## Output Format

### Hook Return Type

```typescript
interface AdminRewardsResult {
  rewards: AdminRewardRecord[];
  totalCount: number;
  totalPoints: number;
}

interface AdminRewardRecord {
  id: string;
  user_id: string;
  announcement_id: string;
  points_awarded: number;
  claimed_at: string;
  full_name: string | null;
  email: string | null;
}
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No rewards found | Display "No Rewards Found" empty state |
| Query error | Display error state with retry option |
| User not admin | Display "Access Denied" with redirect hint |
| Missing user data | Show "Unknown User" / "No email" placeholders |

## Non-Functional Requirements

- **Performance**: Queries should complete in < 500ms for typical datasets
- **Caching**: 2-minute stale time for list queries, 5-minute for stats
- **Responsiveness**: Full mobile support with card-based layout

## Acceptance Criteria

- [x] Admin can view all reward claims across all users
- [x] Each claim shows user full_name and email
- [x] Search filters by email or name
- [x] Date range filtering works correctly
- [x] Pagination navigates through results
- [x] Summary stats display total claims, points, and unique users
- [x] Non-admin users see "Access Denied"
- [x] Mobile-responsive design
- [x] Follows gold-themed admin dashboard styling

## Related Components

- `src/pages/admin/AdminRewards.tsx` - Page component
- `src/hooks/queries/useAdminRewards.ts` - Data fetching hooks
- `src/components/admin/adminNavConfig.tsx` - Nav card configuration
- `supabase/migrations/20260108093741_create_announcement_rewards.sql` - Table definition

