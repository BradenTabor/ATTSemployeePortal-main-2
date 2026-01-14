/**
 * Unified Fixes Hook
 * 
 * Aggregates fix/repair data from all 3 sources:
 * 1. vehicle_maintenance_log (repairs log)
 * 2. dvir_reports (deficiency_corrected)
 * 3. daily_equipment_inspections (mechanic_fixes)
 * 
 * Provides unified view for the Parts side of Parts & Repairs Log
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { logger } from '../../../lib/logger';
import type {
  UnifiedFix,
  UnifiedFixFilters,
  AssetFixStats,
  FixesAiSummary,
  PartUsed,
  AssetType,
  FixSource,
} from '../types/maintenance.types';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_PAGE_SIZE = 20;

// Estimated costs for common fix types when cost not provided
const ESTIMATED_COSTS: Record<string, number> = {
  'oil_change': 150,
  'tire_rotation': 50,
  'tire_replacement': 800,
  'brake_repair': 300,
  'light_replacement': 25,
  'default': 100,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function normalizeAssetNumber(num: string | null | undefined): string {
  return (num || '').toUpperCase().trim();
}

function determineAssetType(
  truckNumber?: string | null,
  equipmentType?: string | null
): AssetType {
  if (truckNumber) return 'truck';
  if (equipmentType) {
    const type = equipmentType.toLowerCase();
    if (type.includes('chipper')) return 'chipper';
    if (type.includes('trailer')) return 'trailer';
  }
  return 'equipment';
}

function extractDeficiencies(
  vehicleChecklist: Record<string, unknown> | null,
  aerialChecklist: Record<string, unknown> | null
): string[] {
  const deficiencies: string[] = [];
  
  if (vehicleChecklist) {
    for (const [key, value] of Object.entries(vehicleChecklist)) {
      if (value === 'F' || value === false || value === 'fail') {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        deficiencies.push(label);
      }
    }
  }
  
  if (aerialChecklist) {
    for (const [key, value] of Object.entries(aerialChecklist)) {
      if (value === 'F' || value === false || value === 'fail') {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        if (!deficiencies.includes(label)) {
          deficiencies.push(label);
        }
      }
    }
  }
  
  return deficiencies;
}

function extractEquipmentDeficiencies(
  generalChecklist: Record<string, unknown> | null,
  specificChecklist: Record<string, unknown> | null
): string[] {
  const deficiencies: string[] = [];
  
  if (generalChecklist) {
    for (const [key, value] of Object.entries(generalChecklist)) {
      if (value === 'F' || value === false || value === 'fail') {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        deficiencies.push(label);
      }
    }
  }
  
  if (specificChecklist) {
    for (const [key, value] of Object.entries(specificChecklist)) {
      if (value === 'F' || value === false || value === 'fail') {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        if (!deficiencies.includes(label)) {
          deficiencies.push(label);
        }
      }
    }
  }
  
  return deficiencies;
}

// =============================================================================
// FETCH FUNCTIONS
// =============================================================================

interface RawMaintenanceLog {
  id: string;
  truck_number: string;
  maintenance_type: string;
  description: string;
  parts_used: PartUsed[] | null;
  mileage_at_service: number;
  cost: number | null;
  performed_by_name: string;
  service_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface RawDvirReport {
  id: string;
  truck_number: string | null;
  mileage: number | null;
  deficiency_corrected: string | null;
  mechanic_remarks: string | null;
  mechanic_date: string | null;
  mechanic_truck_number: string | null;
  mechanic_cost: number | null;
  mechanic_parts_used: PartUsed[] | null;
  vehicle_trailer_checklist: Record<string, unknown> | null;
  aerial_checklist: Record<string, unknown> | null;
  drivers_name: string | null;
  created_at: string;
}

interface RawEquipmentInspection {
  id: string;
  equipment_type: string;
  equipment_number: string;
  mechanic_fixes: string | null;
  mechanic_cost: number | null;
  mechanic_parts_used: PartUsed[] | null;
  last_mechanic_updated_at: string | null;
  general_checklist: Record<string, unknown> | null;
  specific_checklist: Record<string, unknown> | null;
  submitted_by: string | null;
  inspection_date: string;
  notes: string | null;
  created_at: string;
}

/**
 * Fetch and normalize maintenance log entries
 */
