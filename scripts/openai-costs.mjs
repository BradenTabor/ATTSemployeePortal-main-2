#!/usr/bin/env node
/**
 * OpenAI Cost Aggregation Script
 *
 * Aggregates token usage and calculates costs for Safety AI announcements.
 * Queries the announcements table for entries authored by "Safety AI"
 * and sums token usage from stored metadata.
 *
 * Usage:
 *   node scripts/openai-costs.mjs [--days=30] [--verbose]
 *
 * Options:
 *   --days=N     Number of days to look back (default: 30)
 *   --verbose    Show detailed breakdown per announcement
 *   --json       Output as JSON for programmatic use
 *
 * Environment:
 *   SUPABASE_URL              - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key for admin access
 *
 * @see docs/Telemetry_plan.md for full documentation
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * OpenAI Pricing (as of 2026-01-11)
 *
 * IMPORTANT: Verify these prices before using in production.
 * Prices change frequently. Check: https://openai.com/pricing
 */
const PRICING = {
  'gpt-4o-mini': {
    input_per_1k: 0.00015,  // $0.15 per 1M input tokens
    output_per_1k: 0.0006,  // $0.60 per 1M output tokens
    last_updated: '2026-01-11',
    source: 'https://openai.com/pricing',
  },
  'gpt-4o': {
    input_per_1k: 0.0025,   // $2.50 per 1M input tokens
    output_per_1k: 0.01,    // $10.00 per 1M output tokens
    last_updated: '2026-01-11',
    source: 'https://openai.com/pricing',
  },
  'gpt-4-turbo': {
    input_per_1k: 0.01,     // $10.00 per 1M input tokens
    output_per_1k: 0.03,    // $30.00 per 1M output tokens
    last_updated: '2026-01-11',
    source: 'https://openai.com/pricing',
  },
};

// Default model if not specified in metadata
const DEFAULT_MODEL = 'gpt-4o-mini';

// ============================================================================
// ARGUMENT PARSING
// ============================================================================

const args = process.argv.slice(2);
const options = {
  days: 30,
  verbose: false,
  json: false,
};

