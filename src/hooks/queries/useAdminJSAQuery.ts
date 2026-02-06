import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { logger } from '../../lib/logger';
import type { DailyJsaRecord } from '../../pages/forms/DailyJSAForm';

export interface AdminJSAQueryParams {
  page: number;
  pageSize: number;
  statusFilter: 'all' | 'draft' | 'completed';
  dateFilter?: string;
  dateEndFilter?: string;
  searchQuery?: string;
  signatureFilter?: string;
  userFilter?: string;
  sortField: string;
  sortDirection: 'asc' | 'desc';
}

export interface AdminJSAQueryResult {
  records: Array<DailyJsaRecord & { user_name?: string; user_email?: string; user_role?: string }>;
  total: number;
}

/**
 * Fetch user profiles in batches for large datasets
 */
async function fetchUserProfilesInBatches(
  userIds: string[],
  batchSize = 100
): Promise<Array<{ user_id: string; email: string | null; role: string | null; full_name: string | null }>> {
  if (userIds.length === 0) return [];

  // For small datasets, use single query
  if (userIds.length <= batchSize) {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("user_id, email, role, full_name")
      .in("user_id", userIds);

    if (error) {
      logger.error("Failed to fetch user profiles", { error, userIds: userIds.length });
      return [];
    }
    return data || [];
  }

  // For large datasets, batch queries
  const batches = [];
  for (let i = 0; i < userIds.length; i += batchSize) {
    batches.push(userIds.slice(i, i + batchSize));
  }

  const results = await Promise.all(
    batches.map((batch) =>
      supabase
        .from("user_profiles")
        .select("user_id, email, role, full_name")
        .in("user_id", batch)
    )
  );

  return results.flatMap((r) => {
    if (r.error) {
      logger.error("Failed to fetch user profile batch", { error: r.error, batchSize: 0 });
      return [];
    }
    return (r.data as unknown as Array<{ user_id: string; email: string | null; role: string | null; full_name: string | null }>) || [];
  });
}

/**
 * Fetch admin JSA records with filters and pagination
 */
async function fetchAdminJSARecords(params: AdminJSAQueryParams): Promise<AdminJSAQueryResult> {
  const {
    page,
    pageSize,
    statusFilter,
    dateFilter,
    dateEndFilter,
    searchQuery,
    signatureFilter,
    userFilter,
    sortField,
    sortDirection,
  } = params;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // PERF-017: Select only needed columns instead of SELECT *
  // Fields used in list view and detail view
  let query = supabase
    .from("daily_jsa")
    .select(`
      id,
      user_id,
      job_date,
      work_location,
      circuit_number,
      status,
      employee_signature,
      nearest_hospital,
      nearest_clinic,
      notes,
      updated_at,
      created_at,
      jobs_performed,
      weather_conditions,
      hazards_present,
      traffic_hazards,
      traffic_setup,
      spans,
      observer_signatures,
      shared_with_users,
      call_in_time,
      call_out_time,
      oc_contact,
      doc_contact,
      gf_contact,
      safety_contact,
      weather_hazards,
      ppe,
      employee_signature_path,
      status_changed_at,
      completed_at,
      status_history,
      jsa_type,
      tree_felling_data
    `, { count: "exact" })
    .order(sortField === "user_name" ? "user_id" : sortField, { ascending: sortDirection === "asc" })
    .range(from, to);

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  if (dateFilter) {
    query = query.gte("job_date", dateFilter);
  }

  if (dateEndFilter) {
    query = query.lte("job_date", dateEndFilter);
  }

  if (searchQuery?.trim()) {
    const pattern = `%${searchQuery.trim()}%`;
    query = query.or(
      `work_location.ilike.${pattern},circuit_number.ilike.${pattern},notes.ilike.${pattern}`
    );
  }

  if (signatureFilter?.trim()) {
    query = query.ilike("employee_signature", `%${signatureFilter.trim()}%`);
  }

  if (userFilter) {
    query = query.eq("user_id", userFilter);
  }

  const { data, error: listError, count } = await query;

  if (listError) {
    throw listError;
  }

  const rows = (data as DailyJsaRecord[]) || [];
  const userIds = Array.from(
    new Set(rows.map((row) => row.user_id).filter(Boolean))
  );
  const userMap = new Map<string, { email: string | null; role: string | null; full_name: string | null }>();

  if (userIds.length > 0) {
    const profiles = await fetchUserProfilesInBatches(userIds);
    profiles.forEach((profile) => {
      userMap.set(profile.user_id, {
        email: profile.email,
        role: profile.role,
        full_name: profile.full_name,
      });
    });
  }

  const enriched = rows.map((row) => {
    const meta = userMap.get(row.user_id);
    return {
      ...row,
      user_name: meta?.full_name || meta?.email || "Unknown User",
      user_email: meta?.email ?? undefined,
      user_role: meta?.role ?? "No role assigned",
    };
  });

  // Sort by user_name if needed (since we can't sort by it directly in the query)
  if (params.sortField === "user_name") {
    enriched.sort((a, b) => {
      const nameA = (a.user_name || "").toLowerCase();
      const nameB = (b.user_name || "").toLowerCase();
      return params.sortDirection === "asc" 
        ? nameA.localeCompare(nameB) 
        : nameB.localeCompare(nameA);
    });
  }

  // Log missing user profiles for ops visibility
  const unknownUserCount = enriched.filter((r) => r.user_name === "Unknown User").length;
  if (unknownUserCount > 0) {
    logger.warn("admin_jsa_unknown_users", {
      count: unknownUserCount,
      total_jsas: enriched.length,
      percentage: ((unknownUserCount / enriched.length) * 100).toFixed(2),
      affected_user_ids: enriched
        .filter((r) => r.user_name === "Unknown User")
        .map((r) => r.user_id)
        .slice(0, 10), // Limit to first 10 for log size
    });
  }

  return {
    records: enriched,
    total: typeof count === "number" ? count : rows.length,
  };
}

/**
 * React Query hook for Admin JSA records with caching
 */
export function useAdminJSAQuery(params: AdminJSAQueryParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.jsa.adminList(params),
    queryFn: () => fetchAdminJSARecords(params),
    enabled: enabled,
    staleTime: 1000 * 30, // 30 seconds - data is fresh for 30s
    gcTime: 1000 * 60 * 5, // 5 minutes - keep in cache for 5 min
    refetchOnWindowFocus: true, // Refetch when window regains focus
    placeholderData: (previousData) => previousData, // Show cached data while refetching
  });
}
