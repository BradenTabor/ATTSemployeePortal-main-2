/**
 * Send Admin Compliance Summary Email
 * 
 * This module handles the dual-send approach for admin compliance summary:
 * 1. Primary: Send via Gmail API (direct email delivery)
 * 2. Secondary: POST to Make.com webhook (backup/audit trail)
 * 
 * @module safety-agent/execution/sendAdminSummaryEmail
 */

import type {
  AdminComplianceSummary,
  AdminEmailContent,
  AdminComplianceRunResult,
  AdminSummaryWebhookPayload,
  WebhookResult,
  EmailSendResult,
  AdminComplianceCheckOptions,
} from '../types';
import { sendAdminComplianceEmail } from '../lib/gmail';
import { safetyLogger } from '../lib/logger';
import { nowISO } from '../lib/time';
import { checkAdminCompliance9am } from './checkAdminCompliance9am';
import { generateAdminSummaryEmail } from './generateAdminSummaryEmail';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_WEBHOOK_URL = 'https://hook.us2.make.com/hdty3eds1lpldxt2ne4amq1dgdohmvpc';

// Environment variable names for webhook URL
const WEBHOOK_ENV_VARS = [
  'VITE_MAKE_DEN_WEBHOOK_URL',
  'MAKE_WEBHOOK_URL',
  'MAKE_DEN_WEBHOOK_URL',
];

// =============================================================================
// ENVIRONMENT HELPERS
// =============================================================================

declare const Deno: { env: { get(key: string): string | undefined } } | undefined;
declare const process: { env?: Record<string, string | undefined> } | undefined;

const isDeno = typeof Deno !== 'undefined';

function getEnvVar(name: string): string | undefined {
  if (isDeno) {
    return Deno?.env.get(name);
  }
  if (typeof process !== 'undefined' && process?.env) {
    return process.env[name];
  }
  return undefined;
}

// =============================================================================
// WEBHOOK SENDING
// =============================================================================

/**
 * Build the webhook payload for admin compliance summary.
 */
function buildWebhookPayload(
  summary: AdminComplianceSummary,
  emailContent: AdminEmailContent,
  gmailResult: EmailSendResult,
  webhookResult: WebhookResult
): AdminSummaryWebhookPayload {
  return {
    type: 'admin_compliance_summary',
    dateFor: summary.dateFor,
    generatedAt: summary.generatedAt,
    summary: {
      totalRequired: summary.totalRequired,
      totalCompliant: summary.totalCompliant,
      totalNonCompliant: summary.totalNonCompliant,
      missingDvirCount: summary.missingDvirCount,
      missingEquipmentCount: summary.missingEquipmentCount,
      missingJsaCount: summary.missingJsaCount,
      missingAllCount: summary.missingAllCount,
    },
    nonCompliantUsers: summary.nonCompliantUsers.map(u => ({
      userId: u.userId,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      missingForms: u.missingForms,
      missingType: u.missingType,
    })),
    emailContent: {
      subject: emailContent.subject,
      textBody: emailContent.textBody,
      htmlBody: emailContent.htmlBody,
    },
    sendResults: {
      gmail: {
        success: gmailResult.success,
        messageId: gmailResult.messageId,
        error: gmailResult.error,
      },
      webhook: {
        success: webhookResult.success,
        error: webhookResult.error,
      },
    },
  };
}

/**
 * Send the compliance summary to Make.com webhook.
 */
