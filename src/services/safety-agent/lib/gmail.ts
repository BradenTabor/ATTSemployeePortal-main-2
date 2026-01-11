/**
 * Gmail SMTP Email Sending Utility
 * 
 * Uses Nodemailer with Gmail SMTP to send emails directly.
 * Requires Gmail App Password authentication (2FA must be enabled on the Gmail account).
 * 
 * @module safety-agent/lib/gmail
 */

import type { EmailSendResult, GmailConfig, AdminEmailContent } from '../types';
import { safetyLogger } from './logger';

// =============================================================================
// CONSTANTS
// =============================================================================

const GMAIL_SMTP_HOST = 'smtp.gmail.com';
const GMAIL_SMTP_PORT = 587;

// Default recipients for admin compliance summary
const DEFAULT_ADMIN_RECIPIENTS = [
  'bradenleetabor@gmail.com',
  'shane@alltts.com',
  'dusty@alltts.com',
  'mike@alltts.com',
  'weston@alltts.com',
  'steve@alltts.com',
];

// Default sender
const DEFAULT_GMAIL_USER = 'allterraintreeservice.po@gmail.com';

// =============================================================================
// ENVIRONMENT HELPERS
// =============================================================================

// Declare globals for cross-runtime compatibility
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
  // Try Vite env vars in browser context
  if (typeof import.meta !== 'undefined' && (import.meta as unknown as Record<string, unknown>).env) {
    return ((import.meta as unknown as Record<string, unknown>).env as Record<string, string>)[name];
  }
  return undefined;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Get Gmail configuration from environment variables.
 * 
 * @returns GmailConfig object or null if not configured
 */
export function getGmailConfig(): GmailConfig | null {
  const user = getEnvVar('GMAIL_USER') || getEnvVar('VITE_GMAIL_USER') || DEFAULT_GMAIL_USER;
  const appPassword = getEnvVar('GMAIL_APP_PASSWORD') || getEnvVar('VITE_GMAIL_APP_PASSWORD');
  const recipientsStr = getEnvVar('ADMIN_EMAIL_RECIPIENTS') || getEnvVar('VITE_ADMIN_EMAIL_RECIPIENTS');
  
  // App password is required
  if (!appPassword) {
    safetyLogger.warn('Gmail App Password not configured - email sending will fail', {
      hint: 'Set GMAIL_APP_PASSWORD environment variable',
    });
    return null;
  }

  const recipients = recipientsStr 
    ? recipientsStr.split(',').map(e => e.trim()).filter(Boolean)
    : DEFAULT_ADMIN_RECIPIENTS;

  return {
    user,
    appPassword,
    recipients,
  };
}

/**
 * Check if Gmail is properly configured for sending.
 */
export function isGmailConfigured(): boolean {
  const config = getGmailConfig();
  return config !== null && !!config.appPassword;
}

// =============================================================================
// NODEMAILER TRANSPORT (Lazy Loading)
// =============================================================================

// We'll import nodemailer dynamically to avoid issues in browser environments
let nodemailer: typeof import('nodemailer') | null = null;

async function getNodemailer(): Promise<typeof import('nodemailer')> {
  if (nodemailer) {
    return nodemailer;
  }
  
  try {
    // Dynamic import for Node.js/Deno environments
    nodemailer = await import('nodemailer');
    return nodemailer;
  } catch {
    throw new Error('Nodemailer is not available. Please install it with: npm install nodemailer');
  }
}

// =============================================================================
// EMAIL SENDING
// =============================================================================

export interface SendGmailEmailParams {
  /** Email subject */
  subject: string;
  /** Plain text body */
  textBody: string;
  /** HTML body (optional) */
  htmlBody?: string;
  /** Override recipients (optional) */
  recipients?: string[];
  /** Custom from address (optional) */
  from?: string;
  /** Run ID for logging context */
  runId?: string;
}

/**
 * Send an email via Gmail SMTP.
 * 
 * @param params - Email parameters
 * @returns EmailSendResult with success status
 * 
 * @example
 * const result = await sendGmailEmail({
 *   subject: '[ATTS] Daily Compliance Report',
 *   textBody: 'Report content here...',
 *   runId: 'run-123',
 * });
 */
export async function sendGmailEmail(params: SendGmailEmailParams): Promise<EmailSendResult> {
  const { subject, textBody, htmlBody, recipients: customRecipients, from: customFrom, runId } = params;
  
  // Check dry-run mode
  const dryRun = getEnvVar('DRY_RUN') === 'true';
  if (dryRun) {
    safetyLogger.info('DRY RUN: Would send Gmail email', {
      runId,
      subject,
      bodyLength: textBody.length,
    });
    return {
      success: true,
      messageId: 'dry-run-message-id',
      recipientCount: customRecipients?.length || DEFAULT_ADMIN_RECIPIENTS.length,
    };
  }

  // Get configuration
  const config = getGmailConfig();
  if (!config) {
    return {
      success: false,
      error: 'Gmail not configured. Set GMAIL_APP_PASSWORD environment variable.',
    };
  }

  const recipients = customRecipients || config.recipients;
  const from = customFrom || config.user;

  try {
    // Get nodemailer
    const mailer = await getNodemailer();
    
    // Create transporter
    const transporter = mailer.createTransport({
      host: GMAIL_SMTP_HOST,
      port: GMAIL_SMTP_PORT,
      secure: false, // Use STARTTLS
      auth: {
        user: config.user,
        pass: config.appPassword.replace(/\s/g, ''), // Remove spaces from app password
      },
    });

    safetyLogger.debug('Sending email via Gmail SMTP', {
      runId,
      from,
      to: recipients.join(', '),
      subject,
    });

    // Send the email
    const info = await transporter.sendMail({
      from: `"ATTS Safety Compliance" <${from}>`,
      to: recipients.join(', '),
      subject,
      text: textBody,
      html: htmlBody,
    });

    safetyLogger.info('Gmail email sent successfully', {
      runId,
      messageId: info.messageId,
      recipientCount: recipients.length,
    });

    return {
      success: true,
      messageId: info.messageId,
      recipientCount: recipients.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    safetyLogger.error('Gmail send failed', {
      runId,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send admin compliance summary email.
 * Convenience wrapper that uses the standard admin email format.
 * 
 * @param content - Email content
 * @param runId - Run ID for logging
 */
export async function sendAdminComplianceEmail(
  content: AdminEmailContent,
  runId?: string
): Promise<EmailSendResult> {
  return sendGmailEmail({
    subject: content.subject,
    textBody: content.textBody,
    htmlBody: content.htmlBody,
    runId,
  });
}

export default sendGmailEmail;

