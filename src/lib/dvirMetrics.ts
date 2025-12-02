import { supabase } from "./supabaseClient";
import { logger } from "./logger";
import type { PostgrestError } from "@supabase/supabase-js";

/**
 * DVIR schema notes (see DVIRForm.tsx, DVIRHistory.tsx, MechanicDVIRCenter.tsx):
 * - Table: `dvir_reports`
 * - Key timestamps: `created_at` (always set), `mechanic_date` (populated when a fix is logged)
 * - Mechanic fixes tracked via `deficiency_corrected` + `mechanic_remarks`
 * - No explicit severity column exists yet, so “critical” metrics fall back to 0.
 */

export type DvirMetrics = {
  totalOpen: number;
  totalCompletedLast7Days: number;
  todaysReports: number;
  criticalOpen: number;
};

const DVIR_TABLE = "dvir_reports";
const METRIC_DEFAULTS: DvirMetrics = {
  totalOpen: 0,
  totalCompletedLast7Days: 0,
  todaysReports: 0,
  criticalOpen: 0,
};

type CountQuery = PromiseLike<{
  count: number | null;
  error: PostgrestError | null;
}>;

const getCountOrZero = async (builder: CountQuery, context: string): Promise<number> => {
  const { count, error } = await builder;
  if (error) {
    logger.error(`[dvirMetrics] ${context} count failed`, error);
    return 0;
  }
  return count ?? 0;
};

export async function fetchDvirMetrics(): Promise<DvirMetrics> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    const [totalOpen, totalCompletedLast7Days, todaysReports] = await Promise.all([
      getCountOrZero(
        supabase
          .from(DVIR_TABLE)
          .select("*", { head: true, count: "exact" })
          .or("mechanic_date.is.null,deficiency_corrected.is.null"),
        "totalOpen"
      ),
      getCountOrZero(
        supabase
          .from(DVIR_TABLE)
          .select("*", { head: true, count: "exact" })
          .not("mechanic_date", "is", "null")
          .gte("mechanic_date", sevenDaysAgo.toISOString()),
        "completedLast7Days"
      ),
      getCountOrZero(
        supabase
          .from(DVIR_TABLE)
          .select("*", { head: true, count: "exact" })
          .gte("created_at", startOfToday.toISOString()),
        "todaysReports"
      ),
    ]);

    // No severity column observed yet – surface TODO for future schema enhancement.
    const criticalOpen = 0; // TODO: wire up once a severity/priority flag exists.

    return {
      totalOpen,
      totalCompletedLast7Days,
      todaysReports,
      criticalOpen,
    };
  } catch (error) {
    logger.error("[dvirMetrics] Unexpected metrics failure", error);
    return { ...METRIC_DEFAULTS };
  }
}

