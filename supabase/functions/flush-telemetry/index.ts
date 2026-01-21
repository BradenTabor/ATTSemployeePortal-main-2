// @ts-nocheck
/**
 * flush-telemetry Edge Function
 *
 * Receives telemetry events from sendBeacon on page unload.
 * Inserts events using service_role to bypass RLS (since sendBeacon
 * cannot include auth headers).
 *
 * Security:
 * - No authentication required (sendBeacon limitation)
 * - Validates event structure before insert
 * - Rate limiting via Supabase Edge Function defaults
 * - Events are validated against allowed event names
 *
 * @see docs/Telemetry_plan.md for full documentation
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ============================================================================
// CORS HEADERS
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ============================================================================
// TYPES
// ============================================================================

interface TelemetryEvent {
  user_id: string | null;
  session_id: string;
  event_name: string;
  properties: Record<string, unknown>;
  route: string;
  form_type?: string | null;
}

interface FlushRequest {
  events: TelemetryEvent[];
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Allowed event names (must match database CHECK constraint)
 */
const ALLOWED_EVENT_NAMES = new Set([
  'form_started',
  'form_submitted',
  'form_submit_error',
  'announcement_viewed',
  'form_duplicate_detected',
  'form_duplicate_prevented',
  'form_duplicate_overridden',
]);

/**
 * Allowed form types (must match database CHECK constraint)
 */
const ALLOWED_FORM_TYPES = new Set([
  'dvir',
  'equipment',
  'rto',
  'jsa',
  null,
  undefined,
]);

/**
 * Validate a single telemetry event.
 */
function isValidEvent(event: unknown): event is TelemetryEvent {
  if (!event || typeof event !== 'object') {
    return false;
  }

  const e = event as Record<string, unknown>;

  // Required fields
  if (typeof e.session_id !== 'string' || e.session_id.length === 0) {
    return false;
  }

  if (typeof e.event_name !== 'string' || !ALLOWED_EVENT_NAMES.has(e.event_name)) {
    return false;
  }

  // Optional fields with type validation
  if (e.user_id !== null && typeof e.user_id !== 'string') {
    return false;
  }

  if (e.properties !== undefined && (typeof e.properties !== 'object' || e.properties === null)) {
    return false;
  }

  if (e.route !== undefined && typeof e.route !== 'string') {
    return false;
  }

  if (e.form_type !== undefined && e.form_type !== null) {
    if (typeof e.form_type !== 'string' || !ALLOWED_FORM_TYPES.has(e.form_type)) {
      return false;
    }
  }

  return true;
}

/**
 * Sanitize event properties to prevent injection.
 */
function sanitizeEvent(event: TelemetryEvent): TelemetryEvent {
  return {
    user_id: event.user_id,
    session_id: event.session_id.slice(0, 100), // Limit length
    event_name: event.event_name,
    properties: event.properties || {},
    route: (event.route || '').slice(0, 500), // Limit length
    form_type: event.form_type || null,
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Parse request body
    let body: FlushRequest;
    try {
      body = await req.json();
    } catch {
      console.error("[flush-telemetry] Invalid JSON body");
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate events array
    if (!body.events || !Array.isArray(body.events)) {
      console.error("[flush-telemetry] Missing or invalid events array");
      return new Response(
        JSON.stringify({ error: "Missing events array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit batch size to prevent abuse
    const MAX_BATCH_SIZE = 100;
    if (body.events.length > MAX_BATCH_SIZE) {
      console.warn(`[flush-telemetry] Batch too large: ${body.events.length}, truncating to ${MAX_BATCH_SIZE}`);
      body.events = body.events.slice(0, MAX_BATCH_SIZE);
    }

    // Validate and sanitize each event
    const validEvents: TelemetryEvent[] = [];
    for (const event of body.events) {
      if (isValidEvent(event)) {
        validEvents.push(sanitizeEvent(event));
      } else {
        console.warn("[flush-telemetry] Invalid event skipped:", JSON.stringify(event).slice(0, 200));
      }
    }

    if (validEvents.length === 0) {
      console.warn("[flush-telemetry] No valid events to insert");
      return new Response(
        JSON.stringify({ success: true, inserted: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create service role client (bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Insert events
    const { error: insertError } = await supabase
      .from("telemetry_events")
      .insert(validEvents);

    if (insertError) {
      console.error("[flush-telemetry] Insert error:", insertError.message);
      return new Response(
        JSON.stringify({ error: "Failed to insert events" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[flush-telemetry] Inserted ${validEvents.length} events`);

    return new Response(
      JSON.stringify({ success: true, inserted: validEvents.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[flush-telemetry] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
