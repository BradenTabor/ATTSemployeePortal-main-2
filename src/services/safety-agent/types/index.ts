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
  job_site: string | null;
  hazards: string[] | null;
  ppe_required: string[] | null;
  controls: string[] | null;
  weather_conditions: string | null;
  near_miss: boolean | null;
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
  announcementId?: string;
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

