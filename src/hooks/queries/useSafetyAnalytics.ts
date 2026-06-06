/**
 * useSafetyAnalytics Hook
 * 
 * Unified data hook that combines:
 * 1. Compliance Rewards (form completion: DVIR, Equipment, JSA)
 * 2. Announcement Rewards (Safety AI announcement engagement)
 * 
 * Provides combined metrics, trends, and unified leaderboard scoring.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { logger } from '../../lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export type Period = 'week' | 'month' | 'quarter' | 'all';

export interface UnifiedLeaderboardEntry {
  user_id: string;
  full_name: string;
  email: string | null;
  role: string;
  rank: number;
  // Compliance metrics
  compliance_points: number;
  compliance_days: number;
  full_compliance_days: number;
  compliance_rate: number; // percentage
  // Announcement metrics
  announcement_points: number;
  announcements_claimed: number;
  // Combined score
  total_points: number;
  safety_score: number; // 0-100 composite score
  // Streak tracking
  current_streak: number;
  longest_streak: number;
}

export interface SafetyTrendData {
  date: string;
  compliance_submissions: number;
  announcement_claims: number;
  total_points: number;
  compliance_rate: number;
}

export interface FormBreakdown {
  form_type: 'dvir' | 'equipment' | 'jsa';
  submissions: number;
  percentage: number;
}

export interface SafetyAnalyticsStats {
  // Overview stats
  total_users: number;
  active_users: number; // Users with any activity in period
  total_compliance_points: number;
  total_announcement_points: number;
  total_combined_points: number;
  // Compliance metrics
  avg_compliance_rate: number;
  full_compliance_users: number;
  total_compliance_days: number;
  // Announcement metrics
  total_announcements_claimed: number;
  announcement_engagement_rate: number;
  // Trends
  points_trend: number; // percentage change from previous period
  compliance_trend: number;
}

export interface SafetyAnalyticsResult {
  stats: SafetyAnalyticsStats;
  leaderboard: UnifiedLeaderboardEntry[];
  trends: SafetyTrendData[];
  formBreakdown: FormBreakdown[];
}

// ============================================================================
// HELPERS
// ============================================================================

/** Normalize form type from DB/casing variants to our canonical keys. */
function normalizeFormType(form: unknown): 'dvir' | 'equipment' | 'jsa' | null {
  if (form == null) return null;
  const s = String(form).toLowerCase().trim();
  if (s === 'dvir') return 'dvir';
  if (s === 'equipment' || s === 'equipment_inspection' || s === 'equip') return 'equipment';
  if (s === 'jsa') return 'jsa';
  return null;
}

/** Ensure value is an array of strings (handles Supabase/Postgres array shape). */
function asFormArray(forms_completed: unknown): string[] {
  if (Array.isArray(forms_completed)) {
    return forms_completed.map((f) => (typeof f === 'string' ? f : String(f)));
  }
  if (forms_completed != null && typeof forms_completed === 'object' && !Array.isArray(forms_completed)) {
    return Object.values(forms_completed).map((f) => String(f));
  }
  return [];
}

function getDateRange(period: Period): { start: string | null; end: string | null } {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  if (period === 'all') {
    return { start: null, end: null };
  }
  
  const startDate = new Date(now);
  
  switch (period) {
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(startDate.getMonth() - 3);
      break;
  }
  
  return { start: startDate.toISOString().split('T')[0], end: today };
}

function calculateSafetyScore(entry: {
  compliance_rate: number;
  announcement_engagement: number;
  streak_bonus: number;
}): number {
  // Weighted safety score:
  // - 60% compliance rate (forms completed)
  // - 25% announcement engagement
  // - 15% streak bonus
  const score = (
    entry.compliance_rate * 0.60 +
    entry.announcement_engagement * 0.25 +
    entry.streak_bonus * 0.15
  );
  return Math.min(100, Math.round(score));
}

// ============================================================================
// QUERY KEYS
// ============================================================================

