import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { logger } from '../../lib/logger';

/**
 * Announcement reward record with user details for admin view
 */
export interface AdminRewardRecord {
  id: string;
  user_id: string;
  announcement_id: string;
  points_awarded: number;
  claimed_at: string;
  // Joined from app_users
  full_name: string | null;
  email: string | null;
}

/**
 * Query params for admin rewards pagination and filtering
 */
export interface AdminRewardsQueryParams {
  page: number;
  pageSize: number;
  searchQuery?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Result shape from the admin rewards query
 */
export interface AdminRewardsResult {
  rewards: AdminRewardRecord[];
  totalCount: number;
  totalPoints: number;
}

/**
 * Individual claim detail with announcement info for the modal view
 */
export interface UserClaimDetail {
  id: string;
  announcement_id: string;
  announcement_title: string | null;
  announcement_date: string | null;
  points_awarded: number;
  claimed_at: string;
}

/**
 * Grouped user reward summary - one entry per user
 */
export interface GroupedUserReward {
  user_id: string;
  full_name: string | null;
  email: string | null;
  total_points: number;
  claim_count: number;
  first_claim_at: string;
  last_claim_at: string;
  claims: UserClaimDetail[];
}

/**
 * Query params for grouped admin rewards pagination and filtering
 */
export interface GroupedRewardsQueryParams {
  page: number;
  pageSize: number;
  searchQuery?: string;
}

/**
 * Result shape from the grouped admin rewards query
 */
export interface GroupedRewardsResult {
  users: GroupedUserReward[];
  totalUsers: number;
}

/**
 * Query key factory for admin rewards queries
 */
export const adminRewardsQueryKeys = {
  all: ['admin-rewards'] as const,
  list: (params: AdminRewardsQueryParams) => ['admin-rewards', 'list', params] as const,
  grouped: (params: GroupedRewardsQueryParams) => ['admin-rewards', 'grouped', params] as const,
  stats: ['admin-rewards', 'stats'] as const,
};

/**
 * Fetches all announcement rewards with user details for admin view.
 * Supports pagination, search by email/name, and date range filtering.
 * 
 * Note: Since announcement_rewards.user_id references auth.users (not app_users),
 * we fetch rewards and users separately, then join them in JavaScript.
 */
export function useAdminRewards(params: AdminRewardsQueryParams) {
  const { page, pageSize, searchQuery, dateFrom, dateTo } = params;

  return useQuery({
    queryKey: adminRewardsQueryKeys.list(params),
    queryFn: async (): Promise<AdminRewardsResult> => {
      // If there's a search query, we need to first find matching users
      // then filter rewards by those user IDs
      let matchingUserIds: string[] | null = null;
      
      if (searchQuery?.trim()) {
        const search = searchQuery.trim();
        // Use user_profiles view which has proper RLS for admin access
        // Note: user_id is the auth.users reference, id is the app_users row ID
        const { data: matchingUsers, error: userSearchError } = await supabase
          .from('user_profiles')
          .select('user_id')
          .or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
        
        if (userSearchError) {
          logger.error('Failed to search users:', userSearchError);
          throw new Error('Failed to search users');
        }
        
        matchingUserIds = (matchingUsers || []).map(u => u.user_id).filter(Boolean) as string[];
        
        // If no users match the search, return empty result
        if (matchingUserIds.length === 0) {
          return {
            rewards: [],
            totalCount: 0,
            totalPoints: 0,
          };
        }
      }

      // Build the rewards query
      let rewardsQuery = supabase
        .from('announcement_rewards')
        .select('id, user_id, announcement_id, points_awarded, claimed_at', { count: 'exact' })
        .order('claimed_at', { ascending: false });

      // Filter by matching user IDs if search was applied
      if (matchingUserIds) {
        rewardsQuery = rewardsQuery.in('user_id', matchingUserIds);
      }

      // Apply date range filters
      if (dateFrom) {
        rewardsQuery = rewardsQuery.gte('claimed_at', `${dateFrom}T00:00:00`);
      }
      if (dateTo) {
        // Calculate day after dateTo for proper boundary (includes all times up to 23:59:59.999)
        const toDate = new Date(dateTo);
        const dayAfterTo = new Date(toDate);
        dayAfterTo.setDate(dayAfterTo.getDate() + 1);
        const dayAfterToDate = dayAfterTo.toISOString().slice(0, 10);
        rewardsQuery = rewardsQuery.lt('claimed_at', `${dayAfterToDate}T00:00:00`);
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      rewardsQuery = rewardsQuery.range(from, to);

      const { data: rewardsData, error: rewardsError, count } = await rewardsQuery;

      if (rewardsError) {
        logger.error('Failed to fetch rewards:', rewardsError);
        throw new Error('Failed to load rewards data');
      }

      if (!rewardsData || rewardsData.length === 0) {
        return {
          rewards: [],
          totalCount: count ?? 0,
          totalPoints: 0,
        };
      }

      // Get unique user IDs from rewards
      const userIds = [...new Set(rewardsData.map(r => r.user_id))];

      // Fetch user details for those IDs using user_profiles view (has admin RLS)
      // Note: user_id is the auth.users reference that matches announcement_rewards.user_id
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      if (usersError) {
        logger.error('Failed to fetch user details:', usersError);
        // Continue without user details rather than failing completely
      }

      // Create a lookup map for users keyed by user_id (auth.users.id)
      const userMap = new Map<string, { full_name: string | null; email: string | null }>();
      (usersData || []).forEach(user => {
        if (user.user_id) {
          userMap.set(user.user_id, { full_name: user.full_name, email: user.email });
        }
      });

      // Join rewards with user data
      const rewards: AdminRewardRecord[] = rewardsData.map(record => ({
        id: record.id,
        user_id: record.user_id,
        announcement_id: record.announcement_id,
        points_awarded: record.points_awarded,
        claimed_at: record.claimed_at,
        full_name: userMap.get(record.user_id)?.full_name ?? null,
        email: userMap.get(record.user_id)?.email ?? null,
      }));

      // total_points reflects the ledger balances (single source of truth) of the
      // distinct users present in this page, rather than a sum of announcement
      // claim amounts. Keeps this in agreement with get_user_point_balance.
      let pagePoints = rewards.reduce((sum, r) => sum + r.points_awarded, 0);
      const { data: ledgerRows, error: ledgerError } = await supabase
        .from('point_transactions')
        .select('user_id, amount')
        .in('user_id', userIds);
      if (ledgerError) {
        // Loud on purpose: totalPoints falls back to the announcement-only sum,
        // which understates totals (ignores compliance points) — the exact
        // regression the ledger cutover exists to prevent. Never degrade silently.
        logger.error(
          '[useAdminRewards] Ledger read failed — totalPoints will fall back to announcement-only (understated) numbers:',
          ledgerError
        );
      } else {
        pagePoints = (ledgerRows || []).reduce(
          (sum: number, r: { amount: number }) => sum + r.amount,
          0
        );
      }

      return {
        rewards,
        totalCount: count ?? 0,
        totalPoints: pagePoints,
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Fetches aggregate statistics for admin rewards dashboard.
 * Returns total claims count and total points awarded across all users.
 */
export function useAdminRewardsStats() {
  return useQuery({
    queryKey: adminRewardsQueryKeys.stats,
    queryFn: async () => {
      // Get total count
      const { count: totalClaims, error: countError } = await supabase
        .from('announcement_rewards')
        .select('id', { count: 'exact', head: true });

      if (countError) {
        logger.error('Failed to fetch rewards count:', countError);
        throw new Error('Failed to load rewards statistics');
      }

      // Total points = the ledger (point_transactions), the single source of truth.
      // This now includes compliance points, not just announcement claims, so this
      // figure agrees with each user's get_user_point_balance. Admin RLS on
      // point_transactions allows reading all rows here.
      const { data: pointsData, error: pointsError } = await supabase
        .from('point_transactions')
        .select('amount');

      if (pointsError) {
        logger.error('Failed to fetch total points:', pointsError);
        throw new Error('Failed to load points statistics');
      }

      const totalPoints = (pointsData || []).reduce(
        (sum: number, r: { amount: number }) => sum + r.amount,
        0
      );

      // Get unique users count
      const { data: usersData, error: usersError } = await supabase
        .from('announcement_rewards')
        .select('user_id');

      if (usersError) {
        logger.error('Failed to fetch unique users:', usersError);
      }

      const uniqueUsers = new Set((usersData || []).map((r: { user_id: string }) => r.user_id)).size;

      return {
        totalClaims: totalClaims ?? 0,
        totalPoints,
        uniqueUsers,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetches announcement rewards grouped by user for the consolidated admin view.
 * Returns one entry per user with their total points and claim history.
 */
export function useAdminRewardsGrouped(params: GroupedRewardsQueryParams) {
  const { page, pageSize, searchQuery } = params;

  return useQuery({
    queryKey: adminRewardsQueryKeys.grouped(params),
    queryFn: async (): Promise<GroupedRewardsResult> => {
      // Step 1: If search query, find matching user IDs first
      let matchingUserIds: string[] | null = null;
      
      if (searchQuery?.trim()) {
        const search = searchQuery.trim();
        const { data: matchingUsers, error: userSearchError } = await supabase
          .from('user_profiles')
          .select('user_id')
          .or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
        
        if (userSearchError) {
          logger.error('Failed to search users:', userSearchError);
          throw new Error('Failed to search users');
        }
        
        matchingUserIds = (matchingUsers || []).map(u => u.user_id).filter(Boolean) as string[];
        
        if (matchingUserIds.length === 0) {
          return { users: [], totalUsers: 0 };
        }
      }

      // Step 2: Fetch ALL rewards (we'll group client-side for simplicity)
      let rewardsQuery = supabase
        .from('announcement_rewards')
        .select('id, user_id, announcement_id, points_awarded, claimed_at')
        .order('claimed_at', { ascending: false });

      if (matchingUserIds) {
        rewardsQuery = rewardsQuery.in('user_id', matchingUserIds);
      }

      const { data: rewardsData, error: rewardsError } = await rewardsQuery;

      if (rewardsError) {
        logger.error('Failed to fetch rewards:', rewardsError);
        throw new Error('Failed to load rewards data');
      }

      if (!rewardsData || rewardsData.length === 0) {
        return { users: [], totalUsers: 0 };
      }

      // Step 3: Get unique user IDs and announcement IDs
      const userIds = [...new Set(rewardsData.map(r => r.user_id))];
      const announcementIds = [...new Set(rewardsData.map(r => r.announcement_id))];

      // Step 3b: Fetch each user's ledger balance (single source of truth).
      // Per-user total_points is derived from point_transactions so it equals
      // get_user_point_balance — including compliance points, not announcement
      // claims alone. Admin RLS allows reading all ledger rows here.
      const ledgerByUser = new Map<string, number>();
      {
        const { data: ledgerRows, error: ledgerError } = await supabase
          .from('point_transactions')
          .select('user_id, amount')
          .in('user_id', userIds);
        if (ledgerError) {
          // Loud on purpose: the per-user total_points below will fall back to the
          // announcement-only sum, which UNDERSTATES totals (ignores compliance
          // points). That is exactly the regression the ledger cutover prevents,
          // so a silent degrade is unacceptable — surface it.
          logger.error(
            '[useAdminRewardsGrouped] Ledger read failed — total_points will fall back to announcement-only (understated) numbers:',
            ledgerError
          );
        } else {
          (ledgerRows || []).forEach((row: { user_id: string; amount: number }) => {
            ledgerByUser.set(row.user_id, (ledgerByUser.get(row.user_id) ?? 0) + row.amount);
          });
        }
      }

      // Step 4: Fetch user details
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      if (usersError) {
        logger.error('Failed to fetch user details:', usersError);
      }

      const userMap = new Map<string, { full_name: string | null; email: string | null }>();
      (usersData || []).forEach(user => {
        if (user.user_id) {
          userMap.set(user.user_id, { full_name: user.full_name, email: user.email });
        }
      });

      // Step 5: Fetch announcement details for the claim history
      const { data: announcementsData, error: announcementsError } = await supabase
        .from('announcements')
        .select('id, title, date')
        .in('id', announcementIds);

      if (announcementsError) {
        logger.error('Failed to fetch announcement details:', announcementsError);
      }

      const announcementMap = new Map<string, { title: string | null; date: string | null }>();
      (announcementsData || []).forEach(ann => {
        announcementMap.set(ann.id, { title: ann.title, date: ann.date });
      });

      // Step 6: Group rewards by user
      const groupedMap = new Map<string, {
        claims: UserClaimDetail[];
        total_points: number;
      }>();

      rewardsData.forEach(reward => {
        const existing = groupedMap.get(reward.user_id);
        const annInfo = announcementMap.get(reward.announcement_id);
        
        const claimDetail: UserClaimDetail = {
          id: reward.id,
          announcement_id: reward.announcement_id,
          announcement_title: annInfo?.title ?? null,
          announcement_date: annInfo?.date ?? null,
          points_awarded: reward.points_awarded,
          claimed_at: reward.claimed_at,
        };

        if (existing) {
          existing.claims.push(claimDetail);
          existing.total_points += reward.points_awarded;
        } else {
          groupedMap.set(reward.user_id, {
            claims: [claimDetail],
            total_points: reward.points_awarded,
          });
        }
      });

      // Step 7: Build final grouped array sorted by total points (highest first)
      const allGroupedUsers: GroupedUserReward[] = Array.from(groupedMap.entries()).map(
        ([userId, data]) => {
          const userInfo = userMap.get(userId);
          // Claims are already sorted by claimed_at desc from the query
          const sortedClaims = data.claims;
          
          return {
            user_id: userId,
            full_name: userInfo?.full_name ?? null,
            email: userInfo?.email ?? null,
            // Ledger balance (single source of truth); falls back to the
            // announcement-claim sum only if the ledger read failed.
            total_points: ledgerByUser.get(userId) ?? data.total_points,
            claim_count: sortedClaims.length,
            first_claim_at: sortedClaims[sortedClaims.length - 1]?.claimed_at ?? '',
            last_claim_at: sortedClaims[0]?.claimed_at ?? '',
            claims: sortedClaims,
          };
        }
      );

      // Sort by total points descending, then by last claim date
      allGroupedUsers.sort((a, b) => {
        if (b.total_points !== a.total_points) {
          return b.total_points - a.total_points;
        }
        return new Date(b.last_claim_at).getTime() - new Date(a.last_claim_at).getTime();
      });

      // Step 8: Apply pagination
      const totalUsers = allGroupedUsers.length;
      const startIdx = (page - 1) * pageSize;
      const paginatedUsers = allGroupedUsers.slice(startIdx, startIdx + pageSize);

      return {
        users: paginatedUsers,
        totalUsers,
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
