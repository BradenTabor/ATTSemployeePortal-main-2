// @ts-nocheck
/**
 * auto-tune-risk-algorithm Edge Function
 * 
 * Weekly automated tuning of the risk algorithm based on prediction accuracy.
 * Runs every Sunday at 2 AM UTC via pg_cron.
 * 
 * Logic:
 * 1. Check if auto-tuning is enabled
 * 2. Calculate accuracy for last 30 days
 * 3. If accuracy < 75%, analyze factor performance
 * 4. Create new config version with recommended adjustments
 * 5. Activate new config immediately (no approval needed)
 * 6. Log decision to audit trail
 * 7. Send FYI notification to admins
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET")!;

// Map factor names from top_drivers to config field names
function getConfigFieldForFactor(factorText: string): string | null {
  const mappings: Record<string, string> = {
    'wind': 'wind_multiplier_per_mph',
    'wind gust': 'wind_multiplier_per_mph',
    'heat index': 'heat_moderate_multiplier',
    'extreme heat': 'heat_extreme_multiplier',
    'high heat': 'heat_moderate_multiplier',
    'new hire': 'new_hire_moderate_multiplier',
    'monday': 'monday_multiplier',
    'no expert': 'no_expert_multiplier',
    'equipment defect': 'critical_defect_increment',
    'critical defect': 'critical_defect_increment',
    'equipment warning': 'warning_defect_increment',
    'precipitation': 'precipitation_moderate_multiplier',
    'weather alert': 'weather_alert_multiplier',
    'holiday': 'post_holiday_multiplier',
    'solo worker': 'solo_no_expert_multiplier',
  };
  
  const lowerFactor = factorText.toLowerCase();
  for (const [keyword, field] of Object.entries(mappings)) {
    if (lowerFactor.includes(keyword)) {
      return field;
    }
  }
  return null;
}

// Type definitions
interface AutoTuningConfig {
  enabled: boolean;
  min_accuracy_threshold: number;
  max_multiplier_increase: number;
  max_multiplier_decrease: number;
  max_adjustments_per_run: number;
  evaluation_period_days: number;
  min_sample_size: number;
}

interface FactorRecommendation {
  factor: string;
  recommendation: string;
  false_positive_rate: number;
  times_triggered: number;
}

interface AlgorithmConfig {
  id: string;
  version: string;
  is_active: boolean;
  [key: string]: unknown;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Health check endpoint
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    
    const { data } = await supabase
      .from('algorithm_tuning_runs')
      .select('started_at, status')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();
    
    return new Response(JSON.stringify({ 
      status: 'healthy',
      function: 'auto-tune-risk-algorithm',
      last_run: data?.started_at || null,
      last_status: data?.status || null,
    }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startTime = Date.now();
  console.log("[auto-tune] Starting weekly auto-tuning...");

  try {
    // Create service role client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ===========================================
    // Step 1: Check if auto-tuning is enabled
    // ===========================================
    const { data: config, error: configError } = await supabase
      .from('auto_tuning_config')
      .select('*')
      .single();

    if (configError || !config) {
      console.error("[auto-tune] Failed to fetch auto_tuning_config:", configError?.message);
      return new Response(JSON.stringify({
        success: false,
        action: 'error',
        error: 'Failed to fetch auto_tuning_config',
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tuningConfig = config as AutoTuningConfig;

    if (!tuningConfig.enabled) {
      console.log("[auto-tune] Auto-tuning is disabled. Exiting.");
      
      // Log the decision
      await supabase.from('tuning_decisions_log').insert({
        decision_type: 'disabled',
        decision_maker: 'auto_tuner',
        adjustment_reason: 'Auto-tuning is disabled in configuration',
      });

      return new Response(JSON.stringify({
        success: true,
        action: 'disabled',
        message: 'Auto-tuning is disabled',
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===========================================
    // Step 2: Get current config version
    // ===========================================
    const { data: currentConfig, error: currentConfigError } = await supabase
      .from('risk_algorithm_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (currentConfigError || !currentConfig) {
      console.error("[auto-tune] No active config found:", currentConfigError?.message);
      return new Response(JSON.stringify({
        success: false,
        action: 'error',
        error: 'No active risk_algorithm_config found',
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const activeConfig = currentConfig as AlgorithmConfig;
    console.log(`[auto-tune] Current active config: ${activeConfig.version}`);

    // ===========================================
    // Step 3: Calculate accuracy for evaluation period
    // ===========================================
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - tuningConfig.evaluation_period_days * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    console.log(`[auto-tune] Evaluating accuracy from ${startDate} to ${endDate}`);

    const { data: accuracyData, error: accuracyError } = await supabase
      .rpc('calculate_prediction_accuracy', {
        p_start_date: startDate,
        p_end_date: endDate,
      });

    if (accuracyError) {
      console.error("[auto-tune] Failed to calculate accuracy:", accuracyError.message);
      return new Response(JSON.stringify({
        success: false,
        action: 'error',
        error: 'Failed to calculate prediction accuracy',
        details: accuracyError.message,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accuracy = accuracyData?.[0] || {
      total_days: 0,
      accuracy_rate: null,
      true_positives: 0,
      false_positives: 0,
      false_negatives: 0,
      true_negatives: 0,
    };

    console.log(`[auto-tune] Accuracy stats:`, accuracy);

    // Check minimum sample size
    if (accuracy.total_days < tuningConfig.min_sample_size) {
      console.log(`[auto-tune] Insufficient data (${accuracy.total_days} days < ${tuningConfig.min_sample_size} required)`);
      
      await supabase.from('tuning_decisions_log').insert({
        decision_type: 'no_action',
        decision_maker: 'auto_tuner',
        adjustment_reason: `Insufficient data: ${accuracy.total_days} days < ${tuningConfig.min_sample_size} required`,
        supporting_metrics: accuracy,
      });

      return new Response(JSON.stringify({
        success: true,
        action: 'insufficient_data',
        total_days: accuracy.total_days,
        min_required: tuningConfig.min_sample_size,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===========================================
    // Step 4: Check if accuracy meets threshold
    // ===========================================
    const accuracyRate = accuracy.accuracy_rate ?? 0;

    if (accuracyRate >= tuningConfig.min_accuracy_threshold) {
      console.log(`[auto-tune] Accuracy ${accuracyRate}% meets threshold ${tuningConfig.min_accuracy_threshold}%. No tuning needed.`);
      
      await supabase.from('tuning_decisions_log').insert({
        decision_type: 'no_action',
        decision_maker: 'auto_tuner',
        adjustment_reason: `Accuracy ${accuracyRate}% meets threshold ${tuningConfig.min_accuracy_threshold}%`,
        supporting_metrics: accuracy,
      });

      return new Response(JSON.stringify({
        success: true,
        action: 'no_action_needed',
        accuracy_rate: accuracyRate,
        threshold: tuningConfig.min_accuracy_threshold,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[auto-tune] Accuracy ${accuracyRate}% below threshold ${tuningConfig.min_accuracy_threshold}%. Analyzing factors...`);

    // ===========================================
    // Step 5: Analyze factor performance
    // ===========================================
    const { data: factorData, error: factorError } = await supabase
      .rpc('calculate_factor_performance', {
        p_start_date: startDate,
        p_end_date: endDate,
      });

    if (factorError) {
      console.error("[auto-tune] Failed to calculate factor performance:", factorError.message);
    }

    const factors = (factorData || []) as FactorRecommendation[];
    const adjustableFactors = factors
      .filter(f => f.recommendation !== 'maintain')
      .slice(0, tuningConfig.max_adjustments_per_run);

    console.log(`[auto-tune] Found ${adjustableFactors.length} factors to adjust:`, adjustableFactors);

    if (adjustableFactors.length === 0) {
      console.log("[auto-tune] No adjustments identified.");
      
      await supabase.from('tuning_decisions_log').insert({
        decision_type: 'no_action',
        decision_maker: 'auto_tuner',
        adjustment_reason: `No factors identified for adjustment (accuracy: ${accuracyRate}%)`,
        supporting_metrics: { accuracy, factors },
      });

      return new Response(JSON.stringify({
        success: true,
        action: 'no_adjustments_identified',
        accuracy_rate: accuracyRate,
        factors_analyzed: factors.length,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===========================================
    // Step 6: Create new config version
    // ===========================================
    const { data: newVersionData } = await supabase.rpc('get_next_algorithm_version');
    const newVersion = newVersionData || `v${Date.now()}`;

    console.log(`[auto-tune] Creating new config version: ${newVersion}`);

    // Build new config with adjustments
    const ADJUSTMENT_STEP = 0.05;
    const newConfigValues: Record<string, unknown> = { ...activeConfig };
    delete newConfigValues.id;
    delete newConfigValues.created_at;
    delete newConfigValues.created_by;
    newConfigValues.version = newVersion;
    newConfigValues.is_active = false; // Will activate after insert
    newConfigValues.notes = `Auto-tuned from ${activeConfig.version}. Accuracy was ${accuracyRate}%.`;

    const adjustments: Array<{ field: string; old_value: number; new_value: number; factor: string }> = [];

    for (const factor of adjustableFactors) {
      const field = getConfigFieldForFactor(factor.factor);
      if (!field || !(field in activeConfig)) {
        console.log(`[auto-tune] Could not map factor "${factor.factor}" to config field`);
        continue;
      }

      const currentValue = activeConfig[field] as number;
      let newValue = currentValue;

      if (factor.recommendation === 'decrease') {
        newValue = Math.max(
          currentValue - ADJUSTMENT_STEP,
          currentValue - tuningConfig.max_multiplier_decrease,
          0.01 // Never go below 0.01
        );
      } else if (factor.recommendation === 'increase') {
        newValue = Math.min(
          currentValue + ADJUSTMENT_STEP,
          currentValue + tuningConfig.max_multiplier_increase,
          5.00 // Never exceed 5.00
        );
      }

      if (newValue !== currentValue) {
        newConfigValues[field] = Number(newValue.toFixed(3));
        adjustments.push({
          field,
          old_value: currentValue,
          new_value: Number(newValue.toFixed(3)),
          factor: factor.factor,
        });
        console.log(`[auto-tune] Adjusted ${field}: ${currentValue} -> ${newValue.toFixed(3)}`);
      }
    }

    if (adjustments.length === 0) {
      console.log("[auto-tune] No actual adjustments made after mapping.");
      return new Response(JSON.stringify({
        success: true,
        action: 'no_adjustments_applied',
        accuracy_rate: accuracyRate,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert new config
    const { data: insertedConfig, error: insertError } = await supabase
      .from('risk_algorithm_config')
      .insert(newConfigValues)
      .select('id')
      .single();

    if (insertError || !insertedConfig) {
      console.error("[auto-tune] Failed to insert new config:", insertError?.message);
      return new Response(JSON.stringify({
        success: false,
        action: 'error',
        error: 'Failed to create new config version',
        details: insertError?.message,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===========================================
    // Step 7: Activate new config
    // ===========================================
    // Deactivate old config
    await supabase
      .from('risk_algorithm_config')
      .update({ is_active: false })
      .eq('id', activeConfig.id);

    // Activate new config
    await supabase
      .from('risk_algorithm_config')
      .update({ is_active: true })
      .eq('id', insertedConfig.id);

    console.log(`[auto-tune] Activated new config ${newVersion}`);

    // ===========================================
    // Step 8: Create tuning run record
    // ===========================================
    const { data: tuningRun } = await supabase
      .from('algorithm_tuning_runs')
      .insert({
        config_version: newVersion,
        previous_version: activeConfig.version,
        completed_at: new Date().toISOString(),
        days_elapsed: accuracy.total_days,
        total_predictions: accuracy.total_days,
        true_positives: accuracy.true_positives,
        false_positives: accuracy.false_positives,
        false_negatives: accuracy.false_negatives,
        true_negatives: accuracy.true_negatives,
        current_accuracy: accuracyRate,
        baseline_accuracy: accuracyRate,
        status: 'completed',
        decision_reason: `Auto-tuned: accuracy ${accuracyRate}% below ${tuningConfig.min_accuracy_threshold}% threshold`,
        auto_approved: true,
        triggered_by: 'scheduled',
      })
      .select('id')
      .single();

    // ===========================================
    // Step 9: Log adjustments to audit trail
    // ===========================================
    for (const adj of adjustments) {
      await supabase.from('tuning_decisions_log').insert({
        tuning_run_id: tuningRun?.id,
        decision_type: 'adjustment',
        decision_maker: 'auto_tuner',
        factor_adjusted: adj.field,
        old_value: adj.old_value,
        new_value: adj.new_value,
        adjustment_reason: `Factor "${adj.factor}" had high false positive rate`,
        supporting_metrics: { factor: adj.factor, accuracy_before: accuracyRate },
      });
    }

    // Log activation
    await supabase.from('tuning_decisions_log').insert({
      tuning_run_id: tuningRun?.id,
      decision_type: 'activation',
      decision_maker: 'auto_tuner',
      adjustment_reason: `Activated ${newVersion} (auto-tuned from ${activeConfig.version})`,
      supporting_metrics: { adjustments, accuracy_before: accuracyRate },
    });

    // ===========================================
    // Step 10: Send FYI notification to admins
    // ===========================================
    try {
      const notificationUrl = `${SUPABASE_URL}/functions/v1/notifications-dispatch`;
      
      // Create notification event
      const { data: notifEvent } = await supabase
        .from('notification_events')
        .insert({
          category: 'admin_notice',
          severity: 'low',
          target_type: 'role',
          target_ref: 'admin',
          title: `Risk Algorithm Auto-Tuned to ${newVersion}`,
          body: `Accuracy was ${accuracyRate}% (threshold: ${tuningConfig.min_accuracy_threshold}%). ${adjustments.length} factor(s) adjusted.`,
          entity_type: 'algorithm_tuning',
          entity_id: tuningRun?.id,
        })
        .select('id')
        .single();

      if (notifEvent) {
        await fetch(notificationUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "x-internal-key": INTERNAL_SECRET,
          },
          body: JSON.stringify({ event_id: notifEvent.id }),
        });
        console.log(`[auto-tune] Sent FYI notification to admins`);
      }
    } catch (notifError) {
      console.error("[auto-tune] Failed to send notification:", notifError);
      // Don't fail the tuning for notification failure
    }

    // ===========================================
    // Return success
    // ===========================================
    const duration = Date.now() - startTime;
    console.log(`[auto-tune] Completed in ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      action: 'auto_tuned',
      new_version: newVersion,
      previous_version: activeConfig.version,
      accuracy_before: accuracyRate,
      adjustments_count: adjustments.length,
      adjustments,
      duration_ms: duration,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[auto-tune] Unexpected error:", error);
    return new Response(JSON.stringify({
      success: false,
      action: 'error',
      error: "Internal server error",
      details: error instanceof Error ? error.message : undefined,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
