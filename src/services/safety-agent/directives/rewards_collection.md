# Safety Announcement Rewards Collection

## Purpose

This directive defines the rules and behavior for the Safety AI announcement rewards system, which gamifies engagement with safety communications by allowing users to collect points when they interact with Safety AI-generated announcements.

---

## Eligibility Rules

### 1. Announcement Author Check
Only announcements where `author = "Safety AI"` are eligible for rewards collection.

**Rationale:** This ensures rewards are tied specifically to AI-generated safety content, not admin-posted or external announcements.

### 2. One-Time Claim Rule
Each user may claim rewards **once per announcement**.

**Enforcement:**
- Database unique constraint on `(user_id, announcement_id)` prevents duplicate claims
- Frontend disables button after successful claim
- Optimistic UI shows "Claimed" state immediately

### 3. Authentication Required
Users must be authenticated to claim rewards.

---

## Point Value

| Action | Points Awarded |
|--------|----------------|
| Click "Collect Points" on eligible announcement | 1 |

**Note:** Point value is stored in `points_awarded` column, defaulting to 1. This allows future flexibility for bonus events or different point tiers.

---

## Data Model

### Table: `public.announcement_rewards`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to auth.users |
| `announcement_id` | UUID | FK to announcements |
| `points_awarded` | INTEGER | Points given (default 1) |
| `claimed_at` | TIMESTAMPTZ | When the reward was claimed |

### Constraints
- `UNIQUE(user_id, announcement_id)` - Prevents duplicate claims
- `CASCADE DELETE` on both foreign keys

---

## Frontend Behavior

### Button States

1. **Unclaimed State**
   - Button text: "Collect Points"
   - Button style: Premium emerald gradient, sparkle animation
   - Action: Inserts reward record on click

2. **Claimed State**
   - Button text: "Claimed ✓"
   - Button style: Muted/disabled appearance
   - Action: None (button disabled)

3. **Loading State**
   - Shows spinner during claim submission
   - Prevents double-clicks

4. **Error State**
   - If claim fails (network error), show error toast
   - Button remains in unclaimed state for retry

### Visibility Rules
- Button **only renders** when `announcement.author === "Safety AI"`
- Button hidden for non-Safety AI announcements
- Button shown in "Latest Signal" featured announcement card

---

## Audit Requirements

### Logged Data
Every reward claim creates a record with:
- User ID (who claimed)
- Announcement ID (which announcement)
- Points awarded (how many points)
- Timestamp (when claimed)

### Queryable Metrics
- Total points per user: `get_user_total_points(user_id)`
- Claims per announcement: `COUNT(*) WHERE announcement_id = ?`
- Daily/weekly claim trends: `GROUP BY DATE(claimed_at)`

---

## Security Model

### RLS Policies
1. **SELECT own:** Users can read their own reward records
2. **SELECT admin:** Admins can read all rewards for reporting
3. **INSERT own:** Users can insert rewards only for themselves
4. **Service role:** Full access for admin operations

### Abuse Prevention
- Unique constraint prevents multi-claim exploits
- `user_id` must match `auth.uid()` for inserts
- No UPDATE policy (points cannot be modified after claim)
- No DELETE policy for users (claims are permanent)

---

## Integration Points

### 1. Safety Agent
When generating announcements, the Safety Agent must set:
```typescript
author: "Safety AI"
```

### 2. Announcements Page
The `FeaturedAnnouncementCard` component conditionally renders `CollectPointsButton` when the author is "Safety AI".

### 3. Hook: useAnnouncementRewards
Provides:
- `hasClaimed(announcementId)` - Check claim status
- `claimReward(announcementId)` - Perform claim
- `totalPoints` - User's total accumulated points

---

## Future Considerations

1. **Leaderboards:** Display top point earners (requires additional query/view)
2. **Point Multipliers:** Special events with 2x points
3. **Rewards Redemption:** Exchange points for swag/recognition
4. **Push Notifications:** Notify when new Safety AI announcement is published

