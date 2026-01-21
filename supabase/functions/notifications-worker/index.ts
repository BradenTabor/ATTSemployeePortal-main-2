// @ts-nocheck
/**
 * notifications-worker Edge Function
 * 
 * Processes the notification outbox queue and sends Web Push notifications.
 * 
 * This function should be called periodically (e.g., every minute via pg_cron)
 * or triggered after dispatch.
 * 
 * Security:
 * - Requires x-internal-key header matching INTERNAL_SECRET
 * - Uses service role for database operations
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET") || "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@atts.com";

const BATCH_SIZE = 50;
const TIMEOUT_MS = 25000; // 25 seconds (Edge Function has 30s default timeout)

interface NotificationOutbox {
  id: string;
  event_id: string;
  user_id: string;
  title: string;
  body: string | null;
  url: string | null;
  category: string;
  severity: string;
  attempts: number;
  max_attempts: number;
}

interface PushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Web Push implementation using Web Crypto API
async function sendWebPush(
  subscription: PushSubscription,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    // Import the web-push library dynamically
    const webpush = await import("npm:web-push@3");
    
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    await webpush.sendNotification(pushSubscription, payload);
    return { success: true };
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    console.error(`[notifications-worker] Push failed:`, err.message);
    return { 
      success: false, 
      statusCode: err.statusCode,
      error: err.message 
    };
  }
}

Deno.serve(async (req: Request) => {
  const startTime = Date.now();

  // ===========================================
  // Security Gate - Internal calls only
  // ===========================================
  const internalKey = req.headers.get("x-internal-key");
  if (!internalKey || internalKey !== INTERNAL_SECRET) {
    console.error("[notifications-worker] Unauthorized: Invalid internal key");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Check VAPID configuration
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("[notifications-worker] VAPID keys not configured");
    return new Response(
      JSON.stringify({ error: "VAPID keys not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // ===========================================
    // Claim pending notifications atomically
    // ===========================================
    const { data: pending, error: claimError } = await supabase
      .rpc("claim_pending_notifications", { batch_size: BATCH_SIZE });

    if (claimError) {
      console.error("[notifications-worker] Claim error:", claimError);
      return new Response(
        JSON.stringify({ error: claimError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!pending || pending.length === 0) {
      console.log("[notifications-worker] No pending notifications");
      return new Response(
        JSON.stringify({ processed: 0, sent: 0, failed: 0, skipped: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[notifications-worker] Processing ${pending.length} notifications`);

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const notification of pending as NotificationOutbox[]) {
      // Check timeout
      if (Date.now() - startTime > TIMEOUT_MS) {
        console.warn("[notifications-worker] Approaching timeout, exiting early");
        // Reset remaining notifications to pending
        await supabase
          .from("notification_outbox")
          .update({ status: "pending" })
          .eq("status", "processing")
          .eq("id", notification.id);
        break;
      }

      // Get user's active push subscriptions
      const { data: subscriptions, error: subError } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", notification.user_id)
        .is("revoked_at", null);

      if (subError) {
        console.error(`[notifications-worker] Error fetching subscriptions for user ${notification.user_id}:`, subError);
        failed++;
        continue;
      }

      if (!subscriptions || subscriptions.length === 0) {
        // No subscriptions - mark as skipped
        await supabase
          .from("notification_outbox")
          .update({ 
            status: "skipped", 
            processed_at: new Date().toISOString(),
            last_error: "No active push subscriptions"
          })
          .eq("id", notification.id);
        skipped++;
        console.log(`[notifications-worker] Skipped notification ${notification.id}: No subscriptions`);
        continue;
      }

      // Build push payload
      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        url: notification.url,
        data: {
          notificationId: notification.id,
          category: notification.category,
          severity: notification.severity,
        },
      });

      // Send to all active devices
      let deviceSuccess = false;

      for (const sub of subscriptions as PushSubscription[]) {
        const result = await sendWebPush(
          sub,
          payload,
          VAPID_PUBLIC_KEY,
          VAPID_PRIVATE_KEY,
          VAPID_SUBJECT
        );

        if (result.success) {
          deviceSuccess = true;
        } else {
          console.error(`[notifications-worker] Push failed for subscription ${sub.id}:`, result.error);

          // Revoke subscription on 404/410 (subscription expired or invalid)
          if (result.statusCode === 404 || result.statusCode === 410) {
            await supabase
              .from("push_subscriptions")
              .update({ revoked_at: new Date().toISOString() })
              .eq("id", sub.id);
            console.log(`[notifications-worker] Revoked expired subscription ${sub.id}`);
          }
        }
      }

      // Update notification status
      if (deviceSuccess) {
        await supabase
          .from("notification_outbox")
          .update({ 
            status: "sent", 
            processed_at: new Date().toISOString() 
          })
          .eq("id", notification.id);
        sent++;
      } else {
        // All devices failed - increment attempts
        const newAttempts = notification.attempts + 1;
        const newStatus = newAttempts >= notification.max_attempts ? "failed" : "pending";

        await supabase
          .from("notification_outbox")
          .update({
            status: newStatus,
            attempts: newAttempts,
            last_error: "All push subscriptions failed",
            processed_at: newStatus === "failed" ? new Date().toISOString() : null,
          })
          .eq("id", notification.id);

        failed++;
      }
    }

    console.log(`[notifications-worker] Complete: sent=${sent}, failed=${failed}, skipped=${skipped}`);

    return new Response(
      JSON.stringify({ 
        processed: pending.length, 
        sent, 
        failed, 
        skipped,
        duration_ms: Date.now() - startTime,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[notifications-worker] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

