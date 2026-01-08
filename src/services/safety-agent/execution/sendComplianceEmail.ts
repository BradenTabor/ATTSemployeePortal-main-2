/**
 * Send Compliance Email via Make.com Webhook
 * 
 * This module sends compliance reminder notifications to the Make.com webhook,
 * which handles the actual email delivery and any additional automations.
 * 
 * Webhook URL: https://hook.us2.make.com/hdty3eds1lpldxt2ne4amq1dgdohmvpc
 */

import type { 
  ComplianceWebhookPayload, 
  WebhookResult, 
  NotificationType 
} from '../types';
import { safetyLogger } from '../lib/logger';
import { nowISO } from '../lib/time';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_WEBHOOK_URL = 'https://hook.us2.make.com/hdty3eds1lpldxt2ne4amq1dgdohmvpc';

// Environment variable names for webhook URL (check multiple for flexibility)
const WEBHOOK_ENV_VARS = [
  'VITE_MAKE_DEN_WEBHOOK_URL',  // Frontend Vite env var
  'MAKE_WEBHOOK_URL',           // Backend/Edge Function env var
  'MAKE_DEN_WEBHOOK_URL',       // Alternative naming
];

// Declare globals for cross-runtime compatibility
declare const Deno: { env: { get(key: string): string | undefined } } | undefined;
declare const process: { env?: Record<string, string | undefined> } | undefined;

// Detect runtime environment
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
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert notification type to human-readable list of missing items
 */
export function getMissingItems(type: NotificationType): string[] {
  switch (type) {
    case 'missing_dvir':
      return ['DVIR (Daily Vehicle Inspection Report)'];
    case 'missing_equipment':
      return ['Daily Equipment Inspection'];
    case 'missing_both':
      return ['DVIR (Daily Vehicle Inspection Report)', 'Daily Equipment Inspection'];
    default:
      return [];
  }
}

/**
 * Build the app link for the user to submit their forms
 */
export function buildAppLink(baseUrl: string): string {
  // Remove trailing slash if present
  const base = baseUrl.replace(/\/$/, '');
  return `${base}/dashboard`;
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

export interface SendComplianceEmailParams {
  /** Unique notification ID for tracking */
  notificationId: string;
  /** Date being checked (YYYY-MM-DD) */
  dateFor: string;
  /** User information */
  user: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
  };
  /** What type of submission is missing */
  missingType: NotificationType;
  /** Run ID for logging context */
  runId?: string;
}

/**
 * Send a compliance reminder notification via Make.com webhook.
 * 
 * @param params - The notification parameters
 * @returns WebhookResult with success status and response
 * 
 * @example
 * const result = await sendComplianceEmail({
 *   notificationId: 'abc-123',
 *   dateFor: '2026-01-08',
 *   user: { id: 'user-uuid', email: 'john@example.com', fullName: 'John Smith', role: 'employee' },
 *   missingType: 'missing_both',
 * });
 */
export async function sendComplianceEmail(
  params: SendComplianceEmailParams
): Promise<WebhookResult> {
  const { notificationId, dateFor, user, missingType, runId } = params;

  // Get configuration - check multiple env var names for webhook URL
  const webhookUrl = WEBHOOK_ENV_VARS.map(v => getEnvVar(v)).find(Boolean) || DEFAULT_WEBHOOK_URL;
  const appBaseUrl = getEnvVar('APP_BASE_URL') || getEnvVar('VITE_APP_BASE_URL') || 'https://att-semployee-portal-main-2.vercel.app';
  const dryRun = getEnvVar('DRY_RUN') === 'true';

  // Build the payload
  const payload: ComplianceWebhookPayload = {
    type: 'compliance_reminder',
    dateFor,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
    missingType,
    missingItems: getMissingItems(missingType),
    appLink: buildAppLink(appBaseUrl),
    timestamp: nowISO(),
    notificationId,
  };

  // In dry-run mode, just log and return success
  if (dryRun) {
    safetyLogger.info('DRY RUN: Would send webhook', {
      runId,
      userId: user.id,
      notificationType: missingType,
      payload: JSON.stringify(payload).slice(0, 500),
    });

    return {
      success: true,
      webhookResponse: { dryRun: true, payload },
    };
  }

  // Send the webhook
  try {
    safetyLogger.debug('Sending webhook to Make.com', {
      runId,
      userId: user.id,
      notificationType: missingType,
    });

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Parse response
    let responseData: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    // Check for success
    if (!response.ok) {
      safetyLogger.error('Webhook failed', {
        runId,
        userId: user.id,
        status: response.status,
        response: JSON.stringify(responseData).slice(0, 200),
      });

      return {
        success: false,
        webhookResponse: responseData,
        error: `Webhook returned ${response.status}: ${response.statusText}`,
      };
    }

    safetyLogger.webhookCall(runId || 'unknown', user.id, true, responseData);

    return {
      success: true,
      webhookResponse: responseData,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    safetyLogger.error('Webhook exception', {
      runId,
      userId: user.id,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send multiple compliance emails in sequence.
 * 
 * We send sequentially rather than in parallel to avoid overwhelming
 * the Make.com webhook and to make error handling clearer.
 */
export async function sendComplianceEmails(
  notifications: SendComplianceEmailParams[]
): Promise<Map<string, WebhookResult>> {
  const results = new Map<string, WebhookResult>();

  for (const notification of notifications) {
    const result = await sendComplianceEmail(notification);
    results.set(notification.notificationId, result);
    
    // Small delay between requests to be nice to the webhook
    if (notifications.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

export default sendComplianceEmail;

