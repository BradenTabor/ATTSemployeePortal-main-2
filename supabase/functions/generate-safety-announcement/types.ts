/**
 * Type definitions for generate-safety-announcement Edge Function
 */

// =============================================================================
// DATA AGGREGATION TYPES
// =============================================================================

export interface HazardCount {
  hazard: string;
  count: number;
}

export interface DvirIssue {
  type: string;
  truckNumber: string;
}

export interface EquipmentIssue {
  type: string;
  equipmentType: string;
}

export interface AggregatedStats {
  jsaCount: number;
  dvirCount: number;
  equipmentCount: number;
  totalSubmissions: number;
  topHazards: HazardCount[];
  topPPE: [string, number][];
  nearMissCount: number;
  weatherConditions: string[];
  dvirWithIssues: number;
  dvirIssues: DvirIssue[];
  equipmentWithIssues: number;
  equipmentIssues: EquipmentIssue[];
}

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

export interface RequestBody {
  windowHours?: number;
  dryRun?: boolean;
  skipWeekendCheck?: boolean;
}

export interface GeneratedAnnouncement {
  title: string;
  message: string;
}

export interface NotificationResult {
  dispatched: number;
  skipped: number;
  failed?: number;
}

export interface SuccessResponse {
  success: true;
  status: 'success';
  dateFor: string;
  announcement: {
    title: string;
    body: string;
    summary: string;
    charCount: number;
    truncated: boolean;
  };
  announcementId: string | null;
  stats: {
    jsaCount: number;
    dvirCount: number;
    equipmentCount: number;
    totalSubmissions: number;
    topHazards: HazardCount[];
    nearMissCount: number;
    dvirWithIssues: number;
    equipmentWithIssues: number;
    tokensUsed: number;
  };
  notification: NotificationResult | null;
  dryRun: boolean;
  lowData: boolean;
  durationMs: number;
}

export interface SkippedResponse {
  success: true;
  status: 'skipped';
  reason: 'weekend';
  dateFor: string;
}

export interface ErrorResponse {
  success: false;
  status: 'failed';
  error: string;
}
