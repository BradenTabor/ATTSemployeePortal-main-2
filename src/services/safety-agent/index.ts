/**
 * AI Safety + Compliance Agent
 * 
 * Main entry point for the safety-agent module. Exports all public functions
 * and types for use by other parts of the application or edge functions.
 * 
 * @module safety-agent
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  ComplianceCheckOptions,
  ComplianceRunResult,
  NotificationType,
  MissingSubmission,
  ComplianceWebhookPayload,
  WebhookResult,
  ComplianceRun,
  ComplianceNotification,
  RequiredUser,
  // Announcement types
  JsaSubmission,
  JsaAggregation,
  HazardCount,
  AnnouncementSections,
  AnnouncementMetadata,
  GeneratedAnnouncement,
  GenerateAnnouncementOptions,
  GenerateAnnouncementResult,
  // DVIR types
  DvirReport,
  DvirAggregation,
  // Equipment types
  EquipmentInspectionReport,
  EquipmentAggregation,
  // Combined aggregation
  SafetyDataAggregation,
  // Admin Compliance Summary types
  AdminNotificationType,
  NonCompliantUser,
  AdminComplianceSummary,
  AdminComplianceCheckOptions,
  AdminComplianceRunResult,
  EmailSendResult,
  AdminEmailContent,
  AdminSummaryWebhookPayload,
  GmailConfig,
} from './types';

// =============================================================================
// COMPLIANCE CHECK (Legacy - Per-User Notifications)
// =============================================================================

/**
 * @deprecated Use runAdminComplianceSummary instead for consolidated admin emails.
 * This function sends individual notifications to each non-compliant user.
 */
export { checkCompliance9am, computeMissingType } from './execution/checkCompliance9am';

// =============================================================================
// ADMIN COMPLIANCE SUMMARY (Recommended - Consolidated Admin Email)
// =============================================================================

export {
  // Main orchestration function
  runAdminComplianceSummary,
  // Utility for retrying sends
  sendAdminSummaryEmailOnly,
} from './execution/sendAdminSummaryEmail';

export {
  // Core compliance check with JSA
  checkAdminCompliance9am,
  // Helper functions
  isWeekday,
  computeAdminMissingType,
  getMissingFormsList,
} from './execution/checkAdminCompliance9am';

export {
  // Email generation
  generateAdminSummaryEmail,
  generateTextBody,
  generateHtmlBody,
  generateSubject,
} from './execution/generateAdminSummaryEmail';

// =============================================================================
// NOTIFICATION SENDING
// =============================================================================

export { 
  sendComplianceEmail, 
  sendComplianceEmails,
  getMissingItems,
  buildAppLink,
} from './execution/sendComplianceEmail';

// =============================================================================
// ANNOUNCEMENT STUBS (Future Implementation)
// =============================================================================

export { 
  generateDailySafetyAnnouncement,
  // Data fetching
  fetchJsaSubmissions,
  fetchDvirReports,
  fetchEquipmentInspections,
  fetchAllSafetyData,
  // Aggregation
  aggregateHazards,
  aggregateJsaData,
  aggregateDvirData,
  aggregateEquipmentData,
  aggregateAllSafetyData,
  getTopItems,
  // Character limit validation
  validateBodyLength,
  validateSummaryLength,
  // Character limit constants
  BODY_TARGET_CHAR_LIMIT,
  BODY_MAX_CHAR_LIMIT,
  SUMMARY_MAX_CHAR_LIMIT,
} from './execution/generateDailySafetyAnnouncement';

export { 
  publishAnnouncement,
  unpublishAnnouncement,
  getAnnouncement,
} from './execution/publishAnnouncement';

// =============================================================================
// UTILITIES
// =============================================================================

export { getSupabaseAdmin, createSupabaseAdmin } from './lib/supabaseAdmin';

// Gmail sending
export {
  sendGmailEmail,
  sendAdminComplianceEmail,
  getGmailConfig,
  isGmailConfigured,
} from './lib/gmail';
export { 
  getOpenAIClient, 
  createOpenAIClient,
  chatCompletion,
  jsonCompletion,
  isOpenAIConfigured,
  getDefaultModel,
  resetOpenAIClient,
} from './lib/openai';
export { safetyLogger } from './lib/logger';
export {
  getTodayInTimezone,
  buildCutoffTimestamp,
  formatDateYMD,
  toISOString,
  isBeforeCutoff,
  nowISO,
  DEFAULT_TIMEZONE,
  DEFAULT_CUTOFF,
} from './lib/time';

