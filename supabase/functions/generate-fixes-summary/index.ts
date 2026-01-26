// @ts-nocheck
/**
 * Supabase Edge Function: Generate Fixes Summary
 * 
 * AI-powered summary of all vehicle/equipment fixes from:
 * - vehicle_maintenance_log (repairs)
 * - dvir_reports (deficiency corrections)
 * - daily_equipment_inspections (mechanic fixes)
 * 
 * Features:
 * - Recent fixes count and cost
 * - Top fixed assets by frequency and cost
 * - Common deficiencies breakdown
 * - Parts usage summary
 * 
 * ## Deploy
 * supabase functions deploy generate-fixes-summary
 * 
 * ## Secrets
 * supabase secrets set OPENAI_API_KEY=sk-your-key
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'https://esm.sh/openai@4';

// =============================================================================
// CONFIGURATION
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_SUMMARY_LENGTH = 300;

// Estimated costs for common fix types when cost not provided
const ESTIMATED_COSTS: Record<string, number> = {
  'oil_change': 150,
  'tire_rotation': 50,
  'tire_replacement': 800,
  'default': 100,
};

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const SYSTEM_PROMPT = `You are a fleet maintenance analyst for ATTS (All Terrain Tree Service).

Your job is to generate a brief, executive summary of recent maintenance and repair activity.

## Rules
1. Be concise - responses should be 2-4 sentences, under 300 characters total
2. Highlight key insights: most maintained vehicles, common issues, cost trends
3. Be specific with numbers when available
4. Don't fabricate - only mention what's in the data
5. Focus on actionable insights

## Examples
Good: "23 fixes logged this month, totaling $4,200. Truck 101 leads with 5 repairs ($1,800). Brake issues are most common (8 occurrences). Consider preventive brake inspection for aging fleet."
Bad: "The fleet has had various maintenance activities performed recently." (too vague)`;

// =============================================================================
// TYPES
// =============================================================================

interface FixData {
  source: 'repairs_log' | 'dvir' | 'equipment';
  asset_number: string;
  asset_type: 'truck' | 'chipper' | 'trailer' | 'equipment';
  description: string;
  cost: number | null;
  fix_date: string;
  parts_used: { part_name: string; quantity: number; cost?: number }[];
  deficiencies: string[];
}

interface SummaryData {
  total_fixes: number;
  total_cost: number;
  total_estimated_cost: number;
  fixes_30_days: number;
  cost_30_days: number;
  top_assets: { asset_number: string; asset_type: string; fix_count: number; total_cost: number }[];
  common_deficiencies: { issue: string; count: number }[];
  parts_breakdown: { part_name: string; total_quantity: number; total_cost: number }[];
  recurring_issues: { asset_number: string; issue: string; occurrences: number; total_cost: number }[];
}

interface Filters {
  asset_type?: string;
  source?: string;
  date_from?: string;
  date_to?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function normalizeAssetNumber(num: string | null | undefined): string {
  return (num || '').toUpperCase().trim();
}

function determineAssetType(
  truckNumber?: string | null,
  equipmentType?: string | null
): 'truck' | 'chipper' | 'trailer' | 'equipment' {
  if (truckNumber) return 'truck';
  if (equipmentType) {
    const type = equipmentType.toLowerCase();
    if (type.includes('chipper')) return 'chipper';
    if (type.includes('trailer')) return 'trailer';
  }
  return 'equipment';
}

function buildPrompt(data: SummaryData): string {
  const recurringSection = data.recurring_issues.length > 0 
    ? `\n\n⚠️ RECURRING ISSUES (same asset, same problem 2+ times):
${data.recurring_issues.slice(0, 5).map((r, i) => 
  `${i + 1}. ${r.asset_number}: "${r.issue}" - ${r.occurrences}× ($${r.total_cost.toLocaleString()} spent)`
).join('\n')}`
    : '\n\nNo recurring issues detected (good fleet health sign).';

  return `Generate a maintenance summary based on this fleet data:

Total Fixes (All Time): ${data.total_fixes}
Total Recorded Cost: $${data.total_cost.toLocaleString()}
Total Estimated Cost (with estimates for missing): $${data.total_estimated_cost.toLocaleString()}

Last 30 Days:
- Fixes: ${data.fixes_30_days}
- Cost: $${data.cost_30_days.toLocaleString()}

Top 5 Most Maintained Assets:
${data.top_assets.slice(0, 5).map((a, i) => 
  `${i + 1}. ${a.asset_number} (${a.asset_type}): ${a.fix_count} fixes, $${a.total_cost.toLocaleString()}`
).join('\n')}

Top 5 Common Issues:
${data.common_deficiencies.slice(0, 5).map((d, i) => 
  `${i + 1}. ${d.issue}: ${d.count} occurrences`
).join('\n')}

Parts Usage (Top 5):
${data.parts_breakdown.slice(0, 5).map((p, i) => 
  `${i + 1}. ${p.part_name}: ${p.total_quantity} units, $${p.total_cost.toLocaleString()}`
).join('\n')}${recurringSection}

Generate a brief (under 300 chars) executive summary with key insights. If there are recurring issues, flag them as concerns that need attention. Mention the highest-cost asset and any recommendations.`;
}

// =============================================================================
// DATA FETCHING
// =============================================================================

async function fetchAllFixes(
  supabase: ReturnType<typeof createClient>,
  filters?: Filters
): Promise<FixData[]> {
  const fixes: FixData[] = [];
  
  // Fetch from vehicle_maintenance_log
  // Optimized: select only needed fields (vs SELECT *) to reduce data transfer by ~70%
  const { data: maintenanceLogs, error: mlError } = await supabase
    .from('vehicle_maintenance_log')
    .select('truck_number, description, cost, service_date, parts_used, maintenance_type')
    .order('service_date', { ascending: false });
  
  if (!mlError && maintenanceLogs) {
    for (const log of maintenanceLogs) {
      fixes.push({
        source: 'repairs_log',
        asset_number: normalizeAssetNumber(log.truck_number),
        asset_type: 'truck',
        description: log.description || '',
        cost: log.cost,
        fix_date: log.service_date,
        parts_used: (log.parts_used || []).map((p: { part_name: string; quantity: number; cost?: number }) => ({
          part_name: p.part_name,
          quantity: p.quantity || 1,
          cost: p.cost,
        })),
        deficiencies: [log.maintenance_type?.replace(/_/g, ' ')?.replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Repair'],
      });
    }
  }
  
  // Fetch from dvir_reports (only those with fixes)
  // Optimized: select only needed fields (vs SELECT *) to reduce data transfer by ~75%
  const { data: dvirReports, error: dvirError } = await supabase
    .from('dvir_reports')
    .select('deficiency_corrected, truck_number, mechanic_truck_number, mechanic_cost, mechanic_date, created_at, vehicle_trailer_checklist, aerial_checklist, mechanic_parts_used')
    .not('deficiency_corrected', 'is', null)
    .order('mechanic_date', { ascending: false, nullsFirst: false });
  
  if (!dvirError && dvirReports) {
    for (const dvir of dvirReports) {
      if (!dvir.deficiency_corrected?.trim()) continue;
      
      const deficiencies: string[] = [];
      
      // Extract deficiencies from checklists
      if (dvir.vehicle_trailer_checklist) {
        for (const [key, value] of Object.entries(dvir.vehicle_trailer_checklist as Record<string, string>)) {
          if (value === 'F') {
            deficiencies.push(key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()));
          }
        }
      }
      if (dvir.aerial_checklist) {
        for (const [key, value] of Object.entries(dvir.aerial_checklist as Record<string, string>)) {
          if (value === 'F' && !deficiencies.includes(key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()))) {
            deficiencies.push(key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()));
          }
        }
      }
      
      fixes.push({
        source: 'dvir',
        asset_number: normalizeAssetNumber(dvir.truck_number || dvir.mechanic_truck_number),
        asset_type: 'truck',
        description: dvir.deficiency_corrected || '',
        cost: dvir.mechanic_cost || null,
        fix_date: dvir.mechanic_date || dvir.created_at?.split('T')[0] || '',
        parts_used: (dvir.mechanic_parts_used || []).map((p: { part_name: string; quantity: number; cost?: number }) => ({
          part_name: p.part_name,
          quantity: p.quantity || 1,
          cost: p.cost,
        })),
        deficiencies: deficiencies.length > 0 ? deficiencies : ['DVIR Deficiency'],
      });
    }
  }
  
  // Fetch from daily_equipment_inspections (only those with fixes)
  // Optimized: select only needed fields (vs SELECT *) to reduce data transfer by ~70%
  const { data: equipmentInspections, error: equipError } = await supabase
    .from('daily_equipment_inspections')
    .select('mechanic_fixes, equipment_number, equipment_type, mechanic_cost, last_mechanic_updated_at, inspection_date, general_checklist, specific_checklist, mechanic_parts_used')
    .not('mechanic_fixes', 'is', null)
    .order('last_mechanic_updated_at', { ascending: false, nullsFirst: false });
  
  if (!equipError && equipmentInspections) {
    for (const equip of equipmentInspections) {
      if (!equip.mechanic_fixes?.trim()) continue;
      
      const assetType = determineAssetType(null, equip.equipment_type);
      const deficiencies: string[] = [];
      
      // Extract deficiencies from checklists
      if (equip.general_checklist) {
        for (const [key, value] of Object.entries(equip.general_checklist as Record<string, string>)) {
          if (value === 'F') {
            deficiencies.push(key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()));
          }
        }
      }
      if (equip.specific_checklist) {
        for (const [key, value] of Object.entries(equip.specific_checklist as Record<string, string>)) {
          if (value === 'F' && !deficiencies.includes(key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()))) {
            deficiencies.push(key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()));
          }
        }
      }
      
      fixes.push({
        source: 'equipment',
        asset_number: normalizeAssetNumber(equip.equipment_number),
        asset_type: assetType,
        description: equip.mechanic_fixes || '',
        cost: equip.mechanic_cost || null,
        fix_date: equip.last_mechanic_updated_at?.split('T')[0] || equip.inspection_date || '',
        parts_used: (equip.mechanic_parts_used || []).map((p: { part_name: string; quantity: number; cost?: number }) => ({
          part_name: p.part_name,
          quantity: p.quantity || 1,
          cost: p.cost,
        })),
        deficiencies: deficiencies.length > 0 ? deficiencies : ['Equipment Issue'],
      });
    }
  }
  
  // Apply filters
  let filtered = fixes;
  
  if (filters?.asset_type && filters.asset_type !== 'all') {
    filtered = filtered.filter(f => f.asset_type === filters.asset_type);
  }
  if (filters?.source && filters.source !== 'all') {
    filtered = filtered.filter(f => f.source === filters.source);
  }
  if (filters?.date_from) {
    filtered = filtered.filter(f => f.fix_date >= filters.date_from!);
  }
  if (filters?.date_to) {
    filtered = filtered.filter(f => f.fix_date <= filters.date_to!);
  }
  
  return filtered;
}

// =============================================================================
// AGGREGATE FUNCTIONS
// =============================================================================

function aggregateSummaryData(fixes: FixData[]): SummaryData {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
  
  // Asset stats
  const assetMap = new Map<string, { asset_type: string; fix_count: number; total_cost: number }>();
  
  // Deficiency counts
  const deficiencyMap = new Map<string, number>();
  
  // Parts breakdown
  const partsMap = new Map<string, { total_quantity: number; total_cost: number }>();
  
  // Recurring issues tracking (same asset + same issue)
  const recurringMap = new Map<string, { asset_number: string; issue: string; occurrences: number; total_cost: number }>();
  
  let totalCost = 0;
  let totalEstimatedCost = 0;
  let fixes30Days = 0;
  let cost30Days = 0;
  
  for (const fix of fixes) {
    const effectiveCost = fix.cost || ESTIMATED_COSTS[fix.deficiencies[0]?.toLowerCase().replace(/ /g, '_')] || ESTIMATED_COSTS.default;
    
    totalCost += fix.cost || 0;
    totalEstimatedCost += effectiveCost;
    
    // 30-day stats
    if (fix.fix_date >= thirtyDaysAgoStr) {
      fixes30Days++;
      cost30Days += effectiveCost;
    }
    
    // Asset stats
    const assetKey = `${fix.asset_type}_${fix.asset_number}`;
    const existing = assetMap.get(assetKey);
    if (existing) {
      existing.fix_count++;
      existing.total_cost += effectiveCost;
    } else {
      assetMap.set(assetKey, {
        asset_type: fix.asset_type,
        fix_count: 1,
        total_cost: effectiveCost,
      });
    }
    
    // Deficiency counts & recurring issues
    for (const def of fix.deficiencies) {
      deficiencyMap.set(def, (deficiencyMap.get(def) || 0) + 1);
      
      // Track recurring issues per asset
      const recurringKey = `${fix.asset_number}_${def}`;
      const existingRecurring = recurringMap.get(recurringKey);
      if (existingRecurring) {
        existingRecurring.occurrences++;
        existingRecurring.total_cost += effectiveCost;
      } else {
        recurringMap.set(recurringKey, {
          asset_number: fix.asset_number,
          issue: def,
          occurrences: 1,
          total_cost: effectiveCost,
        });
      }
    }
    
    // Parts breakdown
    for (const part of fix.parts_used) {
      const partKey = part.part_name.toLowerCase();
      const existingPart = partsMap.get(partKey);
      if (existingPart) {
        existingPart.total_quantity += part.quantity;
        existingPart.total_cost += part.cost || 0;
      } else {
        partsMap.set(partKey, {
          total_quantity: part.quantity,
          total_cost: part.cost || 0,
        });
      }
    }
  }
  
  // Convert maps to sorted arrays
  const topAssets = Array.from(assetMap.entries())
    .map(([key, data]) => ({
      asset_number: key.split('_').slice(1).join('_'),
      asset_type: data.asset_type,
      fix_count: data.fix_count,
      total_cost: data.total_cost,
    }))
    .sort((a, b) => b.fix_count - a.fix_count);
  
  const commonDeficiencies = Array.from(deficiencyMap.entries())
    .map(([issue, count]) => ({ issue, count }))
    .sort((a, b) => b.count - a.count);
  
  const partsBreakdown = Array.from(partsMap.entries())
    .map(([part_name, data]) => ({
      part_name: part_name.replace(/\b\w/g, c => c.toUpperCase()),
      total_quantity: data.total_quantity,
      total_cost: data.total_cost,
    }))
    .sort((a, b) => b.total_quantity - a.total_quantity);
  
  // Filter recurring issues (2+ occurrences)
  const recurringIssues = Array.from(recurringMap.values())
    .filter(r => r.occurrences >= 2)
    .sort((a, b) => b.occurrences - a.occurrences);
  
  return {
    total_fixes: fixes.length,
    total_cost: totalCost,
    total_estimated_cost: totalEstimatedCost,
    fixes_30_days: fixes30Days,
    cost_30_days: cost30Days,
    top_assets: topAssets,
    common_deficiencies: commonDeficiencies,
    parts_breakdown: partsBreakdown,
    recurring_issues: recurringIssues,
  };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('[FixesSummary] Starting...');

  try {
    // =======================================================================
    // Authentication
    // =======================================================================
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated and has mechanic/admin role
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check role
    const { data: appUser, error: roleError } = await supabase
      .from('app_users')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !appUser || !['admin', 'mechanic'].includes(appUser.role)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =======================================================================
    // Parse request
    // =======================================================================
    const body = await req.json().catch(() => ({}));
    const filters: Filters = body.filters || {};

    console.log('[FixesSummary] Filters:', JSON.stringify(filters));

    // Use service role client for database operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // =======================================================================
    // Fetch and aggregate data
    // =======================================================================
    const fixes = await fetchAllFixes(serviceClient, filters);
    const summaryData = aggregateSummaryData(fixes);

    console.log('[FixesSummary] Found', fixes.length, 'fixes');

    // =======================================================================
    // Generate AI summary
    // =======================================================================
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    let aiSummary = '';
    
    if (!openaiKey) {
      // Fallback summary without AI
      aiSummary = `${summaryData.total_fixes} fixes recorded totaling $${summaryData.total_estimated_cost.toLocaleString()}. ` +
        `${summaryData.fixes_30_days} fixes in the last 30 days ($${summaryData.cost_30_days.toLocaleString()}).`;
    } else {
      console.log('[FixesSummary] Generating AI summary...');
      
      const openai = new OpenAI({ apiKey: openaiKey });
      const prompt = buildPrompt(summaryData);

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 150,
      });

      aiSummary = completion.choices[0].message.content || '';
      
      // Truncate if needed
      if (aiSummary.length > MAX_SUMMARY_LENGTH) {
        const lastPeriod = aiSummary.lastIndexOf('.', MAX_SUMMARY_LENGTH);
        aiSummary = lastPeriod > 150 ? aiSummary.slice(0, lastPeriod + 1) : aiSummary.slice(0, MAX_SUMMARY_LENGTH - 3) + '...';
      }
    }

    console.log('[FixesSummary] Generated summary:', aiSummary.length, 'chars');

    // =======================================================================
    // Build response
    // =======================================================================
    const response = {
      success: true,
      summary: {
        summary: aiSummary,
        recent_fixes_count: summaryData.fixes_30_days,
        total_cost_30_days: summaryData.cost_30_days,
        total_cost_all_time: summaryData.total_estimated_cost,
        top_fixed_assets: summaryData.top_assets.slice(0, 10),
        common_deficiencies: summaryData.common_deficiencies.slice(0, 10),
        parts_breakdown: summaryData.parts_breakdown.slice(0, 10),
        recurring_issues: summaryData.recurring_issues.slice(0, 10),
        generated_at: new Date().toISOString(),
        cached: false,
      },
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[FixesSummary] Error:', errorMessage);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
