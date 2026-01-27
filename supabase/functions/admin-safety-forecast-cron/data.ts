/**
 * Data fetching functions for Supabase queries
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { WorkSite, CrewMember, CrewResult, CrewRiskFactors, AlgorithmConfig, RiskLevel, RiskFactorsBreakdown } from './types.ts';

// =============================================================================
// ALGORITHM CONFIG
// =============================================================================

/**
 * Fetch the active risk algorithm configuration from database
 */
export async function getActiveAlgorithmConfig(supabase: SupabaseClient): Promise<AlgorithmConfig | null> {
  const { data, error } = await supabase
    .from('risk_algorithm_config')
    .select('*')
    .eq('is_active', true)
    .single();

  if (error) {
    console.error('[Config] Failed to fetch active algorithm config:', error.message);
    return null;
  }

  return data as AlgorithmConfig;
}

// =============================================================================
// RISK SCORE HISTORY
// =============================================================================

export interface RiskScoreHistoryRecord {
  date_for: string;
  work_site_id: string;
  work_site_name: string;
  total_score: number;
  risk_level: RiskLevel;
  weather_factors: Record<string, unknown>;
  crew_factors: Record<string, unknown>;
  equipment_factors: Record<string, unknown>;
  temporal_factors: Record<string, unknown>;
  top_drivers: string[];
  recommendations: string[];
  algorithm_version: string;
}

/**
 * Save a risk score to history for calibration tracking
 */
