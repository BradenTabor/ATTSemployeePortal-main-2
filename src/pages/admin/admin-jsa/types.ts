/**
 * Type definitions for AdminJSA page
 */

import type { DailyJsaRecord } from "../../forms/DailyJSAForm";

export type AdminJsaRow = DailyJsaRecord & {
  user_email?: string | null;
  user_name?: string | null;
  user_role?: string | null;
  /** From daily_jsa select for export (Slice 1) */
  jsa_type?: string | null;
  tree_felling_data?: unknown;
  /** Composite for PDF export only (formatter-built) */
  conditions_ppe_summary?: string;
  /** Composite for PDF export only (formatter-built) */
  site_hazards_traffic_summary?: string;
  /** Short spans summary for PDF (formatter-built) */
  spans_summary?: string;
};

export type UserProfileMeta = {
  email?: string | null;
  role?: string | null;
  full_name?: string | null;
};

export type SortField = "job_date" | "updated_at" | "work_location" | "user_name" | "status";
export type SortDirection = "asc" | "desc";

export type JobSelection = {
  key: string;
  label?: string;
};

export type WeatherPayload = {
  conditions?: Record<string, boolean>;
  modifiers?: Record<string, boolean>;
};

export type JsaStats = {
  total: number;
  drafts: number;
  completed: number;
  todayCount: number;
  weekCount: number;
};
