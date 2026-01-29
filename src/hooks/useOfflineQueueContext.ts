/**
 * Hook to consume OfflineQueue context.
 * Lives in hooks/ so the context file only exports components (react-refresh).
 */

import { useContext } from "react";
import { OfflineQueueContext } from "../contexts/offlineQueueContextValue";
import type { UseOfflineQueueReturn } from "./useOfflineQueue";

export function useOfflineQueueContext(): UseOfflineQueueReturn {
  const ctx = useContext(OfflineQueueContext);
  if (ctx == null) {
    throw new Error("useOfflineQueueContext must be used within OfflineQueueProvider");
  }
  return ctx;
}
