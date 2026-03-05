// @ts-nocheck
/**
 * Supabase Edge Function: Generate Attendance Summary
 *
 * AI-powered summary of attendance data for a date range.
 * Caches in attendance_summaries with 24h TTL (enforced here).
 *
 * ## Auth: admin or general_foreman
 * ## Deploy: supabase functions deploy generate-attendance-summary
 * ## Secrets: OPENAI_API_KEY (optional; falls back to structured text)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'https://esm.sh/openai@4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TTL_HOURS = 24;
const MAX_SUMMARY_LENGTH = 400;

const SYSTEM_PROMPT = `You are an attendance analyst for ATTS (All Terrain Tree Service).

Your job is to generate a brief, actionable summary of crew attendance over a date range.

## Rules
1. Be concise - 2-4 sentences, under 400 characters total
2. Highlight: overall rate, any NCNS concerns, RTO patterns, notable trends
3. Use specific numbers from the data
4. Don't fabricate - only mention what's in the data

## Examples
Good: "Attendance this week was 94% with 2 NCNS incidents. Three employees had approved RTO. Consider follow-up with the two NCNS individuals."
Bad: "Attendance was generally good this period." (too vague)`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header', retryable: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', retryable: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: appUser, error: roleError } = await supabase
      .from('app_users')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !appUser || !['admin', 'general_foreman'].includes(appUser.role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions', retryable: false }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const start_date = body.start_date?.toString().trim();
    const end_date = body.end_date?.toString().trim();
    const force_regenerate = body.force_regenerate === true;

    if (!start_date || !end_date || start_date > end_date) {
      return new Response(
        JSON.stringify({ error: 'Invalid date range', retryable: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check cache: 24h TTL
    const ttlCutoff = new Date();
    ttlCutoff.setHours(ttlCutoff.getHours() - TTL_HOURS);
    const ttlCutoffIso = ttlCutoff.toISOString();

    if (!force_regenerate) {
      const { data: cached } = await serviceClient
        .from('attendance_summaries')
        .select('summary, generated_at')
        .eq('start_date', start_date)
        .eq('end_date', end_date)
        .single();

      if (cached?.summary && cached.generated_at && cached.generated_at >= ttlCutoffIso) {
        return new Response(
          JSON.stringify({
            success: true,
            summary: cached.summary,
            cached: true,
            generated_at: cached.generated_at,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch attendance in range
    const { data: records, error: recError } = await serviceClient
      .from('daily_attendance')
      .select('user_id, date, status')
      .gte('date', start_date)
      .lte('date', end_date);

    if (recError) {
      return new Response(
        JSON.stringify({ error: 'Failed to load attendance data', retryable: true }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const recs = records ?? [];
    let present = 0, absent = 0, ncns = 0, rto = 0;
    const ncnsByUser: Record<string, number> = {};
    for (const r of recs) {
      if (r.status === 'present') present++;
      else if (r.status === 'absent') absent++;
      else if (r.status === 'ncns') {
        ncns++;
        ncnsByUser[r.user_id] = (ncnsByUser[r.user_id] ?? 0) + 1;
      } else if (r.status === 'rto') rto++;
    }
    const total = recs.length;
    const overallRate = total > 0 ? Math.round((present / total) * 100) : 0;
    const highNcns = Object.entries(ncnsByUser).filter(([, c]) => c >= 2).map(([uid]) => uid);

    const dataForPrompt = {
      start_date,
      end_date,
      total_records: total,
      present,
      absent,
      ncns,
      rto,
      overall_rate_pct: overallRate,
      high_ncns_count: highNcns.length,
    };

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    let summary: string;

    if (openaiKey) {
      try {
        const openai = new OpenAI({ apiKey: openaiKey });
        const prompt = `Attendance data for ${start_date} to ${end_date}:
Total records: ${dataForPrompt.total_records}
Present: ${dataForPrompt.present}, Absent: ${dataForPrompt.absent}, NCNS: ${dataForPrompt.ncns}, RTO: ${dataForPrompt.rto}
Overall attendance rate: ${dataForPrompt.overall_rate_pct}%
Employees with 2+ NCNS in range: ${dataForPrompt.high_ncns_count}

Generate a brief executive summary.`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 150,
        });

        summary = completion.choices[0]?.message?.content?.trim() ?? '';
        if (summary.length > MAX_SUMMARY_LENGTH) {
          const lastPeriod = summary.lastIndexOf('.', MAX_SUMMARY_LENGTH);
          summary = lastPeriod > 200 ? summary.slice(0, lastPeriod + 1) : summary.slice(0, MAX_SUMMARY_LENGTH - 3) + '...';
        }
      } catch (openaiErr) {
        console.error('[AttendanceSummary] OpenAI error:', openaiErr);
        const isRateLimit = String(openaiErr).includes('rate') || String(openaiErr).includes('429');
        return new Response(
          JSON.stringify({
            error: isRateLimit ? 'Service temporarily busy. Try again in a moment.' : 'Failed to generate summary.',
            retryable: true,
          }),
          { status: isRateLimit ? 503 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      summary = `Attendance for ${start_date} to ${end_date}: ${present} present, ${absent} absent, ${ncns} NCNS, ${rto} RTO. Overall rate: ${overallRate}%.` +
        (highNcns.length > 0 ? ` ${highNcns.length} employee(s) with 2+ NCNS in range.` : '');
    }

    const now = new Date().toISOString();
    await serviceClient
      .from('attendance_summaries')
      .upsert(
        {
          start_date,
          end_date,
          summary,
          generated_at: now,
          generated_by: user.id,
          updated_at: now,
        },
        { onConflict: 'start_date,end_date' }
      );

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        cached: false,
        generated_at: now,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[AttendanceSummary] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', retryable: true }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