export async function saveRiskScoreToHistory(
  supabase: SupabaseClient,
  record: RiskScoreHistoryRecord
): Promise<string | null> {
  const { data, error } = await supabase
    .from('risk_score_history')
    .upsert(record, {
      onConflict: 'date_for,work_site_id',
      ignoreDuplicates: false,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[History] Failed to save risk score:', error.message);
    return null;
  }

  return data?.id || null;
}

/**
 * Save multiple risk scores to history in a batch
 */
export async function saveRiskScoresToHistory(
  supabase: SupabaseClient,
  records: RiskScoreHistoryRecord[]
): Promise<{ saved: number; failed: number }> {
  if (records.length === 0) {
    return { saved: 0, failed: 0 };
  }

  const { data, error } = await supabase
    .from('risk_score_history')
    .upsert(records, {
      onConflict: 'date_for,work_site_id',
      ignoreDuplicates: false,
    })
    .select('id');

  if (error) {
    console.error('[History] Failed to batch save risk scores:', error.message);
    return { saved: 0, failed: records.length };
  }

  const savedCount = data?.length || 0;
  return { saved: savedCount, failed: records.length - savedCount };
}

// =============================================================================
// WORK SITES
// =============================================================================

export async function getActiveWorkSites(supabase: SupabaseClient): Promise<WorkSite[]> {
  const { data, error } = await supabase
    .from('work_sites')
    .select('id, name, latitude, longitude, region, crew_id')
    .eq('is_active', true);

  if (error) {
    console.error('[Sites] Error:', error);
    return [];
  }

  return (data || []) as WorkSite[];
}

// =============================================================================
// CREW DATA
// =============================================================================

export async function getCrewForSite(
  supabase: SupabaseClient, 
  siteId: string, 
  _dateFor: string, 
  siteDefaultCrewId: string | null
): Promise<CrewResult> {
  const userIds = new Set<string>();
  let hasActiveJobs = false;
  let crewName: string | null = null;

  // Strategy 1: Get active jobs for this site with crew_id (new method)
  const { data: jobsWithCrew } = await supabase
    .from('job_progress_trackers')
    .select('id, crew_id')
    .eq('work_site_id', siteId)
    .eq('status', 'active');

  // Collect crew_ids from jobs that have them
  const crewIds = new Set<string>();
  const jobIds: string[] = [];
  
  for (const job of (jobsWithCrew || [])) {
    jobIds.push(job.id);
    hasActiveJobs = true;
    if (job.crew_id) {
      crewIds.add(job.crew_id);
    }
  }

  // Strategy 2: Get members from crew_members table for job crew_ids
  if (crewIds.size > 0) {
    // Get crew name from the first crew
    const { data: crewData } = await supabase
      .from('crews')
      .select('name')
      .in('id', Array.from(crewIds))
      .limit(1)
      .single();
    
    if (crewData) {
      crewName = crewData.name;
    }

    const { data: crewMembers } = await supabase
      .from('crew_members')
      .select('user_id')
      .in('crew_id', Array.from(crewIds));
    
    for (const cm of (crewMembers || [])) {
      userIds.add(cm.user_id);
    }
  }

  // Strategy 3: Get individual job_crew_assignments (legacy method)
  if (jobIds.length > 0) {
    const { data: assignments } = await supabase
      .from('job_crew_assignments')
      .select('user_id')
      .in('job_id', jobIds);

    for (const a of (assignments || [])) {
      userIds.add(a.user_id);
    }
  }

  // Strategy 4: Fall back to site's default crew if no active jobs
  if (userIds.size === 0 && siteDefaultCrewId) {
    console.log(`[Crew] No active jobs for site ${siteId}, using default crew ${siteDefaultCrewId}`);
    
    // Get default crew name
    const { data: defaultCrewData } = await supabase
      .from('crews')
      .select('name')
      .eq('id', siteDefaultCrewId)
      .single();
    
    if (defaultCrewData) {
      crewName = defaultCrewData.name + ' (default)';
    }

    const { data: defaultCrewMembers } = await supabase
      .from('crew_members')
      .select('user_id')
      .eq('crew_id', siteDefaultCrewId);
    
    for (const cm of (defaultCrewMembers || [])) {
      userIds.add(cm.user_id);
    }
  }

  if (userIds.size === 0) {
    console.log(`[Crew] No crew found for site ${siteId}`);
    return { members: [], hasActiveJobs, crewName: null };
  }

  // Get user details
  const { data: users } = await supabase
    .from('app_users')
    .select('user_id, full_name, hire_date, experience_level')
    .in('user_id', Array.from(userIds));

  console.log(`[Crew] Found ${users?.length || 0} members for site ${siteId}`);
  return { 
    members: (users || []) as CrewMember[], 
    hasActiveJobs, 
    crewName 
  };
}

// =============================================================================
// CREW RISK ANALYSIS
// =============================================================================

export function analyzeCrewRisk(crewResult: CrewResult): CrewRiskFactors {
  const { members, hasActiveJobs, crewName } = crewResult;
  const now = new Date();
  let newHireCount = 0;
  let hasExpert = false;

  for (const member of members) {
    // Check if new hire (< 12 months)
    if (member.hire_date) {
      const hireDate = new Date(member.hire_date);
      const monthsDiff = (now.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsDiff < 12) newHireCount++;
    }

    if (member.experience_level === 'expert') {
      hasExpert = true;
    }
  }

  return {
    totalCount: members.length,
    newHireCount,
    hasExpert,
    crewName,
    hasActiveJobs,
  };
}

// =============================================================================
// EQUIPMENT DEFECTS
// =============================================================================

export async function getRecentDefects(supabase: SupabaseClient): Promise<string[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const criticalKeywords = ['brake', 'steering', 'hydraulic', 'electrical', 'lights', 'tire'];
  const criticalDefects: string[] = [];

  // Check DVIR reports
  const { data: dvirs } = await supabase
    .from('dvir_reports')
    .select('truck_number, vehicle_trailer_checklist, aerial_checklist')
    .gte('created_at', since);

  for (const dvir of (dvirs || [])) {
    const checkFailed = (checklist: Record<string, boolean> | null) => {
      if (!checklist) return [];
      return Object.entries(checklist)
        .filter(([key, val]) => val === false && key !== 'na_items')
        .map(([key]) => key.replace(/_/g, ' '));
    };

    const vehicleFailed = checkFailed(dvir.vehicle_trailer_checklist);
    const aerialFailed = checkFailed(dvir.aerial_checklist);
    const allFailed = [...vehicleFailed, ...aerialFailed];

    for (const item of allFailed) {
      if (criticalKeywords.some(kw => item.toLowerCase().includes(kw))) {
        criticalDefects.push(`Truck ${dvir.truck_number}: ${item}`);
      }
    }
  }

  return criticalDefects.slice(0, 10); // Limit to 10
}
