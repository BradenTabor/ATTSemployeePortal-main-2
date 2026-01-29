import { createContext } from "react";
import type { UseOfflineQueueReturn } from "../hooks/useOfflineQueue";

export const OfflineQueueContext = createContext<UseOfflineQueueReturn | null>(null);