for (const arg of args) {
  if (arg.startsWith('--days=')) {
    options.days = parseInt(arg.split('=')[1], 10);
  } else if (arg === '--verbose') {
    options.verbose = true;
  } else if (arg === '--json') {
    options.json = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
OpenAI Cost Aggregation Script

Usage:
  node scripts/openai-costs.mjs [options]

Options:
  --days=N     Number of days to look back (default: 30)
  --verbose    Show detailed breakdown per announcement
  --json       Output as JSON for programmatic use
  --help       Show this help message

Environment:
  SUPABASE_URL              - Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY - Service role key for admin access

Example:
  node scripts/openai-costs.mjs --days=7 --verbose
`);
    process.exit(0);
  }
}

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing environment variables.');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  console.error('');
  console.error('Example:');
  console.error('  export SUPABASE_URL="https://your-project.supabase.co"');
  console.error('  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function main() {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - options.days);
  const startDateIso = startDate.toISOString();

  if (!options.json) {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ATTS Safety AI - OpenAI Cost Report');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`  Period: Last ${options.days} days (since ${startDate.toLocaleDateString()})`);
    console.log(`  Generated: ${new Date().toLocaleString()}`);
    console.log('');
  }

  // Query announcements authored by "Safety AI"
  const { data: announcements, error } = await supabase
    .from('announcements')
    .select('id, title, created_at, author, raw_data')
    .eq('author', 'Safety AI')
    .gte('created_at', startDateIso)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error querying announcements:', error.message);
    process.exit(1);
  }

  if (!announcements || announcements.length === 0) {
    if (options.json) {
      console.log(JSON.stringify({
        status: 'no_data',
        period_days: options.days,
        message: 'No Safety AI announcements found in the specified period.',
      }, null, 2));
    } else {
      console.log('  ⚠️  No Safety AI announcements found in the specified period.');
      console.log('');
    }
    process.exit(0);
  }

  // Aggregate token usage
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;
  const modelBreakdown = {};
  const announcementDetails = [];

  for (const announcement of announcements) {
    const rawData = announcement.raw_data || {};
    const metadata = rawData.metadata || {};
    const tokenUsage = metadata.tokenUsage || rawData.tokenUsage || {};

    const inputTokens = tokenUsage.input_tokens || tokenUsage.prompt_tokens || 0;
    const outputTokens = tokenUsage.output_tokens || tokenUsage.completion_tokens || 0;
    const model = metadata.model || rawData.model || DEFAULT_MODEL;

    // Get pricing for model
    const pricing = PRICING[model] || PRICING[DEFAULT_MODEL];
    const inputCost = (inputTokens / 1000) * pricing.input_per_1k;
    const outputCost = (outputTokens / 1000) * pricing.output_per_1k;
    const cost = inputCost + outputCost;

    totalInputTokens += inputTokens;
    totalOutputTokens += outputTokens;
    totalCost += cost;

    // Track by model
    if (!modelBreakdown[model]) {
      modelBreakdown[model] = {
        count: 0,
        input_tokens: 0,
        output_tokens: 0,
        cost: 0,
      };
    }
    modelBreakdown[model].count += 1;
    modelBreakdown[model].input_tokens += inputTokens;
    modelBreakdown[model].output_tokens += outputTokens;
    modelBreakdown[model].cost += cost;

    announcementDetails.push({
      id: announcement.id,
      title: announcement.title,
      created_at: announcement.created_at,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost,
    });
  }

  // Output results
  if (options.json) {
    const result = {
      status: 'success',
      period_days: options.days,
      start_date: startDateIso,
      end_date: new Date().toISOString(),
      summary: {
        total_announcements: announcements.length,
        total_input_tokens: totalInputTokens,
        total_output_tokens: totalOutputTokens,
        total_tokens: totalInputTokens + totalOutputTokens,
        total_cost_usd: Math.round(totalCost * 10000) / 10000,
        avg_cost_per_announcement: Math.round((totalCost / announcements.length) * 10000) / 10000,
      },
      model_breakdown: modelBreakdown,
      pricing_source: PRICING[DEFAULT_MODEL].source,
      pricing_last_updated: PRICING[DEFAULT_MODEL].last_updated,
    };

    if (options.verbose) {
      result.announcements = announcementDetails;
    }

    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('  SUMMARY');
    console.log('  ───────────────────────────────────────────────────────────');
    console.log(`  Total Announcements:    ${announcements.length}`);
    console.log(`  Total Input Tokens:     ${totalInputTokens.toLocaleString()}`);
    console.log(`  Total Output Tokens:    ${totalOutputTokens.toLocaleString()}`);
    console.log(`  Total Tokens:           ${(totalInputTokens + totalOutputTokens).toLocaleString()}`);
    console.log('');
    console.log(`  💰 Total Cost:          $${totalCost.toFixed(4)}`);
    console.log(`  📊 Avg Cost/Announce:   $${(totalCost / announcements.length).toFixed(4)}`);
    console.log('');

    // Model breakdown
    console.log('  MODEL BREAKDOWN');
    console.log('  ───────────────────────────────────────────────────────────');
    for (const [model, stats] of Object.entries(modelBreakdown)) {
      console.log(`  ${model}:`);
      console.log(`    Count: ${stats.count} | Tokens: ${(stats.input_tokens + stats.output_tokens).toLocaleString()} | Cost: $${stats.cost.toFixed(4)}`);
    }
    console.log('');

    // Verbose: show each announcement
    if (options.verbose) {
      console.log('  ANNOUNCEMENT DETAILS');
      console.log('  ───────────────────────────────────────────────────────────');
      for (const detail of announcementDetails) {
        const date = new Date(detail.created_at).toLocaleDateString();
        console.log(`  [${date}] ${detail.title.slice(0, 50)}...`);
        console.log(`    Model: ${detail.model} | Tokens: ${detail.input_tokens + detail.output_tokens} | Cost: $${detail.cost.toFixed(4)}`);
      }
      console.log('');
    }

    // Pricing verification notice
    console.log('  ⚠️  PRICING VERIFICATION');
    console.log('  ───────────────────────────────────────────────────────────');
    console.log(`  Prices last verified: ${PRICING[DEFAULT_MODEL].last_updated}`);
    console.log(`  Verify current prices at: ${PRICING[DEFAULT_MODEL].source}`);
    console.log('');
    console.log('  Note: Costs are estimates based on stored token counts.');
    console.log('  Actual billing may vary. Check OpenAI dashboard for exact costs.');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
  }
}

// Run
main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
