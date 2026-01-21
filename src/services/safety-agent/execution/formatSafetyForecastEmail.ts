/**
 * Safety Forecast Email Formatter
 * 
 * Generates HTML and plain text email content for the Admin Safety Forecast.
 * 
 * @see directives/admin_safety_forecast_6_30am.md
 */

import {
  type RiskScore,
  type RiskLevel,
  getRiskLevelEmoji,
} from './calculateRiskScore';
import type { WeatherRiskFactors } from './getWeatherForecast';

// ============================================================================
// Type Definitions
// ============================================================================

export interface SiteRiskData {
  siteId: string;
  siteName: string;
  region?: string;
  riskScore: RiskScore;
  weather: WeatherRiskFactors;
  crew: {
    totalCount: number;
    newHireCount: number;
    hasExpert: boolean;
    members?: Array<{ name: string; isNewHire: boolean; experienceLevel?: string }>;
  };
  defects: string[];
}

export interface ForecastEmailData {
  date: string; // YYYY-MM-DD
  generatedAt: string; // ISO timestamp
  overallRiskScore: RiskScore;
  sites: SiteRiskData[];
  companyWideFactors: string[];
  isMonday: boolean;
  hasWeatherApiError?: boolean;
  missingExperienceCount?: number;
}

// ============================================================================
// Email Formatting Functions
// ============================================================================

/**
 * Get risk level color for HTML (inline styles)
 */
function getRiskLevelHtmlColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    LOW: '#22c55e',      // green-500
    MODERATE: '#3b82f6', // blue-500
    ELEVATED: '#f59e0b', // amber-500
    HIGH: '#f97316',     // orange-500
    CRITICAL: '#ef4444', // red-500
  };
  return colors[level];
}

/**
 * Get risk level background color for HTML
 */
function getRiskLevelBgColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    LOW: '#dcfce7',      // green-100
    MODERATE: '#dbeafe', // blue-100
    ELEVATED: '#fef3c7', // amber-100
    HIGH: '#ffedd5',     // orange-100
    CRITICAL: '#fee2e2', // red-100
  };
  return colors[level];
}

/**
 * Format date for display (e.g., "Monday, January 20, 2026")
 */
function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format time for display (e.g., "6:30 AM CST")
 */
function formatGeneratedTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
    timeZoneName: 'short',
  });
}

// ============================================================================
// HTML Email Template
// ============================================================================

/**
 * Generate HTML email body for the Safety Forecast
 */
