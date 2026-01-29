// @ts-nocheck
/**
 * notifications-dispatch Edge Function
 * 
 * INTERNAL ONLY - This function should NEVER be called directly from the frontend.
 * 
 * Purpose:
 * - Resolve recipients based on event target_type
 * - Check user notification preferences
 * - Create entries in notification_outbox for worker processing
 * 
 * Security:
 * - Requires x-internal-key header matching INTERNAL_SECRET
 * - Only called server-to-server from admin-create-notification
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET") || "";

interface DispatchRequest {
  event_id: string;
}

interface DispatchResponse {
  event_id: string;
  dispatched: number;
  skipped: number;
}

interface NotificationEvent {
  id: string;
  category: string;
  severity: string;
  target_type: string;
  target_ref: string | null;
  title: string;
  body: string | null;
  url: string | null;
}

interface UserPreference {
  push_enabled: boolean;
  sms_enabled: boolean;
  quiet_hours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  } | null;
}

Deno.serve(async (req: Request) => {
  // ===========================================
  // SECURITY GATE - Internal calls only
  // ===========================================
  const internalKey = req.headers.get("x-internal-key");
  
  if (!internalKey || internalKey !== INTERNAL_SECRET) {
    console.error("[notifications-dispatch] Unauthorized: Invalid or missing internal key");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { event_id }: DispatchRequest = await req.json();

    if (!event_id) {
      console.error("[notifications-dispatch] Missing event_id in request");
      return new Response(
        JSON.stringify({ error: "Missing event_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[notifications-dispatch] Processing event: ${event_id}`);

    // Create service role client for full database access
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ===========================================
    // Step 1: Load the notification event
    // ===========================================
    const { data: event, error: eventError } = await supabase
      .from("notification_events")
      .select("*")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      console.error(`[notifications-dispatch] Event not found: ${event_id}`, eventError);
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const typedEvent = event as NotificationEvent;
    console.log(`[notifications-dispatch] Event loaded:`, {
      id: typedEvent.id,
      category: typedEvent.category,
      target_type: typedEvent.target_type,
      target_ref: typedEvent.target_ref,
    });

    // ===========================================
    // Step 2: Resolve recipients based on target_type
    // ===========================================
    let userIds: string[] = [];

    switch (typedEvent.target_type) {
      case "all": {
        const { data, error } = await supabase
          .from("app_users")
          .select("user_id");
        
        if (error) {
          console.error("[notifications-dispatch] Failed to fetch all users:", error);
          throw new Error("Failed to resolve recipients");
        }
        
        userIds = data?.map((u) => u.user_id).filter(Boolean) || [];
        console.log(`[notifications-dispatch] Targeting all users: ${userIds.length} found`);
        break;
      }

      case "role": {
        if (!typedEvent.target_ref) {
          console.warn("[notifications-dispatch] target_type=role but no target_ref provided");
          break;
        }

        const { data, error } = await supabase
          .from("app_users")
          .select("user_id")
          .eq("role", typedEvent.target_ref);
        
        if (error) {
          console.error("[notifications-dispatch] Failed to fetch users by role:", error);
          throw new Error("Failed to resolve recipients");
        }
        
        userIds = data?.map((u) => u.user_id).filter(Boolean) || [];
        console.log(`[notifications-dispatch] Targeting role '${typedEvent.target_ref}': ${userIds.length} found`);
        break;
      }

      case "crew": {
        if (!typedEvent.target_ref) {
          console.warn("[notifications-dispatch] target_type=crew but no target_ref (job_id) provided");
          break;
        }

        const { data, error } = await supabase
          .from("job_crew_assignments")
          .select("user_id")
          .eq("job_id", typedEvent.target_ref);
        
        if (error) {
          console.error("[notifications-dispatch] Failed to fetch crew assignments:", error);
          throw new Error("Failed to resolve recipients");
        }
        
        userIds = data?.map((u) => u.user_id).filter(Boolean) || [];
        console.log(`[notifications-dispatch] Targeting crew for job '${typedEvent.target_ref}': ${userIds.length} found`);
        break;
      }

      case "user": {
        if (!typedEvent.target_ref) {
          console.warn("[notifications-dispatch] target_type=user but no target_ref (user_id) provided");
          break;
        }

        userIds = [typedEvent.target_ref];
        console.log(`[notifications-dispatch] Targeting single user: ${typedEvent.target_ref}`);
        break;
      }

      default:
        console.warn(`[notifications-dispatch] Unknown target_type: ${typedEvent.target_type}`);
    }

    if (userIds.length === 0) {
      console.log(`[notifications-dispatch] No recipients found for event ${event_id}`);
      return new Response(
        JSON.stringify({ event_id, dispatched: 0, skipped: 0 } as DispatchResponse),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build preferred_language map for per-user localization (Phase 2)
    const { data: langRows } = await supabase
      .from("app_users")
      .select("user_id, preferred_language")
      .in("user_id", userIds);
    const preferredLangByUser = new Map<string, string>();
    (langRows || []).forEach((r: { user_id: string; preferred_language?: string | null }) => {
      preferredLangByUser.set(r.user_id, r.preferred_language || "en");
    });

    // ===========================================
    // Step 3: Check preferences and create outbox entries
    // ===========================================
    let dispatched = 0;
    let skipped = 0;

    for (const userId of userIds) {
      // Load user's preference for this category
      const { data: pref } = await supabase
        .from("notification_preferences")
        .select("push_enabled, sms_enabled, quiet_hours")
        .eq("user_id", userId)
        .eq("category", typedEvent.category)
        .single();

      const typedPref = pref as UserPreference | null;

      // Skip if user has disabled push for this category
      if (typedPref && typedPref.push_enabled === false) {
        console.log(`[notifications-dispatch] Skipping user ${userId}: push disabled for ${typedEvent.category}`);
        skipped++;
        continue;
      }

      // Per-user language: use Spanish content when user prefers es and event has title_es/body_es (Phase 2)
      const lang = preferredLangByUser.get(userId) || "en";
      const useSpanish = lang === "es" && typedEvent.title_es != null && typedEvent.body_es != null;
      const title = useSpanish ? typedEvent.title_es : typedEvent.title;
      const body = useSpanish ? typedEvent.body_es : typedEvent.body;

      // Calculate scheduled time (basic implementation - could expand for quiet hours)
      let scheduledFor = new Date();
      
      // TODO: Implement timezone-aware quiet hours logic
      // if (typedPref?.quiet_hours?.enabled) {
      //   scheduledFor = calculateNextAvailableTime(typedPref.quiet_hours);
      // }

      // Generate dedupe key to prevent duplicate notifications
      const dedupeKey = `event:${event_id}:user:${userId}`;

      // Insert into outbox (ON CONFLICT DO NOTHING handles deduplication)
      const { error: insertError } = await supabase
        .from("notification_outbox")
        .insert({
          event_id,
          user_id: userId,
          category: typedEvent.category,
          severity: typedEvent.severity,
          push_enabled: typedPref?.push_enabled !== false,
          sms_enabled: typedPref?.sms_enabled === true,
          title: typedEvent.title,
          body: typedEvent.body,
          url: typedEvent.url,
          dedupe_key: dedupeKey,
          scheduled_for: scheduledFor.toISOString(),
        });

      if (insertError) {
        // Check if it's a duplicate key error (expected for deduplication)
        if (insertError.code === "23505") {
          console.log(`[notifications-dispatch] Duplicate skipped for user ${userId}`);
          skipped++;
        } else {
          console.error(`[notifications-dispatch] Failed to insert outbox entry for user ${userId}:`, insertError);
          skipped++;
        }
      } else {
        dispatched++;
      }
    }

    console.log(`[notifications-dispatch] Event ${event_id} complete: dispatched=${dispatched}, skipped=${skipped}`);

    const response: DispatchResponse = { event_id, dispatched, skipped };
    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[notifications-dispatch] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

