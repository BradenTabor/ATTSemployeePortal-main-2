// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GMAIL_USER = Deno.env.get("GMAIL_USER") ?? "allterraintreeservice.po@gmail.com";
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD") ?? "";

function base64Encode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

async function sendGmail(
  recipients: string[],
  subject: string,
  textBody: string,
  htmlBody: string
): Promise<{ success: boolean; error?: string }> {
  if (!GMAIL_APP_PASSWORD) {
    return { success: false, error: "GMAIL_APP_PASSWORD not configured" };
  }
  if (recipients.length === 0) {
    return { success: false, error: "No recipients" };
  }

  try {
    const boundary = `boundary_${Date.now()}`;
    const toList = recipients.join(", ");
    const rawEmail = [
      `From: ATTS <${GMAIL_USER}>`,
      `To: ${toList}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      ``,
      textBody,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      ``,
      htmlBody,
      ``,
      `--${boundary}--`,
    ].join("\r\n");

    const conn = await Deno.connectTls({ hostname: "smtp.gmail.com", port: 465 });
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    async function send(cmd: string): Promise<string> {
      await conn.write(encoder.encode(cmd + "\r\n"));
      const buf = new Uint8Array(1024);
      const n = await conn.read(buf);
      return decoder.decode(buf.subarray(0, n || 0));
    }
    async function read(): Promise<string> {
      const buf = new Uint8Array(1024);
      const n = await conn.read(buf);
      return decoder.decode(buf.subarray(0, n || 0));
    }

    await read();
    await send("EHLO localhost");
    await send("AUTH LOGIN");
    await send(base64Encode(GMAIL_USER));
    await send(base64Encode(GMAIL_APP_PASSWORD.replace(/\s/g, "")));
    await send(`MAIL FROM:<${GMAIL_USER}>`);
    for (const r of recipients) await send(`RCPT TO:<${r}>`);
    await send("DATA");
    await conn.write(encoder.encode(rawEmail + "\r\n.\r\n"));
    await read();
    await send("QUIT");
    conn.close();
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: appUser, error: appErr } = await client
      .from("app_users")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (appErr || !appUser || appUser.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: Admin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: { listKey?: string } = {};
    try {
      body = (await req.json()) as { listKey?: string };
    } catch {
      /* no body */
    }
    const allowedListKeys = ["compliance_summary", "safety_forecast", "weekly_safety_audit", "certification_expiry_digest", "safety_rewards_winners"] as const;
    const listKey = allowedListKeys.includes(body.listKey as typeof allowedListKeys[number])
      ? (body.listKey as typeof allowedListKeys[number])
      : "compliance_summary";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: rows, error: fetchErr } = await admin
      .from("email_recipient_lists")
      .select("email")
      .eq("list_key", listKey);

    if (fetchErr || !rows?.length) {
      return new Response(
        JSON.stringify({
          success: false,
          error: fetchErr?.message ?? "No recipients configured for this list",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const recipients = rows.map((r: { email: string }) => r.email);
    const subject = `ATTS Test Email – ${listKey.replace("_", " ")}`;
    const textBody = `This is a test email from the ATTS admin Email Recipients tool.\n\nList: ${listKey}\nRecipients: ${recipients.length}\n\nIf you received this, the list is configured correctly.`;
    const htmlBody = `<!DOCTYPE html><html><body style="font-family:sans-serif;"><p>This is a test email from the ATTS admin Email Recipients tool.</p><p><strong>List:</strong> ${listKey}</p><p><strong>Recipients:</strong> ${recipients.length}</p><p>If you received this, the list is configured correctly.</p></body></html>`;

    const result = await sendGmail(recipients, subject, textBody, htmlBody);

    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, count: recipients.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-test-email:", e);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