export function formatSafetyForecastHtml(data: ForecastEmailData): string {
  const { overallRiskScore, sites, date, generatedAt, companyWideFactors } = data;
  const displayDate = formatDisplayDate(date);
  const generatedTime = formatGeneratedTime(generatedAt);
  const levelColor = getRiskLevelHtmlColor(overallRiskScore.level);
  const levelBgColor = getRiskLevelBgColor(overallRiskScore.level);
  const emoji = getRiskLevelEmoji(overallRiskScore.level);

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Safety Forecast - ${date}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 24px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 32px; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">
                ${emoji} Safety Forecast
              </h1>
              <p style="margin: 8px 0 0; color: #94a3b8; font-size: 14px;">
                ${displayDate}
              </p>
            </td>
          </tr>

          <!-- Overall Risk Banner -->
          <tr>
            <td style="padding: 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${levelBgColor}; border: 2px solid ${levelColor}; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <p style="margin: 0 0 8px; color: #374151; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                      Today's Overall Risk Level
                    </p>
                    <p style="margin: 0; color: ${levelColor}; font-size: 36px; font-weight: 800;">
                      ${overallRiskScore.total.toFixed(1)} / 5.0
                    </p>
                    <p style="margin: 8px 0 0; color: ${levelColor}; font-size: 20px; font-weight: 700;">
                      ${overallRiskScore.level}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;

  // Warnings section
  if (data.hasWeatherApiError || (data.missingExperienceCount && data.missingExperienceCount > 0)) {
    html += `
          <!-- Warnings -->
          <tr>
            <td style="padding: 0 24px 16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                <tr>
                  <td style="padding: 12px 16px;">`;
    
    if (data.hasWeatherApiError) {
      html += `<p style="margin: 0 0 4px; color: #92400e; font-size: 13px;">⚠️ Weather data may be outdated due to API issues</p>`;
    }
    if (data.missingExperienceCount && data.missingExperienceCount > 0) {
      html += `<p style="margin: 0; color: #92400e; font-size: 13px;">⚠️ ${data.missingExperienceCount} employee(s) have missing experience data</p>`;
    }

    html += `
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
  }

  // Top Risk Drivers
  if (overallRiskScore.drivers.length > 0) {
    html += `
          <!-- Top Risk Drivers -->
          <tr>
            <td style="padding: 0 24px 24px;">
              <h2 style="margin: 0 0 12px; color: #1f2937; font-size: 16px; font-weight: 700;">
                📊 Top Risk Drivers
              </h2>
              <ul style="margin: 0; padding: 0 0 0 20px; color: #4b5563; font-size: 14px; line-height: 1.6;">
                ${overallRiskScore.drivers.map(d => `<li>${d}</li>`).join('')}
              </ul>
            </td>
          </tr>`;
  }

  // Recommendations
  if (overallRiskScore.recommendations.length > 0) {
    html += `
          <!-- Recommendations -->
          <tr>
            <td style="padding: 0 24px 24px;">
              <h2 style="margin: 0 0 12px; color: #1f2937; font-size: 16px; font-weight: 700;">
                ✅ Recommended Actions
              </h2>
              <ul style="margin: 0; padding: 0 0 0 20px; color: #4b5563; font-size: 14px; line-height: 1.6;">
                ${overallRiskScore.recommendations.map(r => `<li>${r}</li>`).join('')}
              </ul>
            </td>
          </tr>`;
  }

  // Site-by-Site Breakdown
  if (sites.length > 0) {
    html += `
          <!-- Site Breakdown -->
          <tr>
            <td style="padding: 0 24px 24px;">
              <h2 style="margin: 0 0 16px; color: #1f2937; font-size: 16px; font-weight: 700; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
                📍 Site-by-Site Breakdown
              </h2>`;

    for (const site of sites) {
      const siteColor = getRiskLevelHtmlColor(site.riskScore.level);
      const siteBgColor = getRiskLevelBgColor(site.riskScore.level);
      const siteEmoji = getRiskLevelEmoji(site.riskScore.level);

      html += `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="background-color: ${siteBgColor}; padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td>
                          <p style="margin: 0; color: #1f2937; font-size: 15px; font-weight: 700;">
                            ${siteEmoji} ${site.siteName}${site.region ? ` (${site.region})` : ''}
                          </p>
                        </td>
                        <td style="text-align: right;">
                          <span style="display: inline-block; background-color: ${siteColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600;">
                            ${site.riskScore.level} (${site.riskScore.total.toFixed(1)})
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align: top; width: 50%; padding-right: 8px;">
                          <p style="margin: 0 0 4px; color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase;">Weather</p>
                          <p style="margin: 0; color: #374151; font-size: 13px;">
                            ${site.weather.conditions}<br>
                            Wind: ${site.weather.windGust}mph${site.weather.windGust > 25 ? ' ⚠️' : ''}<br>
                            Heat Index: ${site.weather.heatIndex}°F${site.weather.heatIndex > 90 ? ' ⚠️' : ''}
                          </p>
                        </td>
                        <td style="vertical-align: top; width: 50%; padding-left: 8px;">
                          <p style="margin: 0 0 4px; color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase;">Crew</p>
                          <p style="margin: 0; color: #374151; font-size: 13px;">
                            ${site.crew.totalCount} members<br>
                            ${site.crew.newHireCount > 0 ? `${site.crew.newHireCount} new hire(s) ⚠️<br>` : ''}
                            ${site.crew.hasExpert ? 'Expert on crew ✓' : 'No expert ⚠️'}
                          </p>
                        </td>
                      </tr>
                    </table>
                    ${site.defects.length > 0 ? `
                    <p style="margin: 12px 0 4px; color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase;">Equipment Issues</p>
                    <p style="margin: 0; color: #dc2626; font-size: 13px;">
                      ${site.defects.slice(0, 3).join(', ')}${site.defects.length > 3 ? ` +${site.defects.length - 3} more` : ''}
                    </p>
                    ` : ''}
                    ${site.riskScore.recommendations.length > 0 ? `
                    <p style="margin: 12px 0 4px; color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase;">Site Actions</p>
                    <ul style="margin: 0; padding: 0 0 0 16px; color: #4b5563; font-size: 12px; line-height: 1.5;">
                      ${site.riskScore.recommendations.slice(0, 3).map(r => `<li>${r}</li>`).join('')}
                    </ul>
                    ` : ''}
                  </td>
                </tr>
              </table>`;
    }

    html += `
            </td>
          </tr>`;
  } else {
    html += `
          <!-- No Sites -->
          <tr>
            <td style="padding: 0 24px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6; border-radius: 8px;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <p style="margin: 0; color: #6b7280; font-size: 14px;">
                      No active work sites scheduled for today.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
  }

  // Company-Wide Factors
  if (companyWideFactors.length > 0) {
    html += `
          <!-- Company-Wide Factors -->
          <tr>
            <td style="padding: 0 24px 24px;">
              <h2 style="margin: 0 0 12px; color: #1f2937; font-size: 16px; font-weight: 700; border-top: 2px solid #e5e7eb; padding-top: 16px;">
                🏢 Company-Wide Factors
              </h2>
              <ul style="margin: 0; padding: 0 0 0 20px; color: #4b5563; font-size: 14px; line-height: 1.6;">
                ${companyWideFactors.map(f => `<li>${f}</li>`).join('')}
              </ul>
            </td>
          </tr>`;
  }

  // Footer
  html += `
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 16px 24px; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                Generated at ${generatedTime} | Data window: Last 24 hours<br>
                All Terrain Tree Service Safety Management System
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return html;
}

// ============================================================================
// Plain Text Email Template
// ============================================================================

/**
 * Generate plain text email body for the Safety Forecast
 */
export function formatSafetyForecastText(data: ForecastEmailData): string {
  const { overallRiskScore, sites, date, generatedAt, companyWideFactors } = data;
  const displayDate = formatDisplayDate(date);
  const generatedTime = formatGeneratedTime(generatedAt);
  const emoji = getRiskLevelEmoji(overallRiskScore.level);

  let text = `${emoji} SAFETY FORECAST - ${displayDate}
${'═'.repeat(50)}

TODAY'S OVERALL RISK LEVEL: ${overallRiskScore.total.toFixed(1)} / 5.0 (${overallRiskScore.level})

`;

  // Warnings
  if (data.hasWeatherApiError) {
    text += `⚠️ WARNING: Weather data may be outdated due to API issues\n`;
  }
  if (data.missingExperienceCount && data.missingExperienceCount > 0) {
    text += `⚠️ WARNING: ${data.missingExperienceCount} employee(s) have missing experience data\n`;
  }
  if (data.hasWeatherApiError || (data.missingExperienceCount && data.missingExperienceCount > 0)) {
    text += '\n';
  }

  // Top Risk Drivers
  if (overallRiskScore.drivers.length > 0) {
    text += `📊 TOP RISK DRIVERS:\n`;
    for (const driver of overallRiskScore.drivers) {
      text += `   • ${driver}\n`;
    }
    text += '\n';
  }

  // Recommendations
  if (overallRiskScore.recommendations.length > 0) {
    text += `✅ RECOMMENDED ACTIONS:\n`;
    for (const rec of overallRiskScore.recommendations) {
      text += `   • ${rec}\n`;
    }
    text += '\n';
  }

  // Site-by-Site Breakdown
  text += `${'─'.repeat(50)}\n📍 SITE-BY-SITE BREAKDOWN\n${'─'.repeat(50)}\n\n`;

  if (sites.length === 0) {
    text += `No active work sites scheduled for today.\n\n`;
  } else {
    for (const site of sites) {
      const siteEmoji = getRiskLevelEmoji(site.riskScore.level);
      text += `${siteEmoji} ${site.siteName}${site.region ? ` (${site.region})` : ''}\n`;
      text += `   Risk Level: ${site.riskScore.level} (${site.riskScore.total.toFixed(1)})\n`;
      text += `   Weather: ${site.weather.conditions}, Wind ${site.weather.windGust}mph, Heat Index ${site.weather.heatIndex}°F\n`;
      text += `   Crew: ${site.crew.totalCount} members`;
      if (site.crew.newHireCount > 0) text += `, ${site.crew.newHireCount} new hire(s)`;
      text += site.crew.hasExpert ? ', Expert on crew' : ', No expert';
      text += '\n';

      if (site.defects.length > 0) {
        text += `   Equipment Issues: ${site.defects.slice(0, 3).join(', ')}${site.defects.length > 3 ? ` +${site.defects.length - 3} more` : ''}\n`;
      }

      if (site.riskScore.recommendations.length > 0) {
        text += `   Actions:\n`;
        for (const rec of site.riskScore.recommendations.slice(0, 3)) {
          text += `      • ${rec}\n`;
        }
      }
      text += '\n';
    }
  }

  // Company-Wide Factors
  if (companyWideFactors.length > 0) {
    text += `${'─'.repeat(50)}\n🏢 COMPANY-WIDE FACTORS\n${'─'.repeat(50)}\n`;
    for (const factor of companyWideFactors) {
      text += `   • ${factor}\n`;
    }
    text += '\n';
  }

  // Footer
  text += `${'═'.repeat(50)}\n`;
  text += `Generated at ${generatedTime} | Data window: Last 24 hours\n`;
  text += `All Terrain Tree Service Safety Management System\n`;

  return text;
}

// ============================================================================
// Email Subject Generation
// ============================================================================

/**
 * Generate email subject line based on risk level
 */
export function generateEmailSubject(riskScore: RiskScore, date: string): string {
  const emoji = getRiskLevelEmoji(riskScore.level);
  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (riskScore.level === 'LOW') {
    return `✅ LOW Risk Safety Forecast - ${formattedDate}`;
  }

  return `${emoji} ${riskScore.level} Risk Safety Forecast - ${formattedDate}`;
}
