/**
 * Generate Admin Compliance Summary Email
 * 
 * This module generates well-formatted email content for the admin compliance
 * summary report. It's deterministic - no LLM involved.
 * 
 * @module safety-agent/execution/generateAdminSummaryEmail
 */

import type {
  AdminComplianceSummary,
  AdminEmailContent,
  AdminNotificationType,
  NonCompliantUser,
} from '../types';

// =============================================================================
// CONSTANTS
// =============================================================================

const SEPARATOR_DOUBLE = '=================================================================';
const SEPARATOR_SINGLE = '-----------------------------------------------------------------';

// Group labels for missing types
const MISSING_TYPE_LABELS: Record<AdminNotificationType, string> = {
  'missing_all': 'MISSING ALL FORMS (DVIR, Equipment Inspection, Daily JSA)',
  'missing_dvir_equipment': 'MISSING DVIR AND EQUIPMENT INSPECTION',
  'missing_dvir_jsa': 'MISSING DVIR AND DAILY JSA',
  'missing_equipment_jsa': 'MISSING EQUIPMENT INSPECTION AND DAILY JSA',
  'missing_dvir': 'MISSING DVIR ONLY',
  'missing_equipment': 'MISSING EQUIPMENT INSPECTION ONLY',
  'missing_jsa': 'MISSING DAILY JSA ONLY',
};

// Order of groups in the email (most severe first)
const MISSING_TYPE_ORDER: AdminNotificationType[] = [
  'missing_all',
  'missing_dvir_equipment',
  'missing_dvir_jsa',
  'missing_equipment_jsa',
  'missing_dvir',
  'missing_equipment',
  'missing_jsa',
];

// =============================================================================
// FORMATTING HELPERS
// =============================================================================

/**
 * Format a date as "January 8, 2026"
 */
function formatDateLong(dateFor: string): string {
  const date = new Date(dateFor + 'T12:00:00');
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format a timestamp as "9:00:00 AM CST"
 */
function formatTimestamp(isoString: string, timezone: string = 'America/Chicago'): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
}

/**
 * Format full timestamp as "January 8, 2026 at 9:00:00 AM CST"
 */
function formatFullTimestamp(isoString: string, timezone: string = 'America/Chicago'): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
}

/**
 * Center text within a line width.
 */
function centerText(text: string, width: number = 65): string {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padding) + text;
}

/**
 * Format a user line: "  1. John Smith (employee) - john@example.com"
 */
function formatUserLine(user: NonCompliantUser, index: number): string {
  const name = user.fullName || 'Unknown';
  return `  ${index}. ${name} (${user.role}) - ${user.email}`;
}

// =============================================================================
// MAIN GENERATION FUNCTIONS
// =============================================================================

/**
 * Generate the plain text email body.
 */
export function generateTextBody(summary: AdminComplianceSummary): string {
  const lines: string[] = [];
  const dateLong = formatDateLong(summary.dateFor);
  const generatedTime = formatTimestamp(summary.generatedAt);
  const fullTimestamp = formatFullTimestamp(summary.generatedAt);

  // Header
  lines.push(SEPARATOR_DOUBLE);
  lines.push(centerText('ATTS DAILY SAFETY FORM COMPLIANCE REPORT'));
  lines.push(SEPARATOR_DOUBLE);
  lines.push('');
  lines.push(`Date: ${dateLong}`);
  lines.push(`Report Generated: ${generatedTime}`);
  lines.push('');

  // Summary section
  lines.push(SEPARATOR_SINGLE);
  lines.push(centerText('SUMMARY'));
  lines.push(SEPARATOR_SINGLE);
  lines.push(`Total Required Employees: ${summary.totalRequired}`);
  lines.push(`Compliant: ${summary.totalCompliant}`);
  lines.push(`Non-Compliant: ${summary.totalNonCompliant}`);
  lines.push('');

  // Non-compliant employees section
  if (summary.totalNonCompliant > 0) {
    lines.push(SEPARATOR_SINGLE);
    lines.push(centerText('NON-COMPLIANT EMPLOYEES'));
    lines.push(SEPARATOR_SINGLE);
    lines.push('');

    // Group users by missing type
    let userNumber = 1;
    for (const missingType of MISSING_TYPE_ORDER) {
      const usersInGroup = summary.nonCompliantUsers.filter(u => u.missingType === missingType);
      
      if (usersInGroup.length > 0) {
        lines.push(`${MISSING_TYPE_LABELS[missingType]}:`);
        for (const user of usersInGroup) {
          lines.push(formatUserLine(user, userNumber));
          userNumber++;
        }
        lines.push('');
      }
    }
  } else {
    // All clear message
    lines.push(SEPARATOR_SINGLE);
    lines.push(centerText('ALL CLEAR'));
    lines.push(SEPARATOR_SINGLE);
    lines.push('');
    lines.push('All employees have submitted their required safety forms.');
    lines.push('Great job maintaining compliance!');
    lines.push('');
  }

  // Footer
  lines.push(SEPARATOR_SINGLE);
  lines.push('');
  lines.push(`This report was generated on ${fullTimestamp}.`);
  lines.push('');
  lines.push('Thank you for reviewing this compliance report.');
  lines.push('Please follow up with the listed employees as needed.');
  lines.push('');
  lines.push('ATTS Safety Compliance System');
  lines.push(SEPARATOR_DOUBLE);

  return lines.join('\n');
}