export const safetyAnalyticsKeys = {
  all: ['safety-analytics'] as const,
  stats: (period: Period) => ['safety-analytics', 'stats', period] as const,
  leaderboard: (period: Period, limit: number) => ['safety-analytics', 'leaderboard', period, limit] as const,
  trends: (period: Period) => ['safety-analytics', 'trends', period] as const,
  userDetail: (userId: string, period: Period) => ['safety-analytics', 'user', userId, period] as const,
};

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useSafetyAnalytics(period: Period = 'month', leaderboardLimit: number = 20) {
  const { start, end } = getDateRange(period);
  
  return useQuery({
    queryKey: safetyAnalyticsKeys.stats(period),
    queryFn: async (): Promise<SafetyAnalyticsResult> => {
      // Fetch all data sources in parallel (each function handles its own errors)
      const [
        complianceLeaderboard,
        complianceData,
        announcementData,
        usersData,
        trendData,
        ledgerByUser,
      ] = await Promise.all([
        fetchComplianceLeaderboardRPC(start, end, leaderboardLimit)
          .catch((error) => { logger.warn('[useSafetyAnalytics] Compliance leaderboard fetch failed, continuing with empty data', error); return [] as ComplianceLeaderboardEntry[]; }),
        fetchComplianceData(start, end)
          .catch((error) => { logger.warn('[useSafetyAnalytics] Compliance data fetch failed, continuing with empty data', error); return [] as ComplianceRecord[]; }),
        fetchAnnouncementData(start, end)
          .catch((error) => { logger.warn('[useSafetyAnalytics] Announcement data fetch failed, continuing with empty data', error); return [] as AnnouncementRecord[]; }),
        fetchUsersData()
          .catch((error) => { logger.warn('[useSafetyAnalytics] Users data fetch failed, continuing with empty data', error); return [] as UserRecord[]; }),
        fetchTrendData(period)
          .catch((error) => { logger.warn('[useSafetyAnalytics] Trend data fetch failed, continuing with empty data', error); return [] as SafetyTrendData[]; }),
        fetchLedgerByUser(start, end)
          .catch((error) => { logger.warn('[useSafetyAnalytics] Ledger fetch failed, continuing with empty data', error); return new Map<string, number>(); }),
      ]);
      
      // Build unified leaderboard combining RPC data with announcement data
      let leaderboard: UnifiedLeaderboardEntry[] = [];
      try {
        leaderboard = await buildUnifiedLeaderboardFromRPC(
          complianceLeaderboard,
          announcementData,
          leaderboardLimit,
          ledgerByUser
        );
      } catch (error) {
        logger.warn('[useSafetyAnalytics] Leaderboard build failed, continuing with empty data', error);
      }
      
      // Calculate stats
      const stats = calculateStats(
        complianceData,
        announcementData,
        usersData,
        ledgerByUser
      );
      
      // Calculate form breakdown
      const formBreakdown = calculateFormBreakdown(complianceData);
      
      return {
        stats,
        leaderboard,
        trends: trendData,
        formBreakdown,
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: false,
  });
}

// ============================================================================
// DATA FETCHING
// ============================================================================

interface ComplianceLeaderboardEntry {
  user_id: string;
  full_name: string;
  role: string;
  total_points: number;
  total_days: number;
  full_compliance_days: number;
  rank: number;
}

/**
 * Fetch compliance leaderboard using the RPC function (bypasses RLS)
 */
async function fetchComplianceLeaderboardRPC(
  start: string | null, 
  end: string | null, 
  limit: number
): Promise<ComplianceLeaderboardEntry[]> {
  try {
    const { data, error } = await supabase.rpc('get_compliance_leaderboard', {
      p_start_date: start,
      p_end_date: end,
      p_limit: limit
    });
    
    if (error) {
      // Function might not exist yet if migration hasn't run
      if (error.code === '42883') {
        logger.warn('[useSafetyAnalytics] get_compliance_leaderboard function not found - migration pending');
        return [];
      }
      throw error;
    }
    
    return data || [];
  } catch (error) {
    logger.error('[useSafetyAnalytics] Failed to fetch compliance leaderboard via RPC', error);
    return [];
  }
}

interface ComplianceRecord {
  user_id: string;
  date_for: string;
  forms_completed: string[];
  points_awarded: number;
}

async function fetchComplianceData(start: string | null, end: string | null): Promise<ComplianceRecord[]> {
  try {
    let query = supabase
      .from('compliance_rewards')
      .select('user_id, date_for, forms_completed, points_awarded')
      .order('date_for', { ascending: false });
    
    if (start) query = query.gte('date_for', start);
    if (end) query = query.lte('date_for', end);
    
    const { data, error } = await query;
    
    if (error) {
      logger.warn('[useSafetyAnalytics] compliance_rewards query failed', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    logger.warn('[useSafetyAnalytics] compliance_rewards exception', error);
    return [];
  }
}

interface AnnouncementRecord {
  user_id: string;
  announcement_id: string;
  points_awarded: number;
  claimed_at: string;
}

async function fetchAnnouncementData(start: string | null, end: string | null): Promise<AnnouncementRecord[]> {
  try {
    let query = supabase
      .from('announcement_rewards')
      .select('user_id, announcement_id, points_awarded, claimed_at')
      .order('claimed_at', { ascending: false });
    
    if (start) query = query.gte('claimed_at', `${start}T00:00:00`);
    if (end) query = query.lte('claimed_at', `${end}T23:59:59`);
    
    const { data, error } = await query;
    
    if (error) {
      logger.warn('[useSafetyAnalytics] announcement_rewards query failed', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    logger.warn('[useSafetyAnalytics] announcement_rewards exception', error);
    return [];
  }
}

/**
 * Aggregate the points ledger (point_transactions) by user within [start, end].
 * This is the single source of truth for a user's total points — it includes
 * compliance points, announcement claims, and any future earning sources.
 * Admin RLS on point_transactions allows reading all rows here.
 * created_at is bounded by the selected period; for 'all' (null start/end)
 * the full ledger balance is returned, matching get_user_point_balance.
 */
async function fetchLedgerByUser(start: string | null, end: string | null): Promise<Map<string, number>> {
  try {
    let query = supabase
      .from('point_transactions')
      .select('user_id, amount, created_at');

    if (start) query = query.gte('created_at', `${start}T00:00:00`);
    if (end) query = query.lte('created_at', `${end}T23:59:59`);

    const { data, error } = await query;

    if (error) {
      logger.warn('[useSafetyAnalytics] point_transactions query failed', error);
      return new Map();
    }

    const map = new Map<string, number>();
    (data || []).forEach((r: { user_id: string; amount: number }) => {
      map.set(r.user_id, (map.get(r.user_id) ?? 0) + r.amount);
    });
    return map;
  } catch (error) {
    logger.warn('[useSafetyAnalytics] point_transactions exception', error);
    return new Map();
  }
}

interface UserRecord {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
}

async function fetchUsersData(): Promise<UserRecord[]> {
  const { data, error } = await supabase
    .from('app_users')
    .select('user_id, full_name, email, role')
    .in('role', ['employee', 'foreman', 'general_foreman', 'admin', 'mechanic', 'safety_officer']);
  
  if (error) {
    logger.error('[useSafetyAnalytics] Failed to fetch users', error);
    return [];
  }
  
  return data || [];
}

async function fetchTrendData(period: Period): Promise<SafetyTrendData[]> {
  try {
    const { start, end } = getDateRange(period);
    
    // Get compliance and announcement data in parallel
    let complianceQuery = supabase
      .from('compliance_rewards')
      .select('date_for, points_awarded');
    
    if (start) complianceQuery = complianceQuery.gte('date_for', start);
    if (end) complianceQuery = complianceQuery.lte('date_for', end);
    
    let announcementQuery = supabase
      .from('announcement_rewards')
      .select('claimed_at, points_awarded');
    
    if (start) announcementQuery = announcementQuery.gte('claimed_at', `${start}T00:00:00`);
    if (end) announcementQuery = announcementQuery.lte('claimed_at', `${end}T23:59:59`);

    const [{ data: complianceData }, { data: announcementData }] = await Promise.all([
      complianceQuery,
      announcementQuery,
    ]);
    
    // Aggregate by date
    const dateMap = new Map<string, SafetyTrendData>();
    
    // Process compliance data
    (complianceData || []).forEach(record => {
      const date = record.date_for;
      const existing = dateMap.get(date) || {
        date,
        compliance_submissions: 0,
        announcement_claims: 0,
        total_points: 0,
        compliance_rate: 0,
      };
      existing.compliance_submissions += 1;
      existing.total_points += record.points_awarded;
      dateMap.set(date, existing);
    });
    
    // Process announcement data
    (announcementData || []).forEach(record => {
      const date = record.claimed_at.split('T')[0];
      const existing = dateMap.get(date) || {
        date,
        compliance_submissions: 0,
        announcement_claims: 0,
        total_points: 0,
        compliance_rate: 0,
      };
      existing.announcement_claims += 1;
      existing.total_points += record.points_awarded;
      dateMap.set(date, existing);
    });
    
    // Sort by date and return
    return Array.from(dateMap.values())
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    logger.warn('[useSafetyAnalytics] fetchTrendData exception', error);
    return [];
  }
}

// ============================================================================
// DATA PROCESSING
// ============================================================================

/**
 * Build unified leaderboard from RPC compliance data + announcement data + user data
 */
async function buildUnifiedLeaderboardFromRPC(
  complianceLeaderboard: ComplianceLeaderboardEntry[],
  announcementData: AnnouncementRecord[],
  limit: number,
  ledgerByUser: Map<string, number>
): Promise<UnifiedLeaderboardEntry[]> {
  // Aggregate announcement data by user
  const announcementByUser = new Map<string, {
    points: number;
    count: number;
  }>();
  
  announcementData.forEach(record => {
    const existing = announcementByUser.get(record.user_id) || { points: 0, count: 0 };
    existing.points += record.points_awarded;
    existing.count += 1;
    announcementByUser.set(record.user_id, existing);
  });
  
  // Get all unique user IDs (from both sources)
  const allUserIds = new Set<string>();
  complianceLeaderboard.forEach(r => allUserIds.add(r.user_id));
  announcementData.forEach(r => allUserIds.add(r.user_id));
  
  // Create map of compliance data by user
  const complianceByUser = new Map<string, ComplianceLeaderboardEntry>();
  complianceLeaderboard.forEach(entry => {
    complianceByUser.set(entry.user_id, entry);
  });
  
  // Fetch user details for users who have announcement rewards but no compliance data
  const announcementOnlyUserIds = Array.from(allUserIds).filter(id => !complianceByUser.has(id));
  const userDetailsMap = new Map<string, { full_name: string | null; email: string | null; role: string }>();
  
  if (announcementOnlyUserIds.length > 0) {
    try {
      const { data: userData, error } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, email, role')
        .in('user_id', announcementOnlyUserIds);
      
      if (error) {
        logger.warn('[useSafetyAnalytics] Failed to fetch user details for announcement-only users', error);
      } else {
        (userData || []).forEach(user => {
          if (user.user_id) {
            userDetailsMap.set(user.user_id, {
              full_name: user.full_name,
              email: user.email,
              role: user.role || 'employee',
            });
          }
        });
      }
    } catch (error) {
      logger.warn('[useSafetyAnalytics] Exception fetching user details', error);
    }
  }
  
  // Build entries
  const entries: UnifiedLeaderboardEntry[] = [];
  
  allUserIds.forEach(userId => {
    const compliance = complianceByUser.get(userId);
    const announcement = announcementByUser.get(userId);
    const userDetail = userDetailsMap.get(userId);
    
    const compliancePoints = compliance?.total_points || 0;
    const announcementPoints = announcement?.points || 0;
    const complianceDays = compliance?.total_days || 0;
    const fullComplianceDays = compliance?.full_compliance_days || 0;
    const announcementsClaimed = announcement?.count || 0;
    
    // Calculate compliance rate
    const complianceRate = complianceDays > 0 
      ? (fullComplianceDays / complianceDays) * 100 
      : 0;
    
    // Calculate announcement engagement (normalized to 100)
    const announcementEngagement = Math.min(100, (announcementsClaimed / 30) * 100);
    
    // Calculate streak
    const currentStreak = fullComplianceDays > 0 ? Math.min(fullComplianceDays, 5) : 0;
    const longestStreak = fullComplianceDays;
    const streakBonus = Math.min(100, currentStreak * 20);
    
    // Calculate safety score
    const safetyScore = calculateSafetyScore({
      compliance_rate: complianceRate,
      announcement_engagement: announcementEngagement,
      streak_bonus: streakBonus,
    });
    
    // Get user name from compliance data or user details lookup
    const fullName = compliance?.full_name || userDetail?.full_name || 'Unknown User';
    const role = compliance?.role || userDetail?.role || 'employee';
    const email = userDetail?.email || null;
    
    entries.push({
      user_id: userId,
      full_name: fullName,
      email: email,
      role: role,
      rank: 0,
      compliance_points: compliancePoints,
      compliance_days: complianceDays,
      full_compliance_days: fullComplianceDays,
      compliance_rate: Math.round(complianceRate),
      announcement_points: announcementPoints,
      announcements_claimed: announcementsClaimed,
      // Single source of truth: the ledger balance for the period. The
      // compliance/announcement figures above remain as informational
      // breakdowns. Falls back to the breakdown sum only if the ledger
      // read returned nothing for this user.
      total_points: ledgerByUser.get(userId) ?? (compliancePoints + announcementPoints),
      safety_score: safetyScore,
      current_streak: currentStreak,
      longest_streak: longestStreak,
    });
  });
  
  // Sort by safety score, then total points
  entries.sort((a, b) => {
    if (b.safety_score !== a.safety_score) return b.safety_score - a.safety_score;
    return b.total_points - a.total_points;
  });
  
  // Assign ranks
  entries.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });
  
  return entries.slice(0, limit);
}

function calculateStats(
  complianceData: ComplianceRecord[],
  announcementData: AnnouncementRecord[],
  usersData: UserRecord[],
  ledgerByUser: Map<string, number>
): SafetyAnalyticsStats {
  // Get unique user IDs with any activity
  const activeUserIds = new Set<string>();
  complianceData.forEach(r => activeUserIds.add(r.user_id));
  announcementData.forEach(r => activeUserIds.add(r.user_id));
  
  // Calculate totals. Compliance/announcement remain informational breakdowns;
  // the combined total is taken from the ledger (single source of truth).
  const totalCompliancePoints = complianceData.reduce((sum, r) => sum + r.points_awarded, 0);
  const totalAnnouncementPoints = announcementData.reduce((sum, r) => sum + r.points_awarded, 0);
  let ledgerTotal = 0;
  ledgerByUser.forEach((amount) => { ledgerTotal += amount; });
  // Fall back to the breakdown sum only if the ledger read returned nothing.
  const totalCombinedPoints = ledgerByUser.size > 0
    ? ledgerTotal
    : totalCompliancePoints + totalAnnouncementPoints;
  
  // Calculate compliance metrics from full compliance data (not capped leaderboard)
  const uniqueComplianceDays = new Set(complianceData.map(r => `${r.user_id}-${r.date_for}`));
  const isFullCompliance = (r: ComplianceRecord) => asFormArray(r.forms_completed).length === 3;
  const fullComplianceRecords = complianceData.filter(isFullCompliance);
  const fullComplianceUsers = new Set(fullComplianceRecords.map(r => r.user_id)).size;

  // Per-user compliance rate from all compliance data, then average (calibrated org-wide)
  const userComplianceDays = new Map<string, { total: number; full: number }>();
  complianceData.forEach((r) => {
    const cur = userComplianceDays.get(r.user_id) ?? { total: 0, full: 0 };
    cur.total += 1;
    if (isFullCompliance(r)) cur.full += 1;
    userComplianceDays.set(r.user_id, cur);
  });
  let sumRates = 0;
  let countUsersWithCompliance = 0;
  userComplianceDays.forEach(({ total, full }) => {
    if (total > 0) {
      sumRates += (full / total) * 100;
      countUsersWithCompliance += 1;
    }
  });
  const avgComplianceRate =
    countUsersWithCompliance > 0 ? sumRates / countUsersWithCompliance : 0;
  
  // Announcement metrics
  const totalAnnouncementsClaimed = announcementData.length;
  
  // Engagement rate (users who claimed / total active users)
  const usersWhoClaimed = new Set(announcementData.map(r => r.user_id)).size;
  const announcementEngagementRate = activeUserIds.size > 0
    ? (usersWhoClaimed / activeUserIds.size) * 100
    : 0;
  
  return {
    total_users: usersData.length,
    active_users: activeUserIds.size,
    total_compliance_points: totalCompliancePoints,
    total_announcement_points: totalAnnouncementPoints,
    total_combined_points: totalCombinedPoints,
    avg_compliance_rate: Math.round(avgComplianceRate),
    full_compliance_users: fullComplianceUsers,
    total_compliance_days: uniqueComplianceDays.size,
    total_announcements_claimed: totalAnnouncementsClaimed,
    announcement_engagement_rate: Math.round(announcementEngagementRate),
    points_trend: 0, // Would need previous period data
    compliance_trend: 0,
  };
}

function calculateFormBreakdown(complianceData: ComplianceRecord[]): FormBreakdown[] {
  const counts = { dvir: 0, equipment: 0, jsa: 0 };

  complianceData.forEach((record) => {
    const forms = asFormArray(record.forms_completed);
    forms.forEach((form) => {
      const key = normalizeFormType(form);
      if (key) counts[key] += 1;
    });
  });

  const total = counts.dvir + counts.equipment + counts.jsa;

  return [
    { form_type: 'dvir', submissions: counts.dvir, percentage: total > 0 ? Math.round((counts.dvir / total) * 100) : 0 },
    { form_type: 'equipment', submissions: counts.equipment, percentage: total > 0 ? Math.round((counts.equipment / total) * 100) : 0 },
    { form_type: 'jsa', submissions: counts.jsa, percentage: total > 0 ? Math.round((counts.jsa / total) * 100) : 0 },
  ];
}

// ============================================================================
// INDIVIDUAL USER HOOK
// ============================================================================

export interface UserSafetyDetail {
  user_id: string;
  full_name: string;
  email: string | null;
  role: string;
  // Points breakdown
  compliance_points: number;
  announcement_points: number;
  total_points: number;
  safety_score: number;
  // Compliance detail
  compliance_days: number;
  full_compliance_days: number;
  compliance_rate: number;
  forms_breakdown: FormBreakdown[];
  // Announcement detail
  announcements_claimed: number;
  recent_claims: Array<{
    id: string;
    announcement_id: string;
    title: string | null;
    points: number;
    claimed_at: string;
  }>;
  // Streaks
  current_streak: number;
  longest_streak: number;
  // Timeline
  activity_timeline: Array<{
    date: string;
    type: 'compliance' | 'announcement';
    points: number;
    details: string;
  }>;
}

export function useUserSafetyDetail(userId: string, period: Period = 'month') {
  const { start, end } = getDateRange(period);
  
  return useQuery({
    queryKey: safetyAnalyticsKeys.userDetail(userId, period),
    queryFn: async (): Promise<UserSafetyDetail | null> => {
      // Fetch user info
      const { data: userData, error: userError } = await supabase
        .from('app_users')
        .select('user_id, full_name, email, role')
        .eq('user_id', userId)
        .single();
      
      if (userError || !userData) {
        return null;
      }
      
      // Fetch compliance and announcement data in parallel (both independent, only need userId)
      let complianceQuery = supabase
        .from('compliance_rewards')
        .select('*')
        .eq('user_id', userId)
        .order('date_for', { ascending: false });
      
      if (start) complianceQuery = complianceQuery.gte('date_for', start);
      if (end) complianceQuery = complianceQuery.lte('date_for', end);
      
      let announcementQuery = supabase
        .from('announcement_rewards')
        .select(`
          id,
          announcement_id,
          points_awarded,
          claimed_at,
          announcements:announcement_id (title)
        `)
        .eq('user_id', userId)
        .order('claimed_at', { ascending: false });
      
      if (start) announcementQuery = announcementQuery.gte('claimed_at', `${start}T00:00:00`);
      if (end) announcementQuery = announcementQuery.lte('claimed_at', `${end}T23:59:59`);

      // Ledger balance for this user/period (single source of truth for total_points).
      const ledgerByUser = await fetchLedgerByUser(start, end).catch((error) => {
        logger.warn('[useUserSafetyDetail] Ledger fetch failed, continuing with breakdown sum', error);
        return new Map<string, number>();
      });

      const [{ data: complianceData }, { data: announcementData }] = await Promise.all([
        complianceQuery,
        announcementQuery,
      ]);
      
      // Calculate metrics
      const compliancePoints = (complianceData || []).reduce((sum, r) => sum + (r.points_awarded || 0), 0);
      const announcementPoints = (announcementData || []).reduce((sum, r) => sum + (r.points_awarded || 0), 0);
      // total_points comes from the ledger; compliance/announcement stay as breakdowns.
      const ledgerTotalPoints = ledgerByUser.get(userId) ?? (compliancePoints + announcementPoints);
      const complianceDays = complianceData?.length || 0;
      const fullComplianceDays = (complianceData || []).filter((r) => asFormArray(r.forms_completed).length === 3).length;
      const complianceRate = complianceDays > 0 ? Math.round((fullComplianceDays / complianceDays) * 100) : 0;

      // Forms breakdown
      const formCounts = { dvir: 0, equipment: 0, jsa: 0 };
      (complianceData || []).forEach((record) => {
        asFormArray(record.forms_completed).forEach((form) => {
          const key = normalizeFormType(form);
          if (key) formCounts[key] += 1;
        });
      });
      const totalForms = formCounts.dvir + formCounts.equipment + formCounts.jsa;
      
      // Build activity timeline
      const timeline: UserSafetyDetail['activity_timeline'] = [];
      
      (complianceData || []).forEach(record => {
        timeline.push({
          date: record.date_for,
          type: 'compliance',
          points: record.points_awarded,
          details: `Completed ${asFormArray(record.forms_completed).join(', ') || 'forms'}`,
        });
      });
      
      (announcementData || []).forEach(record => {
        timeline.push({
          date: record.claimed_at.split('T')[0],
          type: 'announcement',
          points: record.points_awarded,
          details: 'Safety announcement claim',
        });
      });
      
      timeline.sort((a, b) => b.date.localeCompare(a.date));
      
      // Calculate safety score
      const safetyScore = calculateSafetyScore({
        compliance_rate: complianceRate,
        announcement_engagement: Math.min(100, ((announcementData?.length || 0) / 30) * 100),
        streak_bonus: Math.min(100, fullComplianceDays * 20),
      });
      
      return {
        user_id: userData.user_id,
        full_name: userData.full_name || 'Unknown User',
        email: userData.email,
        role: userData.role,
        compliance_points: compliancePoints,
        announcement_points: announcementPoints,
        total_points: ledgerTotalPoints,
        safety_score: safetyScore,
        compliance_days: complianceDays,
        full_compliance_days: fullComplianceDays,
        compliance_rate: complianceRate,
        forms_breakdown: [
          { form_type: 'dvir', submissions: formCounts.dvir, percentage: totalForms > 0 ? Math.round((formCounts.dvir / totalForms) * 100) : 0 },
          { form_type: 'equipment', submissions: formCounts.equipment, percentage: totalForms > 0 ? Math.round((formCounts.equipment / totalForms) * 100) : 0 },
          { form_type: 'jsa', submissions: formCounts.jsa, percentage: totalForms > 0 ? Math.round((formCounts.jsa / totalForms) * 100) : 0 },
        ],
        announcements_claimed: announcementData?.length || 0,
        recent_claims: (announcementData || []).slice(0, 10).map(r => ({
          id: r.id,
          announcement_id: r.announcement_id,
          title: (r as { announcements?: { title?: string } }).announcements?.title || null,
          points: r.points_awarded,
          claimed_at: r.claimed_at,
        })),
        current_streak: Math.min(fullComplianceDays, 5),
        longest_streak: fullComplianceDays,
        activity_timeline: timeline.slice(0, 20),
      };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });
}
