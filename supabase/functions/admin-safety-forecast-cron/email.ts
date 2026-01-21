/**
 * Email generation and sending via Gmail SMTP
 */

import { RiskScore, SiteRiskData } from './types.ts';
import { formatDateLong, getRiskLevelEmoji, getRiskLevelColor, getRiskLevelBgColor } from './utils.ts';

// =============================================================================
// EMAIL GENERATION
// =============================================================================

export function generateForecastEmail(
  dateFor: string,
  overallRisk: RiskScore,
  sites: SiteRiskData[],
  companyFactors: string[],
  hasWeatherError: boolean,
  timezone: string
): { subject: string; textBody: string; htmlBody: string } {
  const dateLong = formatDateLong(dateFor);
  const emoji = getRiskLevelEmoji(overallRisk.level);
  const levelColor = getRiskLevelColor(overallRisk.level);
  const levelBgColor = getRiskLevelBgColor(overallRisk.level);
  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const subject = `${emoji} ${overallRisk.level} Risk Safety Forecast - ${dateFor}`;

  // Plain text
  let textBody = `${emoji} SAFETY FORECAST - ${dateLong}\n${'═'.repeat(50)}\n\n`;
  textBody += `TODAY'S OVERALL RISK: ${overallRisk.total.toFixed(1)} / 5.0 (${overallRisk.level})\n\n`;
  
  if (hasWeatherError) {
    textBody += `⚠️ WEATHER NOTICE: Unable to retrieve weather data for some sites.\n`;
    textBody += `   Please check local weather conditions before dispatching crews.\n\n`;
  }

  if (overallRisk.drivers.length > 0) {
    textBody += `TOP RISK DRIVERS:\n`;
    for (const d of overallRisk.drivers) textBody += `  • ${d}\n`;
    textBody += `\n`;
  }

  if (overallRisk.recommendations.length > 0) {
    textBody += `RECOMMENDED ACTIONS:\n`;
    for (const r of overallRisk.recommendations) textBody += `  • ${r}\n`;
    textBody += `\n`;
  }

  textBody += `${'─'.repeat(50)}\nSITE-BY-SITE BREAKDOWN\n${'─'.repeat(50)}\n\n`;

  for (const site of sites) {
    const siteEmoji = getRiskLevelEmoji(site.riskScore.level);
    textBody += `${siteEmoji} ${site.site.name}${site.site.region ? ` (${site.site.region})` : ''}\n`;
    textBody += `   Risk: ${site.riskScore.level} (${site.riskScore.total.toFixed(1)})\n`;
    
    // Weather display with better messaging
    const isWeatherUnavailable = site.weather.conditions.includes('unavailable') || site.weather.conditions.includes('error');
    if (isWeatherUnavailable) {
      textBody += `   Weather: Data unavailable - check local conditions\n`;
    } else {
      textBody += `   Weather: ${site.weather.conditions}, Wind ${site.weather.windGust}mph, Heat Index ${site.weather.heatIndex}°F\n`;
    }
    
    // Crew display with better messaging
    if (!site.crew.hasActiveJobs && site.crew.totalCount === 0) {
      textBody += `   Crew: No active jobs assigned to this site\n`;
    } else if (site.crew.totalCount === 0) {
      textBody += `   Crew: No crew assigned\n`;
    } else {
      const crewLabel = site.crew.crewName ? `${site.crew.crewName}: ` : '';
      textBody += `   Crew: ${crewLabel}${site.crew.totalCount} members`;
      if (site.crew.newHireCount > 0) {
        textBody += `, ${site.crew.newHireCount} new hire(s)`;
      }
      textBody += `\n`;
    }
    
    if (site.defects.length > 0) {
      textBody += `   Defects: ${site.defects.slice(0, 2).join(', ')}\n`;
    }
    textBody += `\n`;
  }

  if (companyFactors.length > 0) {
    textBody += `COMPANY-WIDE FACTORS:\n`;
    for (const f of companyFactors) textBody += `  • ${f}\n`;
  }

  textBody += `\n${'═'.repeat(50)}\nGenerated at ${timestamp}\n`;

  // HTML generation
  let sitesHtml = '';
  for (const site of sites) {
    const siteColor = getRiskLevelColor(site.riskScore.level);
    const siteBg = getRiskLevelBgColor(site.riskScore.level);
    const siteEmoji = getRiskLevelEmoji(site.riskScore.level);
    
    // Weather display with better messaging
    const isWeatherUnavailable = site.weather.conditions.includes('unavailable') || site.weather.conditions.includes('error');
    const weatherHtml = isWeatherUnavailable
      ? `<span style="color:#92400e;">Data unavailable - check local conditions</span>`
      : `${site.weather.conditions}, Wind ${site.weather.windGust}mph, Heat Index ${site.weather.heatIndex}°F`;
    
    // Crew display with better messaging
    let crewHtml: string;
    if (!site.crew.hasActiveJobs && site.crew.totalCount === 0) {
      crewHtml = `<span style="color:#6b7280;font-style:italic;">No active jobs assigned to this site</span>`;
    } else if (site.crew.totalCount === 0) {
      crewHtml = `<span style="color:#f59e0b;">No crew assigned</span>`;
    } else {
      const crewLabel = site.crew.crewName ? `<strong>${site.crew.crewName}:</strong> ` : '';
      crewHtml = `${crewLabel}${site.crew.totalCount} members`;
      if (site.crew.newHireCount > 0) {
        crewHtml += `, <span style="color:#f59e0b;">${site.crew.newHireCount} new hire(s)</span>`;
      }
      if (site.crew.hasExpert) {
        crewHtml += `, <span style="color:#22c55e;">Expert on crew</span>`;
      }
    }
    
    sitesHtml += `
      <div style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <div style="background:${siteBg};padding:12px 16px;border-bottom:1px solid #e5e7eb;">
          <strong>${siteEmoji} ${site.site.name}${site.site.region ? ` (${site.site.region})` : ''}</strong>
          <span style="float:right;background:${siteColor};color:white;padding:4px 12px;border-radius:12px;font-size:12px;">
            ${site.riskScore.level} (${site.riskScore.total.toFixed(1)})
          </span>
        </div>
        <div style="padding:12px 16px;font-size:13px;">
          <p style="margin:0 0 8px 0;"><strong>Weather:</strong> ${weatherHtml}</p>
          <p style="margin:0 0 8px 0;"><strong>Crew:</strong> ${crewHtml}</p>
          ${site.defects.length > 0 ? `<p style="margin:0;color:#dc2626;"><strong>Defects:</strong> ${site.defects.slice(0, 3).join(', ')}</p>` : ''}
        </div>
      </div>`;
  }

  const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1f2937;">
  <div style="background:linear-gradient(135deg,#1e293b,#334155);color:white;padding:24px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;font-size:20px;">${emoji} Safety Forecast</h1>
    <p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">${dateLong}</p>
  </div>
  <div style="padding:20px;border:1px solid #e5e7eb;border-top:none;">
    <div style="background:${levelBgColor};border:2px solid ${levelColor};border-radius:8px;padding:20px;text-align:center;margin-bottom:20px;">
      <p style="margin:0 0 8px;color:#374151;font-size:12px;font-weight:600;text-transform:uppercase;">Today's Overall Risk</p>
      <p style="margin:0;color:${levelColor};font-size:32px;font-weight:800;">${overallRisk.total.toFixed(1)} / 5.0</p>
      <p style="margin:8px 0 0;color:${levelColor};font-size:18px;font-weight:700;">${overallRisk.level}</p>
    </div>
    ${hasWeatherError ? '<p style="background:#fef3c7;padding:12px;border-radius:4px;border-left:4px solid #f59e0b;color:#92400e;font-size:13px;"><strong>⚠️ Weather Notice:</strong> Unable to retrieve weather data for some sites. Please check local weather conditions before dispatching crews.</p>' : ''}
    ${overallRisk.drivers.length > 0 ? `
      <h3 style="margin:0 0 12px;font-size:14px;">📊 Top Risk Drivers</h3>
      <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:1.6;">
        ${overallRisk.drivers.map(d => `<li>${d}</li>`).join('')}
      </ul>` : ''}
    ${overallRisk.recommendations.length > 0 ? `
      <h3 style="margin:0 0 12px;font-size:14px;">✅ Recommended Actions</h3>
      <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:1.6;">
        ${overallRisk.recommendations.map(r => `<li>${r}</li>`).join('')}
      </ul>` : ''}
    <h3 style="margin:0 0 16px;font-size:14px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">📍 Site-by-Site Breakdown</h3>
    ${sites.length > 0 ? sitesHtml : '<p style="text-align:center;color:#6b7280;">No active work sites scheduled for today.</p>'}
    ${companyFactors.length > 0 ? `
      <h3 style="margin:20px 0 12px;font-size:14px;border-top:2px solid #e5e7eb;padding-top:16px;">🏢 Company-Wide Factors</h3>
      <ul style="margin:0;padding-left:20px;font-size:14px;">
        ${companyFactors.map(f => `<li>${f}</li>`).join('')}
      </ul>` : ''}
  </div>
  <div style="background:#f9fafb;padding:16px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
      Generated at ${timestamp} | ATTS Safety Management System
    </p>
  </div>
</body></html>`;

  return { subject, textBody, htmlBody };
}

// =============================================================================
// EMAIL SENDING VIA GMAIL SMTP
// =============================================================================

function base64Encode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

export async function sendGmailEmail(
  subject: string,
  textBody: string,
  htmlBody: string,
  gmailUser: string,
  gmailPassword: string,
  recipients: string[]
): Promise<{ success: boolean; error?: string }> {
  if (!gmailPassword) {
    console.error('[Email] GMAIL_APP_PASSWORD not configured');
    return { success: false, error: 'GMAIL_APP_PASSWORD not configured' };
  }

  try {
    const boundary = `boundary_${Date.now()}`;
    const toList = recipients.join(', ');
    
    const rawEmail = [
      `From: ATTS Safety Forecast <${gmailUser}>`,
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
    ].join('\r\n');

    const conn = await Deno.connectTls({
      hostname: 'smtp.gmail.com',
      port: 465,
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    async function sendCommand(cmd: string): Promise<string> {
      await conn.write(encoder.encode(cmd + '\r\n'));
      const buf = new Uint8Array(1024);
      const n = await conn.read(buf);
      return decoder.decode(buf.subarray(0, n || 0));
    }

    async function readResponse(): Promise<string> {
      const buf = new Uint8Array(1024);
      const n = await conn.read(buf);
      return decoder.decode(buf.subarray(0, n || 0));
    }

    let response = await readResponse();
    response = await sendCommand('EHLO localhost');
    response = await sendCommand('AUTH LOGIN');
    response = await sendCommand(base64Encode(gmailUser));
    const cleanPassword = gmailPassword.replace(/\s/g, '');
    response = await sendCommand(base64Encode(cleanPassword));

    if (!response.includes('235')) {
      conn.close();
      return { success: false, error: 'Authentication failed' };
    }

    response = await sendCommand(`MAIL FROM:<${gmailUser}>`);
    for (const recipient of recipients) {
      await sendCommand(`RCPT TO:<${recipient}>`);
    }
    await sendCommand('DATA');
    await conn.write(encoder.encode(rawEmail + '\r\n.\r\n'));
    await readResponse();
    await sendCommand('QUIT');
    conn.close();

    console.log('[Email] Sent to', recipients.length, 'recipients');
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Email] Failed:', errorMsg);
    return { success: false, error: errorMsg };
  }
}
