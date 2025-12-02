import { supabase } from "./supabaseClient";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { logger } from "./logger";

export interface TableSubscriptionOptions<
  Row extends Record<string, unknown> = Record<string, unknown>
> {
  channelName: string;
  table: string;
  schema?: string;
  onInsert?: (payload: RealtimePostgresChangesPayload<Row>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<Row>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<Row>) => void;
  onError?: (error: Error) => void;
}

/**
 * Subscribes to INSERT/UPDATE/DELETE events on a Postgres table. 
 * 
 * @example
 * ```typescript
 * useEffect(() => {
 *   const unsubscribe = subscribeToTableChanges({
 *     channelName: "my-table-changes",
 *     table: "my_table",
 *     onInsert: (payload) => console.log("New row:", payload. new),
 *     onUpdate: (payload) => console.log("Updated row:", payload.new),
 *     onDelete: (payload) => console.log("Deleted row:", payload.old),
 *   });
 *
 *   return () => unsubscribe();
 * }, []);
 * ```
 * 
 * Returns an unsubscribe function you MUST call in your useEffect cleanup.
 */
export function subscribeToTableChanges<
  Row extends Record<string, unknown> = Record<string, unknown>
>(
  options: TableSubscriptionOptions<Row>
): () => void {
  const {
    channelName,
    table,
    schema = "public",
    onInsert,
    onUpdate,
    onDelete,
    onError,
  } = options;

  const channel = supabase.channel(channelName, {
    config: {
      broadcast: { self: false },
    },
  });

  if (onInsert) {
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema, table },
      (payload: RealtimePostgresChangesPayload<Row>) => {
        try {
          onInsert(payload);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error(`Error in onInsert handler for ${channelName}:`, err);
          onError?.(err);
        }
      }
    );
  }

  if (onUpdate) {
    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema, table },
      (payload: RealtimePostgresChangesPayload<Row>) => {
        try {
          onUpdate(payload);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error(`Error in onUpdate handler for ${channelName}:`, err);
          onError?.(err);
        }
      }
    );
  }

  if (onDelete) {
    channel.on(
      "postgres_changes",
      { event: "DELETE", schema, table },
      (payload: RealtimePostgresChangesPayload<Row>) => {
        try {
          onDelete(payload);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error(`Error in onDelete handler for ${channelName}:`, err);
          onError?.(err);
        }
      }
    );
  }

  // Subscribe and handle errors
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      logger.debug(`[Realtime] channel ready: ${channelName}`);
    } else if (status === "CHANNEL_ERROR") {
      const error = new Error(
        `Failed to subscribe to realtime channel: ${channelName}`
      );
      logger.error(error);
      onError?.(error);
    } else if (status === "CLOSED") {
      logger.debug(`[Realtime] channel closed: ${channelName}`);
    }
  });

  // 🔙 Caller MUST use this inside useEffect cleanup
  return () => {
    supabase.removeChannel(channel);
  };
}