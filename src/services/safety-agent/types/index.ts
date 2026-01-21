/**
 * TypeScript types for the AI Safety + Compliance Agent
 * 
 * These types define the contracts for compliance checking, notifications,
 * and audit logging throughout the safety-agent module.
 */

// =============================================================================
// COMPLIANCE CHECK TYPES
// =============================================================================

export interface ComplianceCheckOptions {
  /** Target date in YYYY-MM-DD format. Defaults to today in America/Chicago */
  dateFor?: string;
  /** Cutoff time in HH:MM format. Defaults to '09:00' */
  cutoffLocal?: string;
  /** Timezone for date/cutoff calculations. Defaults to 'America/Chicago' */
  timezone?: string;
  /** If true, compute results but don't send webhooks. Defaults to env DRY_RUN */
  dryRun?: boolean;
  /** If true, send notifications via webhook. Defaults to env EMAIL_NOTIFICATIONS_ENABLED */
  notificationsEnabled?: boolean;
}

export interface ComplianceRunResult {
  /** UUID of the compliance_runs record */
  runId: string;
  /** The date that was checked (YYYY-MM-DD) */
  dateFor: string;
  /** Total users required to submit (employee + foreman with email) */
  requiredUserCount: number;
  /** Users missing DVIR only */
  missingDvirCount: number;
  /** Users missing equipment inspection only */
  missingEquipmentCount: number;
  /** Users missing both DVIR and equipment inspection */
  missingBothCount: number;
  /** Number of successful webhook notifications sent */
  webhooksSent: number;
  /** Number of notifications skipped (duplicates or dry-run) */
  webhooksSkipped: number;
  /** Final status of the run */
  status: 'success' | 'failed';
  /** Error message if status is 'failed' */
  error?: string;
  /** Whether this was a dry run */
  dryRun: boolean;
}

// =============================================================================
// NOTIFICATION TYPES
// =============================================================================

export type NotificationType = 
  | 'missing_dvir' 
  | 'missing_equipment' 
  | 'missing_both';

/** Extended notification type for admin summary (includes JSA) */
export type AdminNotificationType =
  | 'missing_all'           // Missing DVIR, Equipment, AND JSA
  | 'missing_dvir_equipment' // Missing DVIR AND Equipment only
  | 'missing_dvir_jsa'       // Missing DVIR AND JSA only
  | 'missing_equipment_jsa'  // Missing Equipment AND JSA only
  | 'missing_dvir'           // Missing DVIR only
  | 'missing_equipment'      // Missing Equipment only
  | 'missing_jsa';           // Missing JSA only

export interface MissingSubmission {
  /** User's UUID from app_users.user_id */
  userId: string;
  /** User's email address */
  email: string;
  /** User's full name (may be null if not set) */
  fullName: string | null;
  /** User's role (employee or foreman) */
  role: string;
  /** What type of submission is missing */
  type: NotificationType;
}

// =============================================================================
// WEBHOOK PAYLOAD TYPES (Make.com)
// =============================================================================

export interface ComplianceWebhookPayload {
  /** Identifies this as a compliance reminder */
  type: 'compliance_reminder';
  /** The date being checked (YYYY-MM-DD) */
  dateFor: string;
  /** User information */
  user: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
  };
  /** What's missing */
  missingType: NotificationType;
  /** Human-readable list of missing items */
  missingItems: string[];
  /** Link to the app for submission */
  appLink: string;
  /** ISO timestamp of when this notification was generated */
  timestamp: string;
  /** Unique notification ID for tracking */
  notificationId: string;
}

export interface WebhookResult {
  /** Whether the webhook call succeeded */
  success: boolean;
  /** Response from the webhook (if any) */
  webhookResponse?: unknown;
  /** Error message if failed */
  error?: string;
}

// =============================================================================
// DATABASE RECORD TYPES
// =============================================================================

