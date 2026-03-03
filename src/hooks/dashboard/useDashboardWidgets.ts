/**
 * useDashboardWidgets — Optional hook for Safety Officer Dashboard widget coordination.
 * Exposes refetch/loading aggregates if needed; dashboard can also use widgets independently.
 */

import { useQueryClient } from "@tanstack/react-query";

const WIDGET_KEYS = [
  ["compliance_summary_by_day"],
  ["safety_incidents_last_recordable"],
  ["risk_score_history"],
  ["certification_records_expiring_90d"],
  ["compliance_runs_latest"],
  ["compliance_notifications"],
  ["safety_incidents_trend"],
  ["safety_incidents_body_parts"],
  ["daily_jsa_by_site"],
  ["dvir_metrics_today"],
  ["safety_flags_open"],
] as const;

export function useDashboardWidgets() {
  const queryClient = useQueryClient();

  const refetchAll = () => {
    WIDGET_KEYS.forEach((key) => {
      queryClient.invalidateQueries({ queryKey: key });
    });
  };

  return { refetchAll };
}
