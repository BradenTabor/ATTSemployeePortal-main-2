/**
 * Pure helpers for unified sms_message_log rows.
 * No Deno / jsr imports — unit-tested from tests/unit/sms-message-log.test.ts.
 */

export type SmsMessageCategory = "operational" | "marketing";

export interface SmsOptOutState {
  operational: boolean;
  marketing: boolean;
}

export interface SmsLogMessageInput {
  to: string;
  body: string;
  userId?: string | null;
  optOutState?: SmsOptOutState | null;
  templateKey?: string | null;
}

export interface SmsProviderResult {
  to: string;
  status: string;
  messageId?: string;
  price?: string;
}

export interface BuildSmsMessageLogArgs {
  messages: SmsLogMessageInput[];
  results: SmsProviderResult[];
  messageType: string;
  category: SmsMessageCategory;
  fromNumber?: string | null;
  runId?: string | null;
  sourceTable?: string | null;
  isDryRun: boolean;
  sentAt?: string;
}

export interface SmsMessageLogInsert {
  user_id: string | null;
  phone_e164: string | null;
  message_type: string;
  category: SmsMessageCategory;
  from_number: string | null;
  body: string | null;
  template_key: string | null;
  provider_message_id: string | null;
  provider_status: string | null;
  price: number | null;
  opt_out_state_at_send: SmsOptOutState | null;
  run_id: string | null;
  source_table: string | null;
  is_dry_run: boolean;
  sent_at?: string;
}

export function dryRunResultsFor(messages: SmsLogMessageInput[]): SmsProviderResult[] {
  return messages.map((m) => ({ to: m.to, status: "DRY_RUN" }));
}

function parsePrice(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function buildSmsMessageLogRows(args: BuildSmsMessageLogArgs): SmsMessageLogInsert[] {
  const {
    messages,
    results,
    messageType,
    category,
    fromNumber,
    runId,
    sourceTable,
    isDryRun,
    sentAt,
  } = args;

  return messages.map((message, index) => {
    const result = results[index];
    const row: SmsMessageLogInsert = {
      user_id: message.userId ?? null,
      phone_e164: message.to || null,
      message_type: messageType,
      category,
      from_number: fromNumber ?? null,
      body: message.body || null,
      template_key: message.templateKey ?? null,
      provider_message_id: result?.messageId ?? null,
      provider_status: result?.status ?? (isDryRun ? "DRY_RUN" : "UNKNOWN"),
      price: parsePrice(result?.price),
      opt_out_state_at_send: message.optOutState ?? null,
      run_id: runId ?? null,
      source_table: sourceTable ?? null,
      is_dry_run: isDryRun,
    };
    if (sentAt) row.sent_at = sentAt;
    return row;
  });
}

export async function persistSmsMessageLog(
  insert: (rows: SmsMessageLogInsert[]) => Promise<{ error: { message: string } | null }>,
  rows: SmsMessageLogInsert[]
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await insert(rows);
  if (error) {
    console.error("[sms_message_log] insert failed", error.message);
  }
}