export interface ComplianceRun {
  id: string;
  run_type: string;
  date_for: string;
  cutoff_time: string;
  timezone: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'success' | 'failed';
  required_user_count: number | null;
  missing_dvir_count: number | null;
  missing_equipment_count: number | null;
  missing_both_count: number | null;
  webhooks_sent: number;
  webhooks_skipped: number;
  dry_run: boolean;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplianceNotification {
  id: string;
  date_for: string;
  user_id: string;
  notification_type: NotificationType;
  sent_to: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  sent_at: string | null;
  webhook_response: unknown | null;
  error: string | null;
  created_at: string;
}

// =============================================================================
// REQUIRED USER TYPES (from app_users)
// =============================================================================

export interface RequiredUser {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
}

// =============================================================================
// SUBMISSION RECORD TYPES
// =============================================================================

export interface DvirSubmission {
  id: string;
  user_id: string;
  report_date: string;
  created_at: string;
}

export interface EquipmentInspection {
  id: string;
  user_id: string;
  inspection_date: string;
  created_at: string;
}

// =============================================================================
// SAFETY ANNOUNCEMENT TYPES
// =============================================================================

export interface JsaSubmission {
  id: string;
  user_id: string;
  work_location: string | null;
  hazards_present: Record<string, boolean> | null;
  ppe: Record<string, { required: boolean; condition: string }> | null;
  weather_conditions: { conditions: Record<string, boolean>; modifiers: Record<string, boolean> } | null;
  notes: string | null;
  created_at: string;
}

export interface HazardCount {
  hazard: string;
  count: number;
  note?: string;
}

export interface AnnouncementSections {
  overview: string;
  topHazards: HazardCount[];
  ppeReminders: string[];
  expectations: string[];
}

export interface AnnouncementMetadata {
  windowStart: string;
  windowEnd: string;
  jsaCount: number;
  promptVersion: string;
  model: string;
  generatedAt: string;
  bodyCharCount: number;
  summaryCharCount: number;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface GeneratedAnnouncement {
  /** Short title for the announcement */
  title: string;
  /** 
   * Main body text - MUST be <= 283 characters, target 238 characters
   */
  body: string;
  /** 
   * Short summary for push/SMS - MUST be <= 240 characters
   */
  summary: string;
  /** Detailed sections for full display */
  sections: AnnouncementSections;
  /** Metadata about the generation */
  metadata: AnnouncementMetadata;
}

export interface GenerateAnnouncementOptions {
  /** Hours to look back for JSA submissions. Default: 24 */
  windowHours?: number;
  /** Minimum JSAs required to generate. Default: 3 */
  minSubmissions?: number;
  /** Prompt version to use. Default: 'v1' */
  promptVersion?: string;
  /** Whether to auto-publish or keep as draft. Default: 'draft' */
  mode?: 'draft' | 'auto_publish';
  /** OpenAI model to use. Default: 'gpt-4o-mini' */
  model?: string;
  /** Temperature for generation. Default: 0.3 */
  temperature?: number;
}

export interface GenerateAnnouncementResult {
  success: boolean;
  announcement?: GeneratedAnnouncement;
  /** ID of the announcement in the safety_announcements table */
  announcementId?: string;
  /** ID of the announcement in the main announcements table (for rewards system) */
  publicAnnouncementId?: string;
  error?: string;
  lowData?: boolean;
  /** Warning if body was truncated to meet character limit */
  truncated?: boolean;
}

export interface JsaAggregation {
  totalCount: number;
  hazardCounts: Map<string, number>;
  ppeCounts: Map<string, number>;
  controlCounts: Map<string, number>;
  nearMissCount: number;
  jobSites: Set<string>;
  weatherConditions: Set<string>;
}

// =============================================================================
// DVIR (Daily Vehicle Inspection Report) TYPES
// =============================================================================

export interface DvirReport {
  id: string;
  user_id: string | null;
  created_at: string;
  truck_number: string;
  vehicle_trailer_checklist: Record<string, boolean | string> | null;
  aerial_checklist: Record<string, boolean | string> | null;
  notes: string | null;
  aerial_notes: string | null;
  deficiency_corrected: string | null;
  mechanic_remarks: string | null;
}

export interface DvirAggregation {
  totalCount: number;
  deficiencyCount: number;
  vehicleIssues: Map<string, number>;
  aerialIssues: Map<string, number>;
  truckNumbers: Set<string>;
}

// =============================================================================
// EQUIPMENT INSPECTION TYPES
// =============================================================================

export interface EquipmentInspectionReport {
  id: string;
  user_id: string | null;
  created_at: string;
  equipment_type: string;
  equipment_number: string;
  general_checklist: Record<string, boolean | string> | null;
  specific_checklist: Record<string, boolean | string> | null;
  notes: string | null;
}

export interface EquipmentAggregation {
  totalCount: number;
  equipmentTypes: Map<string, number>;
  issuesCounts: Map<string, number>;
  equipmentNumbers: Set<string>;
}

// =============================================================================
// COMBINED SAFETY DATA AGGREGATION
// =============================================================================

export interface SafetyDataAggregation {
  jsa: JsaAggregation;
  dvir: DvirAggregation;
  equipment: EquipmentAggregation;
  /** Combined totals across all sources */
  totals: {
    totalSubmissions: number;
    totalHazards: number;
    totalIssues: number;
    nearMissCount: number;
  };
}

// =============================================================================
// ADMIN COMPLIANCE SUMMARY TYPES
// =============================================================================

/** A user who is missing one or more required forms */
export interface NonCompliantUser {
  /** User's UUID from app_users.user_id */
  userId: string;
  /** User's email address */
  email: string;
  /** User's full name (may be null if not set) */
  fullName: string | null;
  /** User's role (employee or foreman) */
  role: string;
  /** What type of submission(s) are missing */
  missingType: AdminNotificationType;
  /** Human-readable list of missing forms */
  missingForms: string[];
  /** Individual flags for each form type */
  hasDvir: boolean;
  hasEquipment: boolean;
  hasJsa: boolean;
}

/** Summary statistics for compliance check */
export interface AdminComplianceSummary {
  /** The date that was checked (YYYY-MM-DD) */
  dateFor: string;
  /** ISO timestamp when the check was performed */
  generatedAt: string;
  /** Total users required to submit (employee + foreman with email) */
  totalRequired: number;
  /** Users who submitted all required forms */
  totalCompliant: number;
  /** Users missing at least one form */
  totalNonCompliant: number;
  /** Breakdown by missing form type */
  missingDvirCount: number;
  missingEquipmentCount: number;
  missingJsaCount: number;
  missingAllCount: number;
  /** List of non-compliant users */
  nonCompliantUsers: NonCompliantUser[];
  /** Whether this was a weekend (skipped) */
  skippedWeekend?: boolean;
}

/** Options for admin compliance check */
export interface AdminComplianceCheckOptions extends ComplianceCheckOptions {
  /** Whether to skip weekday check (for testing) */
  skipWeekdayCheck?: boolean;
}

/** Result of admin compliance check and email send */
export interface AdminComplianceRunResult {
  /** UUID of the compliance_runs record */
  runId: string;
  /** The compliance summary data */
  summary: AdminComplianceSummary;
  /** Email send results */
  emailResults: {
    gmail: EmailSendResult;
    webhook: WebhookResult;
  };
  /** Final status of the run */
  status: 'success' | 'failed' | 'skipped';
  /** Error message if status is 'failed' */
  error?: string;
  /** Whether this was a dry run */
  dryRun: boolean;
}

/** Result of sending email via Gmail */
export interface EmailSendResult {
  /** Whether the email was sent successfully */
  success: boolean;
  /** Gmail message ID if successful */
  messageId?: string;
  /** Error message if failed */
  error?: string;
  /** Number of recipients */
  recipientCount?: number;
}

/** Email content structure */
export interface AdminEmailContent {
  /** Email subject line */
  subject: string;
  /** Plain text body */
  textBody: string;
  /** HTML body (optional) */
  htmlBody?: string;
}

/** Webhook payload for admin compliance summary */
export interface AdminSummaryWebhookPayload {
  /** Identifies this as an admin compliance summary */
  type: 'admin_compliance_summary';
  /** The date being checked (YYYY-MM-DD) */
  dateFor: string;
  /** ISO timestamp when generated */
  generatedAt: string;
  /** Summary statistics */
  summary: {
    totalRequired: number;
    totalCompliant: number;
    totalNonCompliant: number;
    missingDvirCount: number;
    missingEquipmentCount: number;
    missingJsaCount: number;
    missingAllCount: number;
  };
  /** List of non-compliant users */
  nonCompliantUsers: Array<{
    userId: string;
    email: string;
    fullName: string | null;
    role: string;
    missingForms: string[];
    missingType: AdminNotificationType;
  }>;
  /** Email content that was sent */
  emailContent: AdminEmailContent;
  /** Results of send operations */
  sendResults: {
    gmail: { success: boolean; messageId?: string; error?: string };
    webhook: { success: boolean; error?: string };
  };
}

/** Gmail configuration */
export interface GmailConfig {
  /** Gmail address to send from */
  user: string;
  /** Gmail App Password (16 characters) */
  appPassword: string;
  /** List of recipient email addresses */
  recipients: string[];
}