async function fetchMaintenanceLogFixes(): Promise<UnifiedFix[]> {
  const { data, error } = await supabase
    .from('vehicle_maintenance_log')
    .select('*')
    .order('service_date', { ascending: false });
  
  if (error) {
    logger.error('Failed to fetch maintenance logs:', error);
    throw error;
  }
  
  return (data || []).map((log: RawMaintenanceLog) => ({
    id: `ml_${log.id}`,
    source: 'repairs_log' as FixSource,
    source_id: log.id,
    asset_type: 'truck' as AssetType,
    asset_number: normalizeAssetNumber(log.truck_number),
    description: log.description,
    deficiencies_corrected: [log.maintenance_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())],
    parts_used: log.parts_used || [],
    cost: log.cost,
    estimated_cost: log.cost ? null : ESTIMATED_COSTS[log.maintenance_type] || ESTIMATED_COSTS.default,
    fix_date: log.service_date,
    performed_by: log.performed_by_name,
    mileage_at_fix: log.mileage_at_service,
    notes: log.notes,
    created_at: log.created_at,
    updated_at: log.updated_at,
  }));
}

/**
 * Fetch and normalize DVIR fix entries (only those with fixes logged)
 */
async function fetchDvirFixes(): Promise<UnifiedFix[]> {
  const { data, error } = await supabase
    .from('dvir_reports')
    .select('*')
    .not('deficiency_corrected', 'is', null)
    .order('mechanic_date', { ascending: false, nullsFirst: false });
  
  if (error) {
    logger.error('Failed to fetch DVIR fixes:', error);
    throw error;
  }
  
  return (data || [])
    .filter((dvir: RawDvirReport) => dvir.deficiency_corrected?.trim())
    .map((dvir: RawDvirReport) => {
      const deficiencies = extractDeficiencies(
        dvir.vehicle_trailer_checklist,
        dvir.aerial_checklist
      );
      
      return {
        id: `dvir_${dvir.id}`,
        source: 'dvir' as FixSource,
        source_id: dvir.id,
        asset_type: 'truck' as AssetType,
        asset_number: normalizeAssetNumber(dvir.truck_number || dvir.mechanic_truck_number),
        description: dvir.deficiency_corrected || '',
        deficiencies_corrected: deficiencies.length > 0 ? deficiencies : ['DVIR Deficiency'],
        parts_used: dvir.mechanic_parts_used || [],
        cost: dvir.mechanic_cost,
        estimated_cost: dvir.mechanic_cost ? null : ESTIMATED_COSTS.default,
        fix_date: dvir.mechanic_date || dvir.created_at.split('T')[0],
        performed_by: null,
        mileage_at_fix: dvir.mileage,
        notes: dvir.mechanic_remarks,
        created_at: dvir.created_at,
        updated_at: undefined,
      };
    });
}

/**
 * Fetch and normalize equipment inspection fix entries
 */
async function fetchEquipmentFixes(): Promise<UnifiedFix[]> {
  const { data, error } = await supabase
    .from('daily_equipment_inspections')
    .select('*')
    .not('mechanic_fixes', 'is', null)
    .order('last_mechanic_updated_at', { ascending: false, nullsFirst: false });
  
  if (error) {
    logger.error('Failed to fetch equipment fixes:', error);
    throw error;
  }
  
  return (data || [])
    .filter((equip: RawEquipmentInspection) => equip.mechanic_fixes?.trim())
    .map((equip: RawEquipmentInspection) => {
      const assetType = determineAssetType(null, equip.equipment_type);
      const deficiencies = extractEquipmentDeficiencies(
        equip.general_checklist,
        equip.specific_checklist
      );
      
      return {
        id: `equip_${equip.id}`,
        source: 'equipment' as FixSource,
        source_id: equip.id,
        asset_type: assetType,
        asset_number: normalizeAssetNumber(equip.equipment_number),
        description: equip.mechanic_fixes || '',
        deficiencies_corrected: deficiencies.length > 0 ? deficiencies : ['Equipment Issue'],
        parts_used: equip.mechanic_parts_used || [],
        cost: equip.mechanic_cost,
        estimated_cost: equip.mechanic_cost ? null : ESTIMATED_COSTS.default,
        fix_date: equip.last_mechanic_updated_at?.split('T')[0] || equip.inspection_date,
        performed_by: null,
        mileage_at_fix: null,
        notes: equip.notes,
        created_at: equip.created_at,
        updated_at: equip.last_mechanic_updated_at || undefined,
      };
    });
}

