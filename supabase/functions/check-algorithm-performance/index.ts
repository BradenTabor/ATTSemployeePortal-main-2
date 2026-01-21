// @ts-nocheck
/**
 * check-algorithm-performance Edge Function
 * 
 * Daily performance check for auto-rollback if accuracy degrades.
 * Runs every day at 3 AM UTC via pg_cron.
 * 
 * Logic:
 * 1. Get current config age
 * 2. If < 7 days old, skip (not enough data)
 * 3. Calculate accuracy for last 7 days
 * 4. Compare to baseline from algorithm_tuning_runs
 * 5. If accuracy dropped by 10%+:
 *    - Rollback to previous version
 *    - Pause auto-tuning
 *    - Send CRITICAL notification
 * 6. Log decision to audit trail
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

// Type definitions
interface AutoTuningConfig {
  enabled: boolean;
  rollback_threshold: number;
  rollback_evaluation_days: number;
}

interface TuningRun {
  id: string;
  config_version: string;
  previous_version: string;
  baseline_accuracy: number;
  started_at: string;
  status: string;
}

interface AlgorithmConfig {
  id: string;
  version: string;
  is_active: boolean;
  created_at: string;
}

// Calculate accuracy with retry logic for transient failures
async function calculateAccuracyWithRetry(
  supabase: ReturnType<typeof createClient>,
  startDate: string,
  endDate: string,
  maxRetries: number = 3
): Promise<{ accuracy_rate: number; total_days: number } | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data, error } = await supabase
        .rpc('calculate_prediction_accuracy', {
          p_start_date: startDate,
          p_end_date: endDate,
        });
      
      if (error) throw error;
      return data?.[0] || null;
      
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`[rollback-check] Accuracy calculation failed after ${maxRetries} attempts:`, error);
        return null;
      }
      console.warn(`[rollback-check] Accuracy calculation failed (attempt ${attempt}/${maxRetries}), retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Health check endpoint
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return new Response(JSON.stringify({ 
      status: 'healthy',
      function: 'check-algorithm-performance',
    }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startTime = Date.now();
  console.log("[rollback-check] Starting daily performance check...");

  try {
    // Create service role client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ===========================================
    // Step 1: Get auto-tuning config
    // ===========================================
    const { data: config, error: configError } = await supabase
      .from('auto_tuning_config')
      .select('*')
      .single();

    if (configError || !config) {
      console.error("[rollback-check] Failed to fetch auto_tuning_config:", configError?.message);
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

    // ===========================================
    // Step 2: Get current active config
    // ===========================================
    const { data: currentConfig, error: currentConfigError } = await supabase
      .from('risk_algorithm_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (currentConfigError || !currentConfig) {
      console.error("[rollback-check] No active config found:", currentConfigError?.message);
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
    console.log(`[rollback-check] Current active config: ${activeConfig.version}`);

    // ===========================================
    // Step 3: Check config age
    // ===========================================
    const configCreatedAt = new Date(activeConfig.created_at);
    const configAgeDays = Math.floor((Date.now() - configCreatedAt.getTime()) / (24 * 60 * 60 * 1000));

    console.log(`[rollback-check] Config age: ${configAgeDays} days`);

    if (configAgeDays < tuningConfig.rollback_evaluation_days) {
      console.log(`[rollback-check] Config too new (${configAgeDays} days < ${tuningConfig.rollback_evaluation_days} required). Skipping.`);
      return new Response(JSON.stringify({
        success: true,
        action: 'skipped',
        reason: `Config too new: ${configAgeDays} days < ${tuningConfig.rollback_evaluation_days} days required`,
        config_version: activeConfig.version,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===========================================
    // Step 4: Get baseline from tuning run
    // ===========================================
    const { data: tuningRun, error: tuningRunError } = await supabase
      .from('algorithm_tuning_runs')
      .select('*')
      .eq('config_version', activeConfig.version)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    // If no tuning run found, this is the baseline config (v1)
    let baselineAccuracy = 75.0; // Default baseline
    let previousVersion: string | null = null;

    if (!tuningRunError && tuningRun) {
      const run = tuningRun as TuningRun;
      baselineAccuracy = run.baseline_accuracy || 75.0;
      previousVersion = run.previous_version;
      console.log(`[rollback-check] Found tuning run. Baseline accuracy: ${baselineAccuracy}%, previous version: ${previousVersion}`);
    } else {
      console.log(`[rollback-check] No tuning run found for ${activeConfig.version}. Using default baseline.`);
    }

    // ===========================================
    // Step 5: Calculate current accuracy
    // ===========================================
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - tuningConfig.rollback_evaluation_days * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    console.log(`[rollback-check] Calculating accuracy from ${startDate} to ${endDate}`);

    const accuracyResult = await calculateAccuracyWithRetry(supabase, startDate, endDate);

    if (!accuracyResult || accuracyResult.total_days === 0) {
      console.log("[rollback-check] Insufficient data for accuracy calculation.");
      return new Response(JSON.stringify({
        success: true,
        action: 'skipped',
        reason: 'Insufficient data for accuracy calculation',
        config_version: activeConfig.version,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentAccuracy = accuracyResult.accuracy_rate;
    const accuracyDrop = baselineAccuracy - currentAccuracy;

    console.log(`[rollback-check] Current accuracy: ${currentAccuracy}%, baseline: ${baselineAccuracy}%, drop: ${accuracyDrop}%`);

    // ===========================================
    // Step 6: Check if rollback needed
    // ===========================================
    if (accuracyDrop < tuningConfig.rollback_threshold) {
      console.log(`[rollback-check] Accuracy drop ${accuracyDrop}% below rollback threshold ${tuningConfig.rollback_threshold}%. No rollback needed.`);
      
      // Log the check
      await supabase.from('tuning_decisions_log').insert({
        decision_type: 'no_action',
        decision_maker: 'rollback_checker',
        adjustment_reason: `Performance OK: ${currentAccuracy}% (baseline: ${baselineAccuracy}%, drop: ${accuracyDrop}%)`,
        supporting_metrics: {
          current_accuracy: currentAccuracy,
          baseline_accuracy: baselineAccuracy,
          accuracy_drop: accuracyDrop,
          threshold: tuningConfig.rollback_threshold,
        },
      });

      return new Response(JSON.stringify({
        success: true,
        action: 'no_rollback_needed',
        current_accuracy: currentAccuracy,
        baseline_accuracy: baselineAccuracy,
        accuracy_drop: accuracyDrop,
        rollback_threshold: tuningConfig.rollback_threshold,
        config_version: activeConfig.version,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===========================================
    // Step 7: ROLLBACK REQUIRED
    // ===========================================
    console.log(`[rollback-check] ROLLBACK TRIGGERED! Accuracy drop ${accuracyDrop}% >= threshold ${tuningConfig.rollback_threshold}%`);

    // Find previous version config
    if (!previousVersion) {
      // If no previous version, just disable auto-tuning
      console.log("[rollback-check] No previous version to rollback to. Disabling auto-tuning.");
      
      await supabase
        .from('auto_tuning_config')
        .update({ enabled: false, last_updated_at: new Date().toISOString() })
        .eq('id', '00000000-0000-0000-0000-000000000001');

      await supabase.from('tuning_decisions_log').insert({
        decision_type: 'rollback',
        decision_maker: 'rollback_checker',
        adjustment_reason: `Performance degraded (drop: ${accuracyDrop}%) but no previous version available. Auto-tuning disabled.`,
        supporting_metrics: {
          current_accuracy: currentAccuracy,
          baseline_accuracy: baselineAccuracy,
          accuracy_drop: accuracyDrop,
        },
      });

      // Send critical notification
      await sendCriticalNotification(supabase, {
        title: 'Risk Algorithm Performance Degraded',
        body: `Accuracy dropped by ${accuracyDrop.toFixed(1)}%. Auto-tuning has been disabled. Manual intervention required.`,
      });

      return new Response(JSON.stringify({
        success: true,
        action: 'rollback_failed_no_previous',
        auto_tuning_disabled: true,
        accuracy_drop: accuracyDrop,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get previous config
    const { data: previousConfig, error: previousConfigError } = await supabase
      .from('risk_algorithm_config')
      .select('id, version')
      .eq('version', previousVersion)
      .single();

    if (previousConfigError || !previousConfig) {
      console.error(`[rollback-check] Could not find previous config ${previousVersion}:`, previousConfigError?.message);
      
      // Disable auto-tuning
      await supabase
        .from('auto_tuning_config')
        .update({ enabled: false, last_updated_at: new Date().toISOString() })
        .eq('id', '00000000-0000-0000-0000-000000000001');

      return new Response(JSON.stringify({
        success: false,
        action: 'rollback_failed',
        error: `Previous config ${previousVersion} not found`,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===========================================
    // Step 8: Execute rollback
    // ===========================================
    console.log(`[rollback-check] Rolling back from ${activeConfig.version} to ${previousVersion}`);

    // Deactivate current config
    await supabase
      .from('risk_algorithm_config')
      .update({ is_active: false })
      .eq('id', activeConfig.id);

    // Activate previous config
    await supabase
      .from('risk_algorithm_config')
      .update({ is_active: true })
      .eq('id', previousConfig.id);

    // Update tuning run status
    if (tuningRun) {
      await supabase
        .from('algorithm_tuning_runs')
        .update({ status: 'rolled_back', decision_reason: `Auto-rolled back due to ${accuracyDrop.toFixed(1)}% accuracy drop` })
        .eq('id', (tuningRun as TuningRun).id);
    }

    // ===========================================
    // Step 9: Disable auto-tuning
    // ===========================================
    await supabase
      .from('auto_tuning_config')
      .update({ enabled: false, last_updated_at: new Date().toISOString() })
      .eq('id', '00000000-0000-0000-0000-000000000001');

    console.log("[rollback-check] Auto-tuning disabled after rollback.");

    // ===========================================
    // Step 10: Log rollback decision
    // ===========================================
    await supabase.from('tuning_decisions_log').insert({
      tuning_run_id: tuningRun ? (tuningRun as TuningRun).id : null,
      decision_type: 'rollback',
      decision_maker: 'rollback_checker',
      adjustment_reason: `Rolled back from ${activeConfig.version} to ${previousVersion} due to ${accuracyDrop.toFixed(1)}% accuracy drop`,
      supporting_metrics: {
        rolled_back_from: activeConfig.version,
        rolled_back_to: previousVersion,
        current_accuracy: currentAccuracy,
        baseline_accuracy: baselineAccuracy,
        accuracy_drop: accuracyDrop,
        threshold: tuningConfig.rollback_threshold,
      },
    });

    // ===========================================
    // Step 11: Send CRITICAL notification
    // ===========================================
    await sendCriticalNotification(supabase, {
      title: 'Risk Algorithm ROLLED BACK',
      body: `Reverted from ${activeConfig.version} to ${previousVersion}. Accuracy dropped ${accuracyDrop.toFixed(1)}%. Auto-tuning paused.`,
    });

    // ===========================================
    // Return success
    // ===========================================
    const duration = Date.now() - startTime;
    console.log(`[rollback-check] Rollback completed in ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      action: 'rolled_back',
      rolled_back_from: activeConfig.version,
      rolled_back_to: previousVersion,
      current_accuracy: currentAccuracy,
      baseline_accuracy: baselineAccuracy,
      accuracy_drop: accuracyDrop,
      auto_tuning_disabled: true,
      duration_ms: duration,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[rollback-check] Unexpected error:", error);
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

// Helper to send critical notification
async function sendCriticalNotification(
  supabase: ReturnType<typeof createClient>,
  { title, body }: { title: string; body: string }
) {
  try {
    const { data: notifEvent } = await supabase
      .from('notification_events')
      .insert({
        category: 'admin_notice',
        severity: 'critical',
        target_type: 'role',
        target_ref: 'admin',
        title,
        body,
        entity_type: 'algorithm_rollback',
      })
      .select('id')
      .single();

    if (notifEvent) {
      await fetch(`${SUPABASE_URL}/functions/v1/notifications-dispatch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "x-internal-key": INTERNAL_SECRET,
        },
        body: JSON.stringify({ event_id: notifEvent.id }),
      });
      console.log("[rollback-check] Sent critical notification to admins");
    }
  } catch (err) {
    console.error("[rollback-check] Failed to send notification:", err);
  }
}