async function sendToWebhook(
  payload: AdminSummaryWebhookPayload,
  runId?: string
): Promise<WebhookResult> {
  const webhookUrl = WEBHOOK_ENV_VARS.map(v => getEnvVar(v)).find(Boolean) || DEFAULT_WEBHOOK_URL;
  const dryRun = getEnvVar('DRY_RUN') === 'true';

  if (dryRun) {
    safetyLogger.info('DRY RUN: Would send webhook', {
      runId,
      type: payload.type,
      nonCompliantCount: payload.summary.totalNonCompliant,
    });
    return { success: true, webhookResponse: { dryRun: true } };
  }

  try {
    safetyLogger.debug('Sending admin summary to webhook', {
      runId,
      url: webhookUrl.slice(0, 50) + '...',
    });

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let responseData: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      safetyLogger.error('Webhook failed', {
        runId,
        status: response.status,
        response: JSON.stringify(responseData).slice(0, 200),
      });

      return {
        success: false,
        webhookResponse: responseData,
        error: `Webhook returned ${response.status}: ${response.statusText}`,
      };
    }

    safetyLogger.info('Webhook sent successfully', {
      runId,
      status: response.status,
    });

    return {
      success: true,
      webhookResponse: responseData,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    safetyLogger.error('Webhook exception', {
      runId,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// =============================================================================
// MAIN ORCHESTRATION FUNCTION
// =============================================================================

/**
 * Run the complete admin compliance summary workflow:
 * 1. Check compliance (get non-compliant users)
 * 2. Generate email content
 * 3. Send via Gmail
 * 4. Send to webhook
 * 
 * @param options - Configuration options
 * @returns AdminComplianceRunResult with all results
 */
export async function runAdminComplianceSummary(
  options: AdminComplianceCheckOptions = {}
): Promise<AdminComplianceRunResult> {
  const dryRun = options.dryRun ?? (getEnvVar('DRY_RUN') === 'true');
  const notificationsEnabled = options.notificationsEnabled ?? 
    (getEnvVar('EMAIL_NOTIFICATIONS_ENABLED') !== 'false');

  safetyLogger.info('Starting admin compliance summary workflow', {
    dryRun,
    notificationsEnabled,
    dateFor: options.dateFor || 'today',
  });

  try {
    // Step 1: Check compliance
    const { runId, summary } = await checkAdminCompliance9am(options);

    // Handle weekend skip
    if (summary.skippedWeekend) {
      return {
        runId: runId || 'skipped',
        summary,
        emailResults: {
          gmail: { success: true, error: 'Skipped - weekend' },
          webhook: { success: true, error: 'Skipped - weekend' },
        },
        status: 'skipped',
        dryRun,
      };
    }

    // Step 2: Generate email content
    const emailContent = generateAdminSummaryEmail(summary);

    safetyLogger.info('Generated email content', {
      runId,
      subject: emailContent.subject,
      textLength: emailContent.textBody.length,
      htmlLength: emailContent.htmlBody?.length || 0,
    });

    // Step 3: Send via Gmail
    let gmailResult: EmailSendResult;
    if (notificationsEnabled) {
      gmailResult = await sendAdminComplianceEmail(emailContent, runId);
    } else {
      gmailResult = {
        success: true,
        error: 'Notifications disabled',
      };
      safetyLogger.info('Gmail send skipped - notifications disabled', { runId });
    }

    // Step 4: Build initial webhook payload (we'll update sendResults after)
    const webhookPayload = buildWebhookPayload(
      summary,
      emailContent,
      gmailResult,
      { success: false } // Placeholder
    );

    // Step 5: Send to webhook
    let webhookResult: WebhookResult;
    if (notificationsEnabled) {
      webhookResult = await sendToWebhook(webhookPayload, runId);
      
      // Update the payload with actual webhook result
      webhookPayload.sendResults.webhook = {
        success: webhookResult.success,
        error: webhookResult.error,
      };
    } else {
      webhookResult = {
        success: true,
        error: 'Notifications disabled',
      };
      safetyLogger.info('Webhook send skipped - notifications disabled', { runId });
    }

    // Determine overall status
    const status = (gmailResult.success || webhookResult.success) ? 'success' : 'failed';

    const result: AdminComplianceRunResult = {
      runId,
      summary,
      emailResults: {
        gmail: gmailResult,
        webhook: webhookResult,
      },
      status,
      dryRun,
    };

    safetyLogger.runEnd(runId, {
      status,
      gmailSuccess: gmailResult.success,
      webhookSuccess: webhookResult.success,
      nonCompliantCount: summary.totalNonCompliant,
    });

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    safetyLogger.error('Admin compliance summary workflow failed', {
      error: errorMessage,
    });

    // Return a failed result
    return {
      runId: 'error',
      summary: {
        dateFor: options.dateFor || new Date().toISOString().split('T')[0],
        generatedAt: nowISO(),
        totalRequired: 0,
        totalCompliant: 0,
        totalNonCompliant: 0,
        missingDvirCount: 0,
        missingEquipmentCount: 0,
        missingJsaCount: 0,
        missingAllCount: 0,
        nonCompliantUsers: [],
      },
      emailResults: {
        gmail: { success: false, error: errorMessage },
        webhook: { success: false, error: errorMessage },
      },
      status: 'failed',
      error: errorMessage,
      dryRun,
    };
  }
}

/**
 * Convenience function to just send an email for an existing summary.
 * Useful for retrying failed sends.
 */
export async function sendAdminSummaryEmailOnly(
  summary: AdminComplianceSummary,
  runId?: string
): Promise<{ gmail: EmailSendResult; webhook: WebhookResult }> {
  const emailContent = generateAdminSummaryEmail(summary);
  
  // Send Gmail
  const gmailResult = await sendAdminComplianceEmail(emailContent, runId);
  
  // Send webhook
  const webhookPayload = buildWebhookPayload(
    summary,
    emailContent,
    gmailResult,
    { success: false }
  );
  const webhookResult = await sendToWebhook(webhookPayload, runId);
  
  return { gmail: gmailResult, webhook: webhookResult };
}

export default runAdminComplianceSummary;