// =============================================================================
// AI SUMMARY FUNCTION
// =============================================================================

export interface FixesAiSummaryResponse {
  success: boolean;
  summary: FixesAiSummary;
  error?: string;
}

/**
 * Generate AI summary for all fixes
 */
export async function generateFixesAiSummary(
  filters?: UnifiedFixFilters
): Promise<FixesAiSummaryResponse> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    throw new Error('Not authenticated. Please log in to generate summaries.');
  }
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Supabase URL not configured');
  }
  
  const functionUrl = `${supabaseUrl}/functions/v1/generate-fixes-summary`;
  
  let response: Response;
  try {
    response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        filters,
      }),
    });
  } catch (fetchError) {
    // Network error or function not deployed
    logger.error('Fixes AI fetch error:', fetchError);
    throw new Error(
      'Unable to reach Fixes AI service. The edge function may not be deployed yet. ' +
      'Run: supabase functions deploy generate-fixes-summary'
    );
  }
  
  // Handle non-JSON responses (like 404 HTML pages)
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    logger.error('Fixes AI non-JSON response:', response.status, contentType);
    throw new Error(
      `Edge function returned non-JSON response (${response.status}). ` +
      'The function may not be deployed. Run: supabase functions deploy generate-fixes-summary'
    );
  }
  
  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(result.error || `Failed to generate summary (${response.status})`);
  }
  
  return result;
}

// =============================================================================
// REACT HOOK
// =============================================================================

interface UseUnifiedFixesResult {
  // Data
  fixes: UnifiedFix[];
  filteredFixes: UnifiedFix[];
  paginatedFixes: UnifiedFix[];
  assetStats: AssetFixStats[];
  
  // AI Summary
  aiSummary: FixesAiSummary | null;
  isLoadingAi: boolean;
  aiError: string | null;
  
  // Pagination
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  
  // Filters
  filters: UnifiedFixFilters;
  setFilters: (filters: UnifiedFixFilters) => void;
  clearFilters: () => void;
  
  // Loading/Error states
  isLoading: boolean;
  error: string | null;
  
  // Actions
  refetch: () => Promise<void>;
  generateAiSummary: () => Promise<void>;
  
  // Summary stats
  totalCost: number;
  totalEstimatedCost: number;
  fixesThisMonth: number;
}

