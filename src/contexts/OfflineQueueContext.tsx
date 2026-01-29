/**
 * Offline Queue Context
 *
 * Provides a submitter that replays queued form submissions when back online
 * (JSA insert only for now; DVIR/Equipment require photos and are skipped with a log).
 * Also provides an optional conflict check so we discard queued items if the user
 * already submitted the same form+date online.
 */

import { useCallback, useMemo, type ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./AuthContext";
import { useOfflineQueue } from "../hooks/useOfflineQueue";
import type { FormType, QueuedSubmission } from "../lib/offlineQueue";
import { logger } from "../lib/logger";
import { OfflineQueueContext } from "./offlineQueueContextValue";

function buildSubmitter(): (
  formType: FormType,
  payload: Record<string, unknown>,
  _files?: Record<string, Blob>
) => Promise<void> {
  return async (formType, payload) => {
    if (formType === "jsa") {
      const { error } = await supabase
        .from("daily_jsa")
        .insert([payload])
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return;
    }
    if (formType === "dvir" || formType === "equipment") {
      logger.warn(
        "[OfflineQueue] DVIR/Equipment require photos; discarding queued item. Submit when online."
      );
      return;
    }
    throw new Error(`Unknown form type: ${formType}`);
  };
}

export function OfflineQueueProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const submitter = useMemo(() => buildSubmitter(), []);

  const conflictCheck = useCallback(
    async (item: QueuedSubmission): Promise<boolean> => {
      if (!user?.id) return false;
      if (item.formType === "jsa" && item.dateFor) {
        const { data } = await supabase
          .from("daily_jsa")
          .select("id")
          .eq("user_id", user.id)
          .eq("job_date", item.dateFor)
          .maybeSingle();
        if (data) {
          logger.info(
            "[OfflineQueue] Discarding queued JSA; already submitted for",
            item.dateFor
          );
          return true;
        }
      }
      return false;
    },
    [user]
  );

  const value = useOfflineQueue({
    submitter,
    conflictCheck,
    processOnOnline: true,
  });

  return (
    <OfflineQueueContext.Provider value={value}>
      {children}
    </OfflineQueueContext.Provider>
  );
}
