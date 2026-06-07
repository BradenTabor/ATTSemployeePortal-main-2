// @ts-nocheck
/**
 * Supabase Edge Function: Run Monthly Safety Reward Drawing
 *
 * Randomly selects winners from the month's raffle entries (daily safety
 * briefing claims + streak bonuses). Two auth modes:
 *   1. Admin JWT — manual trigger from the admin page
 *   2. X-Drawing-Secret header — automated pg_cron trigger
 *
 * ## Deploy
 * supabase functions deploy run-monthly-drawing
 *
 * ## Secrets
 * supabase secrets set DRAWING_SECRET=<random-secret>
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildUserEntriesFromLedger } from '../_shared/raffleLedgerEntries.ts';
import { sendGmailEmail } from '../_shared/gmail.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-drawing-secret',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Cryptographically secure random index in [0, max).
 */
function secureRandomIndex(max: number): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % max;
}

const GMAIL_USER = Deno.env.get('GMAIL_USER') ?? 'allterraintreeservice.po@gmail.com';
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD') ?? '';
const DEFAULT_TIMEZONE = 'America/Chicago';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test((email || '').trim());
}

async function getEmailRecipients(
  supabase: ReturnType<typeof createClient>,
  listKey: 'safety_rewards_winners',
  fallback: string[]
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('email_recipient_lists')
      .select('email')
      .eq('list_key', listKey);
    if (error) {
      console.error('[run-monthly-drawing] Recipients DB error:', error.message);
      return fallback;
    }
    if (!data || data.length === 0) {
      console.warn('[run-monthly-drawing] No recipients for', listKey, ', using fallback');
      return fallback;
    }
    const emails = data.map((r: { email: string }) => r.email).filter(isValidEmail);
    if (emails.length === 0) return fallback;
    return emails;
  } catch (err) {
    console.error('[run-monthly-drawing] getEmailRecipients error:', err);
    return fallback;
  }
}

