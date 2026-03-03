// @ts-nocheck
/**
 * Shared Gmail SMTP helper for Edge Functions (admin-compliance-cron,
 * weekly-safety-audit-report, cert-expiry-reminders). Use this module instead
 * of copying sendGmailEmail into each function.
 */

function base64Encode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

export interface SendGmailConfig {
  gmailUser: string;
  gmailAppPassword: string;
  fromLabel?: string;
}

/**
 * Send a multipart (text + HTML) email via Gmail SMTP.
 * Callers must pass credentials (e.g. from Deno.env.get('GMAIL_USER')).
 */
export async function sendGmailEmail(
  recipients: string[],
  subject: string,
  textBody: string,
  htmlBody: string,
  config: SendGmailConfig
): Promise<{ success: boolean; error?: string }> {
  const { gmailUser, gmailAppPassword, fromLabel = "ATTS" } = config;
  if (!gmailAppPassword) {
    console.error("[gmail] GMAIL_APP_PASSWORD not configured");
    return { success: false, error: "GMAIL_APP_PASSWORD not configured" };
  }
  if (recipients.length === 0) {
    return { success: false, error: "No recipients" };
  }

  try {
    const boundary = `boundary_${Date.now()}`;
    const toList = recipients.join(", ");
    const rawEmail = [
      `From: ${fromLabel} <${gmailUser}>`,
      `To: ${toList}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      "",
      textBody,
      "",
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      "",
      htmlBody,
      "",
      `--${boundary}--`,
    ].join("\r\n");

    const conn = await Deno.connectTls({ hostname: "smtp.gmail.com", port: 465 });
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    async function sendCommand(cmd: string): Promise<string> {
      await conn.write(encoder.encode(cmd + "\r\n"));
      const buf = new Uint8Array(1024);
      const n = await conn.read(buf);
      return decoder.decode(buf.subarray(0, n || 0));
    }
    async function readResponse(): Promise<string> {
      const buf = new Uint8Array(1024);
      const n = await conn.read(buf);
      return decoder.decode(buf.subarray(0, n || 0));
    }

    await readResponse();
    await sendCommand("EHLO localhost");
    await sendCommand("AUTH LOGIN");
    await sendCommand(base64Encode(gmailUser));
    const cleanPassword = gmailAppPassword.replace(/\s/g, "");
    let response = await sendCommand(base64Encode(cleanPassword));
    if (!response.includes("235")) {
      conn.close();
      return { success: false, error: "Authentication failed: " + response };
    }

    await sendCommand(`MAIL FROM:<${gmailUser}>`);
    for (const recipient of recipients) {
      await sendCommand(`RCPT TO:<${recipient}>`);
    }
    await sendCommand("DATA");
    await conn.write(encoder.encode(rawEmail + "\r\n.\r\n"));
    await readResponse();
    await sendCommand("QUIT");
    conn.close();

    console.log("[gmail] Sent to", recipients.length, "recipients");
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[gmail] Failed to send:", errorMsg);
    return { success: false, error: errorMsg };
  }
}
