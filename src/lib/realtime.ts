import { supabase } from "./supabaseClient";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export interface TableSubscriptionOptions {
  channelName: string;
  table: string;
  schema?: string;
  onInsert?: (payload: RealtimePostgresChangesPayload<Record<string, any>>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<Record<string, any>>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<Record<string, any>>) => void;
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
export function subscribeToTableChanges(
  options: TableSubscriptionOptions
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
      (payload: RealtimePostgresChangesPayload<Record<string, any>>) => {
        try {
          onInsert(payload);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error(`Error in onInsert handler for ${channelName}:`, err);
          onError?.(err);
        }
      }
    );
  }

  if (onUpdate) {
    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema, table },
      (payload: RealtimePostgresChangesPayload<Record<string, any>>) => {
        try {
          onUpdate(payload);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error(`Error in onUpdate handler for ${channelName}:`, err);
          onError?.(err);
        }
      }
    );
  }

  if (onDelete) {
    channel.on(
      "postgres_changes",
      { event: "DELETE", schema, table },
      (payload: RealtimePostgresChangesPayload<Record<string, any>>) => {
        try {
          onDelete(payload);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error(`Error in onDelete handler for ${channelName}:`, err);
          onError?.(err);
        }
      }
    );
  }

  // Subscribe and handle errors
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      console.log(`✅ Realtime subscription active: ${channelName}`);
    } else if (status === "CHANNEL_ERROR") {
      const error = new Error(
        `Failed to subscribe to realtime channel: ${channelName}`
      );
      console.error(error);
      onError?.(error);
    } else if (status === "CLOSED") {
      console.log(`Realtime subscription closed: ${channelName}`);
    }
  });

  // 🔙 Caller MUST use this inside useEffect cleanup
  return () => {
    supabase.removeChannel(channel);
  };
}