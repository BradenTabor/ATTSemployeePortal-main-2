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
} from './types';

// =============================================================================
// COMPLIANCE CHECK (Main Function)
// =============================================================================

export { checkCompliance9am, computeMissingType } from './execution/checkCompliance9am';

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

