// @ts-nocheck
/**
 * Builds HTML and plain-text body for the monthly compliance executive summary email.
 * Used by monthly-compliance-summary Edge Function. Table-based layout for email clients.
 */

export interface SmsTierSummary {
  count: number;
  cost: number;
}

export interface SmsSectionData {
  totalSent: number;
  totalCost: number;
  byTier: Record<0 | 1 | 2, SmsTierSummary>;
  errorCount: number;
  prevMonthSent: number | null;
  prevMonthCost: number | null;
}

export interface ComplianceSectionData {
  monthlyAvgRate: number | null;
  prevMonthAvgRate: number | null;
  bestDay: { date: string; rate: number } | null;
  worstDay: { date: string; rate: number } | null;
  weekBreakdown: { weekLabel: string; rate: number }[];
  hasAnyBriefingDays: boolean;
}

export interface CrewRankingRow {
  name: string;
  rate: number;
  below80: boolean;
}

export interface RepeatOffenderRow {
  name: string;
  crew: string;
  misses: number;
  supervisorName: string;
}

export interface IncidentsSectionData {
  total: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  highRiskNearMissCount: number;
}

export interface DataQualitySectionData {
  noPhoneCount: number;
  noManagerCount: number;
  managerNoPhoneCount: number;
  prevNoPhone: number | null;
  prevNoManager: number | null;
  prevManagerNoPhone: number | null;
}