/**
 * Generate HTML email body (optional, for better formatting in email clients).
 */
export function generateHtmlBody(summary: AdminComplianceSummary): string {
  const dateLong = formatDateLong(summary.dateFor);
  const generatedTime = formatTimestamp(summary.generatedAt);
  const fullTimestamp = formatFullTimestamp(summary.generatedAt);

  // Build non-compliant sections
  let nonCompliantHtml = '';
  if (summary.totalNonCompliant > 0) {
    let userNumber = 1;
    for (const missingType of MISSING_TYPE_ORDER) {
      const usersInGroup = summary.nonCompliantUsers.filter(u => u.missingType === missingType);
      
      if (usersInGroup.length > 0) {
        nonCompliantHtml += `
          <h3 style="color: #dc2626; margin: 16px 0 8px 0; font-size: 14px;">
            ${MISSING_TYPE_LABELS[missingType]}:
          </h3>
          <ul style="margin: 0; padding-left: 20px;">
        `;
        for (const user of usersInGroup) {
          const name = user.fullName || 'Unknown';
          nonCompliantHtml += `
            <li style="margin: 4px 0;">
              <strong>${userNumber}. ${name}</strong> (${user.role}) - 
              <a href="mailto:${user.email}">${user.email}</a>
            </li>
          `;
          userNumber++;
        }
        nonCompliantHtml += '</ul>';
      }
    }
  } else {
    nonCompliantHtml = `
      <div style="background: #dcfce7; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <h3 style="color: #166534; margin: 0 0 8px 0;">✓ ALL CLEAR</h3>
        <p style="margin: 0; color: #166534;">
          All employees have submitted their required safety forms. Great job maintaining compliance!
        </p>
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ATTS Daily Safety Form Compliance Report</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
  
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #166534 0%, #15803d 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 20px; font-weight: 600;">
      ATTS DAILY SAFETY FORM COMPLIANCE REPORT
    </h1>
  </div>
  
  <!-- Main Content -->
  <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
    
    <!-- Date Info -->
    <div style="margin-bottom: 20px;">
      <p style="margin: 0; color: #6b7280;"><strong>Date:</strong> ${dateLong}</p>
      <p style="margin: 0; color: #6b7280;"><strong>Report Generated:</strong> ${generatedTime}</p>
    </div>
    
    <!-- Summary Stats -->
    <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
      <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #374151;">Summary</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Total Required Employees:</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 600;">${summary.totalRequired}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #22c55e;">Compliant:</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #22c55e;">${summary.totalCompliant}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #ef4444;">Non-Compliant:</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #ef4444;">${summary.totalNonCompliant}</td>
        </tr>
      </table>
    </div>
    
    <!-- Non-Compliant Employees -->
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #374151;">
        ${summary.totalNonCompliant > 0 ? 'Non-Compliant Employees' : 'Compliance Status'}
      </h2>
      ${nonCompliantHtml}
    </div>
    
    <!-- Footer -->
    <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 20px;">
      <p style="margin: 0 0 8px 0; font-size: 12px; color: #9ca3af;">
        This report was generated on ${fullTimestamp}.
      </p>
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        Thank you for reviewing this compliance report. Please follow up with the listed employees as needed.
      </p>
    </div>
    
  </div>
  
  <!-- Footer Branding -->
  <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
    ATTS Safety Compliance System
  </div>
  
</body>
</html>
  `.trim();
}

/**
 * Generate email subject line.
 */
export function generateSubject(summary: AdminComplianceSummary): string {
  const dateLong = formatDateLong(summary.dateFor);
  const statusIndicator = summary.totalNonCompliant === 0 ? '✓' : `⚠️ ${summary.totalNonCompliant} Missing`;
  return `[ATTS] Daily Safety Form Compliance Report - ${dateLong} ${statusIndicator}`;
}

/**
 * Generate complete email content (subject + body).
 */
export function generateAdminSummaryEmail(summary: AdminComplianceSummary): AdminEmailContent {
  return {
    subject: generateSubject(summary),
    textBody: generateTextBody(summary),
    htmlBody: generateHtmlBody(summary),
  };
}

export default generateAdminSummaryEmail;