function generateWinnersEmail(
  year: number,
  month: number,
  reward: { grand_prize_name: string; grand_prize_description?: string | null; runner_up_1_name?: string | null; runner_up_2_name?: string | null },
  winners: {
    grandPrizeName: string | null;
    runnerUp1Name: string | null;
    runnerUp2Name: string | null;
  },
  totalEntries: number,
  totalParticipants: number,
  isRedraw: boolean,
  isNoEntries: boolean
): { subject: string; textBody: string; htmlBody: string } {
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;
  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: DEFAULT_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  let subject: string;
  if (isNoEntries) {
    subject = `Safety Rewards Drawing – ${monthLabel} – No Entries`;
  } else if (isRedraw) {
    subject = `Safety Rewards Drawing – ${monthLabel} – Updated Winners`;
  } else {
    subject = `Safety Rewards Drawing – ${monthLabel} – Winners Announced`;
  }

  let textBody: string;
  let htmlSections: string;

  if (isNoEntries) {
    textBody = `SAFETY REWARDS DRAWING – ${monthLabel}\n\nNo entries this month. Drawing completed; no winners selected.\n\n— ATTS Safety Management System`;
    htmlSections = `
    <p style="margin:0 0 16px;">No entries this month. Drawing completed; no winners selected.</p>`;
  } else {
    textBody = `SAFETY REWARDS DRAWING – ${monthLabel}\n\n`;
    textBody += `Grand Prize: ${reward.grand_prize_name}\nWinner: ${winners.grandPrizeName ?? 'No winner'}\n\n`;
    if (reward.runner_up_1_name) {
      textBody += `Runner-up 1: ${reward.runner_up_1_name}\nWinner: ${winners.runnerUp1Name ?? 'No winner'}\n\n`;
    }
    if (reward.runner_up_2_name) {
      textBody += `Runner-up 2: ${reward.runner_up_2_name}\nWinner: ${winners.runnerUp2Name ?? 'No winner'}\n\n`;
    }
    textBody += `Total entries: ${totalEntries} | Total participants: ${totalParticipants}\n\n— ATTS Safety Management System`;

    const grandDesc = reward.grand_prize_description ? `<p style="margin:4px 0 0;color:#6b7280;font-size:13px;">${reward.grand_prize_description}</p>` : '';
    htmlSections = `
    <div style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:8px;padding:16px;">
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;">Grand Prize</p>
      <p style="margin:0;font-weight:600;">${reward.grand_prize_name}</p>${grandDesc}
      <p style="margin:8px 0 0;"><strong>Winner:</strong> ${winners.grandPrizeName ?? 'No winner'}</p>
    </div>`;
    if (reward.runner_up_1_name) {
      htmlSections += `
    <div style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:8px;padding:16px;">
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;">Runner-up 1</p>
      <p style="margin:0;font-weight:600;">${reward.runner_up_1_name}</p>
      <p style="margin:8px 0 0;"><strong>Winner:</strong> ${winners.runnerUp1Name ?? 'No winner'}</p>
    </div>`;
    }
    if (reward.runner_up_2_name) {
      htmlSections += `
    <div style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:8px;padding:16px;">
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;">Runner-up 2</p>
      <p style="margin:0;font-weight:600;">${reward.runner_up_2_name}</p>
      <p style="margin:8px 0 0;"><strong>Winner:</strong> ${winners.runnerUp2Name ?? 'No winner'}</p>
    </div>`;
    }
    htmlSections += `
    <p style="margin:16px 0 0;font-size:14px;">Total entries: <strong>${totalEntries}</strong> | Total participants: <strong>${totalParticipants}</strong></p>`;
  }

  const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1f2937;">
  <div style="background:linear-gradient(135deg,#1e293b,#334155);color:white;padding:24px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;font-size:20px;">Safety Rewards Drawing Results</h1>
    <p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">${monthLabel}</p>
  </div>
  <div style="padding:20px;border:1px solid #e5e7eb;border-top:none;">${htmlSections}
  </div>
  <div style="background:#f9fafb;padding:16px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
      Generated at ${timestamp} | ATTS Safety Management System
    </p>
  </div>
</body></html>`;

  return { subject, textBody, htmlBody };
}

async function sendWinnersEmailAndLog(
  supabase: ReturnType<typeof createClient>,
  recipients: string[],
  subject: string,
  textBody: string,
  htmlBody: string
): Promise<{ success: boolean; error?: string }> {
  if (recipients.length === 0) {
    return { success: false, error: 'No recipients' };
  }
  const result = await sendGmailEmail(
    recipients,
    subject,
    textBody,
    htmlBody,
    { gmailUser: GMAIL_USER, gmailAppPassword: GMAIL_APP_PASSWORD, fromLabel: 'ATTS Safety Rewards' }
  );
  const { error: logErr } = await supabase.from('email_send_log').insert({
    list_key: 'safety_rewards_winners',
    recipients,
    success: result.success,
    error_message: result.error ?? null,
  });
  if (logErr) console.error('[run-monthly-drawing] email_send_log insert error:', logErr);
  return result;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const drawingSecret = Deno.env.get('DRAWING_SECRET') ?? '';
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const secretHeader = req.headers.get('x-drawing-secret');
    const authHeader = req.headers.get('authorization');
    let callerUserId: string | null = null;

    if (secretHeader && secretHeader === drawingSecret) {
      // Cron caller — no user context
    } else if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser(token);
      if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

      const { data: appUser } = await supabase
        .from('app_users')
        .select('role')
        .eq('user_id', user.id)
        .single();
      if (appUser?.role !== 'admin') return json({ error: 'Admin only' }, 403);

      callerUserId = user.id;
    } else {
      return json({ error: 'Missing auth' }, 401);
    }

    // ── Parse body ───────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const year = Number(body.year);
    const month = Number(body.month);
    const force = body.force === true;

    if (!year || !month || month < 1 || month > 12) {
      return json({ error: 'Invalid year/month' }, 400);
    }

    // ── Check if this is actually the last day (cron guard) ──────────────
    // When called from cron (no callerUserId), verify it's the last day of
    // the target month in Chicago time. Manual admin calls skip this check.
    if (!callerUserId) {
      const chicagoNow = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }),
      );
      const tomorrow = new Date(chicagoNow);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (tomorrow.getDate() !== 1) {
        return json({ skipped: true, reason: 'Not the last day of the month' });
      }
    }

    // ── Verify reward exists ─────────────────────────────────────────────
    const { data: reward, error: rewardErr } = await supabase
      .from('monthly_safety_rewards')
      .select('id, grand_prize_name, grand_prize_description, runner_up_1_name, runner_up_2_name')
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();

    if (rewardErr) throw rewardErr;
    if (!reward) return json({ error: 'No reward configured for this month' }, 404);

    // ── Check existing drawing ───────────────────────────────────────────
    const { data: existing } = await supabase
      .from('monthly_reward_drawings')
      .select('id, grand_prize_winner_id, drawn_at')
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();

    if (existing && !force) {
      return json(
        { error: 'Drawing already exists', existingDrawing: existing },
        409,
      );
    }
    if (existing && force) {
      await supabase
        .from('monthly_reward_drawings')
        .delete()
        .eq('id', existing.id);
    }

    // ── Gather entries (ledger-native; same predicate as get_user_raffle_entries) ─
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    const { data: ledgerRows, error: ledgerErr } = await supabase
      .from('point_transactions')
      .select('user_id, amount, counts_toward_raffle, created_at')
      .eq('counts_toward_raffle', true)
      .gt('amount', 0)
      .gte('created_at', startDate)
      .lt('created_at', endDate);

    if (ledgerErr) throw ledgerErr;

    const {
      userEntries,
      grandTotalEntries,
      totalParticipants,
    } = buildUserEntriesFromLedger(ledgerRows ?? [], year, month);

    if (grandTotalEntries === 0) {
      const drawingRow = {
        reward_id: reward.id,
        month,
        year,
        grand_prize_winner_id: null,
        runner_up_1_winner_id: null,
        runner_up_2_winner_id: null,
        total_entries: 0,
        total_participants: 0,
        drawn_by: callerUserId,
      };
      const { error: emptyInsertErr } = await supabase.from('monthly_reward_drawings').insert(drawingRow);
      if (emptyInsertErr) {
        console.error('[run-monthly-drawing] Insert (no entries) failed:', emptyInsertErr);
        throw new Error(emptyInsertErr.message || 'Failed to save drawing results');
      }
      // Notify admins (no entries)
      let emailSent = false;
      let emailError: string | undefined;
      try {
        const recipients = await getEmailRecipients(supabase, 'safety_rewards_winners', []);
        const { subject, textBody, htmlBody } = generateWinnersEmail(
          year, month, reward,
          { grandPrizeName: null, runnerUp1Name: null, runnerUp2Name: null },
          0, 0, false, true
        );
        const emailResult = await sendWinnersEmailAndLog(supabase, recipients, subject, textBody, htmlBody);
        emailSent = emailResult.success;
        emailError = emailResult.error;
      } catch (e) {
        emailError = e instanceof Error ? e.message : String(e);
        console.error('[run-monthly-drawing] Email send (no entries) failed:', emailError);
      }
      return json({
        winners: { grandPrize: null, runnerUp1: null, runnerUp2: null },
        totalEntries: 0,
        totalParticipants: 0,
        emailSent,
        emailError: emailError ?? undefined,
      });
    }

    // ── Build weighted pool and draw ─────────────────────────────────────
    const pool: string[] = [];
    for (const [userId, count] of userEntries) {
      for (let i = 0; i < count; i++) {
        pool.push(userId);
      }
    }

    function drawFrom(currentPool: string[]): string | null {
      if (currentPool.length === 0) return null;
      const idx = secureRandomIndex(currentPool.length);
      return currentPool[idx];
    }

    function removeFromPool(currentPool: string[], userId: string): string[] {
      return currentPool.filter((id) => id !== userId);
    }

    const grandPrizeWinnerId = drawFrom(pool);
    let remainingPool = grandPrizeWinnerId
      ? removeFromPool(pool, grandPrizeWinnerId)
      : pool;

    let runnerUp1WinnerId: string | null = null;
    if (reward.runner_up_1_name && remainingPool.length > 0) {
      runnerUp1WinnerId = drawFrom(remainingPool);
      if (runnerUp1WinnerId) {
        remainingPool = removeFromPool(remainingPool, runnerUp1WinnerId);
      }
    }

    let runnerUp2WinnerId: string | null = null;
    if (reward.runner_up_2_name && remainingPool.length > 0) {
      runnerUp2WinnerId = drawFrom(remainingPool);
    }

    // ── Store results ────────────────────────────────────────────────────
    const drawingRow = {
      reward_id: reward.id,
      month,
      year,
      grand_prize_winner_id: grandPrizeWinnerId,
      runner_up_1_winner_id: runnerUp1WinnerId,
      runner_up_2_winner_id: runnerUp2WinnerId,
      total_entries: grandTotalEntries,
      total_participants: totalParticipants,
      drawn_by: callerUserId,
    };

    const { error: insertErr } = await supabase
      .from('monthly_reward_drawings')
      .insert(drawingRow);

    if (insertErr) {
      console.error('[run-monthly-drawing] Insert failed:', insertErr);
      throw new Error(insertErr.message || 'Failed to save drawing results');
    }

    // Resolve winner names
    const winnerIds = [
      grandPrizeWinnerId,
      runnerUp1WinnerId,
      runnerUp2WinnerId,
    ].filter(Boolean);
    const nameMap = new Map<string, string>();

    if (winnerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, email')
        .in('user_id', winnerIds);
      if (profiles) {
        for (const p of profiles) {
          nameMap.set(p.user_id, p.full_name || p.email || 'Unknown');
        }
      }
    }

    function winnerInfo(userId: string | null) {
      if (!userId) return null;
      return {
        userId,
        name: nameMap.get(userId) ?? 'Unknown',
        entries: userEntries.get(userId) ?? 0,
      };
    }

    // Notify admins (winners or re-draw)
    let emailSent = false;
    let emailError: string | undefined;
    try {
      const recipients = await getEmailRecipients(supabase, 'safety_rewards_winners', []);
      const { subject, textBody, htmlBody } = generateWinnersEmail(
        year, month, reward,
        {
          grandPrizeName: grandPrizeWinnerId ? (nameMap.get(grandPrizeWinnerId) ?? 'Unknown') : null,
          runnerUp1Name: runnerUp1WinnerId ? (nameMap.get(runnerUp1WinnerId) ?? 'Unknown') : null,
          runnerUp2Name: runnerUp2WinnerId ? (nameMap.get(runnerUp2WinnerId) ?? 'Unknown') : null,
        },
        grandTotalEntries, totalParticipants, force, false
      );
      const emailResult = await sendWinnersEmailAndLog(supabase, recipients, subject, textBody, htmlBody);
      emailSent = emailResult.success;
      emailError = emailResult.error;
    } catch (e) {
      emailError = e instanceof Error ? e.message : String(e);
      console.error('[run-monthly-drawing] Email send failed:', emailError);
    }

    return json({
      winners: {
        grandPrize: winnerInfo(grandPrizeWinnerId),
        runnerUp1: winnerInfo(runnerUp1WinnerId),
        runnerUp2: winnerInfo(runnerUp2WinnerId),
      },
      totalEntries: grandTotalEntries,
      totalParticipants,
      emailSent,
      emailError: emailError ?? undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[run-monthly-drawing] Error:', err);
    return json(
      { error: message || 'Unexpected error' },
      500,
    );
  }
});