export interface MonthlyReportData {
  monthLabel: string;
  monthDisplay: string;
  year: number;
  sms: SmsSectionData;
  compliance: ComplianceSectionData;
  crews: CrewRankingRow[];
  repeatOffenders: RepeatOffenderRow[];
  incidents: IncidentsSectionData;
  dataQuality: DataQualitySectionData;
  noBriefingsInMonth: boolean;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rateColor(rate: number): string {
  if (rate >= 90) return "#27ae60";
  if (rate >= 80) return "#f39c12";
  return "#e74c3c";
}

function formatRate(rate: number | null): string {
  if (rate == null) return "N/A";
  return `${Number(rate).toFixed(1)}%`;
}

function formatCurrency(c: number): string {
  return `$${Number(c).toFixed(2)}`;
}

export function buildMonthlyReportHtml(data: MonthlyReportData): {
  subject: string;
  textBody: string;
  htmlBody: string;
} {
  const { monthDisplay, year, sms, compliance, crews, repeatOffenders, incidents, dataQuality, noBriefingsInMonth } =
    data;
  const overallRate = compliance.monthlyAvgRate ?? 0;
  const subject = `Safety Compliance Report — ${monthDisplay} ${year} — ${formatRate(compliance.monthlyAvgRate)} Compliance`;

  // ---- Plain text ----
  let text = `MONTHLY SAFETY COMPLIANCE REPORT — ${monthDisplay} ${year}\n`;
  text += `${"=".repeat(50)}\n\n`;

  text += `1. SMS VOLUME AND COST\n`;
  text += `------------------------\n`;
  text += `Total SMS sent: ${sms.totalSent} | Total cost: ${formatCurrency(sms.totalCost)}\n`;
  text += `Tier 0: ${sms.byTier[0].count} SMS (${formatCurrency(sms.byTier[0].cost)}) | Tier 1: ${sms.byTier[1].count} (${formatCurrency(sms.byTier[1].cost)}) | Tier 2: ${sms.byTier[2].count} (${formatCurrency(sms.byTier[2].cost)})\n`;
  if (sms.errorCount > 0) text += `Send errors: ${sms.errorCount}\n`;
  if (sms.prevMonthSent != null && sms.prevMonthCost != null) {
    const pct = sms.prevMonthSent > 0 ? (((sms.totalSent - sms.prevMonthSent) / sms.prevMonthSent) * 100).toFixed(1) : "N/A";
    text += `vs prior month: ${sms.prevMonthSent} SMS (${formatCurrency(sms.prevMonthCost)}) — ${pct}%\n`;
  } else {
    text += `vs prior month: N/A (no prior data)\n`;
  }
  text += `\n`;

  if (!noBriefingsInMonth) {
    text += `2. OVERALL COMPLIANCE RATE\n`;
    text += `---------------------------\n`;
    text += `Monthly average: ${formatRate(compliance.monthlyAvgRate)}\n`;
    if (compliance.prevMonthAvgRate != null) {
      text += `vs prior month: ${formatRate(compliance.prevMonthAvgRate)}\n`;
    } else {
      text += `vs prior month: N/A\n`;
    }
    if (compliance.bestDay) text += `Best day: ${compliance.bestDay.date} (${formatRate(compliance.bestDay.rate)})\n`;
    if (compliance.worstDay) text += `Worst day: ${compliance.worstDay.date} (${formatRate(compliance.worstDay.rate)})\n`;
    if (compliance.weekBreakdown.length > 0) {
      text += `By week: `;
      text += compliance.weekBreakdown.map((w) => `${w.weekLabel}: ${formatRate(w.rate)}`).join(" | ");
      text += `\n`;
    }
    text += `\n`;

    text += `3. CREW-LEVEL COMPLIANCE RANKING\n`;
    text += `---------------------------------\n`;
    crews.slice(0, 15).forEach((c, i) => {
      text += `  ${i + 1}. ${c.name} ............. ${formatRate(c.rate)}${c.below80 ? " (below 80%)" : ""}\n`;
    });
    const below80Crews = crews.filter((c) => c.below80);
    if (below80Crews.length > 0) {
      text += `  WARNING: ${below80Crews.length} crew(s) below 80%: ${below80Crews.map((c) => c.name).join(", ")}\n`;
    }
    text += `\n`;

    text += `4. REPEAT OFFENDERS (3+ unexcused misses)\n`;
    text += `----------------------------------------\n`;
    if (repeatOffenders.length === 0) {
      text += `  None.\n`;
    } else {
      text += `  Name                  Crew           Misses  Supervisor\n`;
      repeatOffenders.forEach((r) => {
        text += `  ${r.name.padEnd(22)} ${r.crew.padEnd(14)} ${String(r.misses).padStart(6)}  ${r.supervisorName}\n`;
      });
    }
    text += `\n`;
  } else {
    text += `No safety briefings were scheduled in ${monthDisplay} ${year}.\n\n`;
  }

  text += `5. SAFETY INCIDENTS\n`;
  text += `--------------------\n`;
  text += `Total: ${incidents.total}\n`;
  const sevEntries = Object.entries(incidents.bySeverity).filter(([, n]) => n > 0);
  if (sevEntries.length > 0) {
    text += `By severity: ${sevEntries.map(([k, v]) => `${k}: ${v}`).join(", ")}\n`;
  }
  const typeEntries = Object.entries(incidents.byType).filter(([, n]) => n > 0);
  if (typeEntries.length > 0) {
    text += `By type: ${typeEntries.map(([k, v]) => `${k}: ${v}`).join(", ")}\n`;
  }
  if (incidents.highRiskNearMissCount > 0) {
    text += `High-risk near-misses (electrical/fall/struck_by): ${incidents.highRiskNearMissCount}\n`;
  }
  text += `\n`;

  text += `6. DATA QUALITY\n`;
  text += `---------------\n`;
  text += `Active field users with no phone: ${dataQuality.noPhoneCount}\n`;
  text += `Active field users with no manager: ${dataQuality.noManagerCount}\n`;
  text += `Managers with no phone: ${dataQuality.managerNoPhoneCount}\n`;
  if (
    dataQuality.prevNoPhone != null ||
    dataQuality.prevNoManager != null ||
    dataQuality.prevManagerNoPhone != null
  ) {
    text += `(Prior month: no phone ${dataQuality.prevNoPhone ?? "N/A"}, no manager ${dataQuality.prevNoManager ?? "N/A"}, manager no phone ${dataQuality.prevManagerNoPhone ?? "N/A"})\n`;
  }
  text += `\n---\nATTS Safety Compliance System\n`;

  // ---- HTML ----
  const tableCell = (content: string, style = "") =>
    `<td style="padding:8px;border:1px solid #e5e7eb;${style}">${content}</td>`;
  const th = (content: string) =>
    `<th style="padding:8px;border:1px solid #e5e7eb;text-align:left;background:#f3f4f6;">${content}</th>`;

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937;max-width:620px;margin:0 auto;padding:16px;">`;
  html += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:620px;">`;
  html += `<tr><td style="background:linear-gradient(135deg,#166534 0%,#15803d 100%);color:white;padding:20px;text-align:center;font-size:18px;font-weight:bold;">Monthly Safety Compliance Report — ${escapeHtml(monthDisplay)} ${year}</td></tr>`;
  html += `<tr><td style="padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;">`;
  html += `<p style="margin:0;"><strong>Report period:</strong> ${escapeHtml(monthDisplay)} ${year}</p>`;
  html += `</td></tr>`;

  // Section 1: SMS
  html += `<tr><td style="padding:16px;border:1px solid #e5e7eb;border-top:none;"><h2 style="margin:0 0 8px 0;font-size:16px;border-bottom:2px solid #e5e7eb;padding-bottom:6px;">1. SMS Volume and Cost</h2>`;
  html += `<p style="margin:0 0 12px 0;color:#6b7280;">Summary of escalation SMS sends and cost for the month.</p>`;
  html += `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">`;
  html += `<tr>${th("Metric")}${th("Value")}</tr>`;
  html += `<tr>${tableCell("Total SMS sent")}${tableCell(String(sms.totalSent))}</tr>`;
  html += `<tr>${tableCell("Total cost")}${tableCell(formatCurrency(sms.totalCost))}</tr>`;
  html += `<tr>${tableCell("Tier 0 (reminder)")}${tableCell(`${sms.byTier[0].count} SMS, ${formatCurrency(sms.byTier[0].cost)}`)}</tr>`;
  html += `<tr>${tableCell("Tier 1 (supervisor)")}${tableCell(`${sms.byTier[1].count} SMS, ${formatCurrency(sms.byTier[1].cost)}`)}</tr>`;
  html += `<tr>${tableCell("Tier 2 (escalation)")}${tableCell(`${sms.byTier[2].count} SMS, ${formatCurrency(sms.byTier[2].cost)}`)}</tr>`;
  if (sms.errorCount > 0) html += `<tr>${tableCell("Send errors")}${tableCell(String(sms.errorCount), "color:#e74c3c;")}</tr>`;
  if (sms.prevMonthSent != null && sms.prevMonthCost != null) {
    const pct =
      sms.prevMonthSent > 0
        ? ((sms.totalSent - sms.prevMonthSent) / sms.prevMonthSent * 100).toFixed(1)
        : "N/A";
    html += `<tr>${tableCell("vs prior month")}${tableCell(`${sms.prevMonthSent} SMS (${formatCurrency(sms.prevMonthCost)}), ${pct}%`)}</tr>`;
  } else {
    html += `<tr>${tableCell("vs prior month")}${tableCell("N/A (no prior data)")}</tr>`;
  }
  html += `</table></td></tr>`;

  if (!noBriefingsInMonth) {
    // Section 2: Compliance
    html += `<tr><td style="padding:16px;border:1px solid #e5e7eb;border-top:none;"><h2 style="margin:0 0 8px 0;font-size:16px;border-bottom:2px solid #e5e7eb;padding-bottom:6px;">2. Overall Compliance Rate</h2>`;
    html += `<p style="margin:0 0 12px 0;color:#6b7280;">Daily briefing completion rate for expected briefing days.</p>`;
    html += `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">`;
    html += `<tr>${th("Metric")}${th("Value")}</tr>`;
    html += `<tr>${tableCell("Monthly average")}${tableCell(formatRate(compliance.monthlyAvgRate), `color:${rateColor(overallRate)};font-weight:bold;`)}</tr>`;
    if (compliance.prevMonthAvgRate != null) {
      html += `<tr>${tableCell("Prior month average")}${tableCell(formatRate(compliance.prevMonthAvgRate))}</tr>`;
    } else {
      html += `<tr>${tableCell("Prior month")}${tableCell("N/A")}</tr>`;
    }
    if (compliance.bestDay)
      html += `<tr>${tableCell("Best day")}${tableCell(`${compliance.bestDay.date} (${formatRate(compliance.bestDay.rate)})`)}</tr>`;
    if (compliance.worstDay)
      html += `<tr>${tableCell("Worst day")}${tableCell(`${compliance.worstDay.date} (${formatRate(compliance.worstDay.rate)})`)}</tr>`;
    if (compliance.weekBreakdown.length > 0) {
      compliance.weekBreakdown.forEach((w) => {
        html += `<tr>${tableCell(w.weekLabel)}${tableCell(formatRate(w.rate), `color:${rateColor(w.rate)};`)}</tr>`;
      });
    }
    html += `</table></td></tr>`;

    // Section 3: Crews
    html += `<tr><td style="padding:16px;border:1px solid #e5e7eb;border-top:none;"><h2 style="margin:0 0 8px 0;font-size:16px;border-bottom:2px solid #e5e7eb;padding-bottom:6px;">3. Crew-Level Compliance Ranking</h2>`;
    html += `<p style="margin:0 0 12px 0;color:#6b7280;">Top and bottom crews by average completion rate.</p>`;
    html += `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">`;
    html += `<tr>${th("#")}${th("Crew")}${th("Rate")}</tr>`;
    crews.slice(0, 15).forEach((c, i) => {
      const color = c.below80 ? "#e74c3c" : rateColor(c.rate);
      html += `<tr>${tableCell(String(i + 1))}${tableCell(escapeHtml(c.name))}${tableCell(formatRate(c.rate) + (c.below80 ? " (below 80%)" : ""), `color:${color};`)}</tr>`;
    });
    html += `</table></td></tr>`;

    // Section 4: Repeat offenders
    html += `<tr><td style="padding:16px;border:1px solid #e5e7eb;border-top:none;"><h2 style="margin:0 0 8px 0;font-size:16px;border-bottom:2px solid #e5e7eb;padding-bottom:6px;">4. Repeat Offenders (3+ unexcused misses)</h2>`;
    html += `<p style="margin:0 0 12px 0;color:#6b7280;">Employees with three or more unexcused briefing misses in the month.</p>`;
    if (repeatOffenders.length === 0) {
      html += `<p style="margin:0;color:#27ae60;">None.</p>`;
    } else {
      html += `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">`;
      html += `<tr>${th("Name")}${th("Crew")}${th("Misses")}${th("Supervisor")}</tr>`;
      repeatOffenders.forEach((r) => {
        html += `<tr>${tableCell(escapeHtml(r.name))}${tableCell(escapeHtml(r.crew))}${tableCell(String(r.misses))}${tableCell(escapeHtml(r.supervisorName))}</tr>`;
      });
      html += `</table>`;
    }
    html += `</td></tr>`;
  } else {
    html += `<tr><td style="padding:16px;border:1px solid #e5e7eb;border-top:none;"><p style="margin:0;color:#6b7280;">No safety briefings were scheduled in ${escapeHtml(monthDisplay)} ${year}. SMS and data quality sections only.</p></td></tr>`;
  }

  // Section 5: Incidents
  html += `<tr><td style="padding:16px;border:1px solid #e5e7eb;border-top:none;"><h2 style="margin:0 0 8px 0;font-size:16px;border-bottom:2px solid #e5e7eb;padding-bottom:6px;">5. Safety Incidents</h2>`;
  html += `<p style="margin:0 0 12px 0;color:#6b7280;">Incidents and near-misses reported in the month.</p>`;
  html += `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">`;
  html += `<tr>${th("Metric")}${th("Value")}</tr>`;
  html += `<tr>${tableCell("Total incidents")}${tableCell(String(incidents.total))}</tr>`;
  Object.entries(incidents.bySeverity)
    .filter(([, n]) => n > 0)
    .forEach(([k, v]) => {
      html += `<tr>${tableCell(`Severity: ${k}`)}${tableCell(String(v))}</tr>`;
    });
  Object.entries(incidents.byType)
    .filter(([, n]) => n > 0)
    .forEach(([k, v]) => {
      html += `<tr>${tableCell(`Type: ${k}`)}${tableCell(String(v))}</tr>`;
    });
  if (incidents.highRiskNearMissCount > 0) {
    html += `<tr>${tableCell("High-risk near-misses")}${tableCell(String(incidents.highRiskNearMissCount), "color:#e74c3c;")}</tr>`;
  }
  html += `</table></td></tr>`;

  // Section 6: Data quality
  html += `<tr><td style="padding:16px;border:1px solid #e5e7eb;border-top:none;"><h2 style="margin:0 0 8px 0;font-size:16px;border-bottom:2px solid #e5e7eb;padding-bottom:6px;">6. Data Quality</h2>`;
  html += `<p style="margin:0 0 12px 0;color:#6b7280;">Gaps that affect SMS delivery and escalation.</p>`;
  html += `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">`;
  html += `<tr>${th("Metric")}${th("Count")}</tr>`;
  html += `<tr>${tableCell("Active field users with no phone")}${tableCell(String(dataQuality.noPhoneCount))}</tr>`;
  html += `<tr>${tableCell("Active field users with no manager")}${tableCell(String(dataQuality.noManagerCount))}</tr>`;
  html += `<tr>${tableCell("Managers with no phone")}${tableCell(String(dataQuality.managerNoPhoneCount))}</tr>`;
  if (
    dataQuality.prevNoPhone != null ||
    dataQuality.prevNoManager != null ||
    dataQuality.prevManagerNoPhone != null
  ) {
    html += `<tr>${tableCell("Prior month (no phone / no manager / manager no phone)")}${tableCell(
      `${dataQuality.prevNoPhone ?? "N/A"} / ${dataQuality.prevNoManager ?? "N/A"} / ${dataQuality.prevManagerNoPhone ?? "N/A"}`
    )}</tr>`;
  }
  html += `</table></td></tr>`;

  html += `<tr><td style="padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;font-size:12px;color:#6b7280;"><p style="margin:0;">ATTS Safety Compliance System</p></td></tr>`;
  html += `</table></body></html>`;

  return { subject, textBody: text, htmlBody: html };
}