export function useUnifiedFixes(): UseUnifiedFixesResult {
  // Data state
  const [fixes, setFixes] = useState<UnifiedFix[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // AI Summary state
  const [aiSummary, setAiSummary] = useState<FixesAiSummary | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  
  // Filter state
  const [filters, setFilters] = useState<UnifiedFixFilters>({});
  
  // Fetch all fixes from all sources
  const fetchAllFixes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [maintenanceFixes, dvirFixes, equipmentFixes] = await Promise.all([
        fetchMaintenanceLogFixes(),
        fetchDvirFixes(),
        fetchEquipmentFixes(),
      ]);
      
      // Combine and sort by date (newest first)
      const allFixes = [...maintenanceFixes, ...dvirFixes, ...equipmentFixes]
        .sort((a, b) => new Date(b.fix_date).getTime() - new Date(a.fix_date).getTime());
      
      setFixes(allFixes);
    } catch (err) {
      logger.error('Failed to fetch unified fixes:', err);
      setError('Failed to load fix history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Initial load
  useEffect(() => {
    fetchAllFixes();
  }, [fetchAllFixes]);
  
  // Apply filters
  const filteredFixes = useMemo(() => {
    let result = fixes;
    
    // Search filter
    if (filters.search?.trim()) {
      const query = filters.search.toLowerCase();
      result = result.filter(fix =>
        fix.asset_number.toLowerCase().includes(query) ||
        fix.description.toLowerCase().includes(query) ||
        fix.deficiencies_corrected?.some(d => d.toLowerCase().includes(query)) ||
        fix.performed_by?.toLowerCase().includes(query)
      );
    }
    
    // Asset type filter
    if (filters.asset_type && filters.asset_type !== 'all') {
      result = result.filter(fix => fix.asset_type === filters.asset_type);
    }
    
    // Source filter
    if (filters.source && filters.source !== 'all') {
      result = result.filter(fix => fix.source === filters.source);
    }
    
    // Date filters
    if (filters.date_from) {
      result = result.filter(fix => fix.fix_date >= filters.date_from!);
    }
    if (filters.date_to) {
      result = result.filter(fix => fix.fix_date <= filters.date_to!);
    }
    
    // Cost filters
    if (filters.cost_min !== undefined) {
      result = result.filter(fix => (fix.cost || fix.estimated_cost || 0) >= filters.cost_min!);
    }
    if (filters.cost_max !== undefined) {
      result = result.filter(fix => (fix.cost || fix.estimated_cost || 0) <= filters.cost_max!);
    }
    
    // Asset number filter
    if (filters.asset_number?.trim()) {
      const assetNum = filters.asset_number.toUpperCase().trim();
      result = result.filter(fix => fix.asset_number === assetNum);
    }
    
    return result;
  }, [fixes, filters]);
  
  // Calculate pagination
  const totalCount = filteredFixes.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  
  const paginatedFixes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredFixes.slice(start, start + pageSize);
  }, [filteredFixes, currentPage, pageSize]);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);
  
  // Calculate asset stats
  const assetStats = useMemo(() => {
    const statsMap = new Map<string, AssetFixStats>();
    
    for (const fix of fixes) {
      const key = `${fix.asset_type}_${fix.asset_number}`;
      const existing = statsMap.get(key);
      
      if (existing) {
        existing.total_fixes++;
        existing.total_cost += fix.cost || 0;
        existing.estimated_cost += fix.estimated_cost || 0;
        existing.parts_count += fix.parts_used?.length || 0;
        
        // Track last fix date
        if (!existing.last_fix_date || fix.fix_date > existing.last_fix_date) {
          existing.last_fix_date = fix.fix_date;
        }
        
        // Track common issues
        fix.deficiencies_corrected?.forEach(issue => {
          if (!existing.most_common_issues.includes(issue)) {
            existing.most_common_issues.push(issue);
          }
        });
        
        // Update mileage if higher
        if (fix.mileage_at_fix && (!existing.current_mileage || fix.mileage_at_fix > existing.current_mileage)) {
          existing.current_mileage = fix.mileage_at_fix;
        }
      } else {
        statsMap.set(key, {
          asset_type: fix.asset_type,
          asset_number: fix.asset_number,
          total_fixes: 1,
          total_cost: fix.cost || 0,
          estimated_cost: fix.estimated_cost || 0,
          last_fix_date: fix.fix_date,
          most_common_issues: fix.deficiencies_corrected?.slice(0, 5) || [],
          parts_count: fix.parts_used?.length || 0,
          current_mileage: fix.mileage_at_fix,
        });
      }
    }
    
    // Sort by total fixes (most first)
    return Array.from(statsMap.values())
      .sort((a, b) => b.total_fixes - a.total_fixes);
  }, [fixes]);
  
  // Calculate summary stats
  const totalCost = useMemo(() => 
    fixes.reduce((sum, fix) => sum + (fix.cost || 0), 0),
  [fixes]);
  
  const totalEstimatedCost = useMemo(() =>
    fixes.reduce((sum, fix) => sum + (fix.cost || fix.estimated_cost || 0), 0),
  [fixes]);
  
  const fixesThisMonth = useMemo(() => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    return fixes.filter(fix => fix.fix_date >= firstOfMonth).length;
  }, [fixes]);
  
  // Generate AI summary
  const generateAiSummaryFn = useCallback(async () => {
    setIsLoadingAi(true);
    setAiError(null);
    
    try {
      const result = await generateFixesAiSummary(filters);
      if (result.success) {
        setAiSummary(result.summary);
      } else {
        throw new Error(result.error || 'Failed to generate summary');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate AI summary';
      logger.error('AI summary error:', err);
      setAiError(message);
    } finally {
      setIsLoadingAi(false);
    }
  }, [filters]);
  
  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({});
    setCurrentPage(1);
  }, []);
  
  return {
    // Data
    fixes,
    filteredFixes,
    paginatedFixes,
    assetStats,
    
    // AI Summary
    aiSummary,
    isLoadingAi,
    aiError,
    
    // Pagination
    currentPage,
    totalPages,
    pageSize,
    totalCount,
    setCurrentPage,
    setPageSize,
    
    // Filters
    filters,
    setFilters,
    clearFilters,
    
    // Loading/Error
    isLoading,
    error,
    
    // Actions
    refetch: fetchAllFixes,
    generateAiSummary: generateAiSummaryFn,
    
    // Summary stats
    totalCost,
    totalEstimatedCost,
    fixesThisMonth,
  };
}

export default useUnifiedFixes;
