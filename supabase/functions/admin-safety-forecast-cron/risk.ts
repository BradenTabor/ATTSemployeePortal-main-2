/**
 * Risk score calculation logic
 */

import { RiskLevel, RiskScore, WeatherRiskFactors, CrewRiskFactors } from './types.ts';

// =============================================================================
// RISK LEVEL DETERMINATION
// =============================================================================

export function getRiskLevel(score: number): RiskLevel {
  if (score < 1.5) return 'LOW';
  if (score < 2.0) return 'MODERATE';
  if (score < 2.5) return 'ELEVATED';
  if (score < 3.5) return 'HIGH';
  return 'CRITICAL';
}

// =============================================================================
// RISK SCORE CALCULATION
// =============================================================================

export function calculateRiskScore(
  weather: WeatherRiskFactors,
  crew: CrewRiskFactors,
  criticalDefects: string[],
  isMondayFlag: boolean
): RiskScore {
  let score = 1.0;
  const drivers: Array<{ text: string; weight: number }> = [];
  const recommendations: string[] = [];

  // Weather multipliers
  if (weather.windGust > 30) {
    const mult = 1.0 + (weather.windGust - 25) * 0.03;
    score *= mult;
    drivers.push({ text: `Wind gusts ${weather.windGust}mph (dangerous)`, weight: mult });
    recommendations.push('Enforce 30mph wind cutoff for all aerial work');
  } else if (weather.windGust > 25) {
    score *= 1.2;
    drivers.push({ text: `Wind gusts ${weather.windGust}mph`, weight: 1.2 });
  }

  if (weather.heatIndex > 95) {
    score *= 1.3;
    drivers.push({ text: `Extreme heat index ${weather.heatIndex}°F`, weight: 1.3 });
    recommendations.push('Mandatory 15-minute breaks every hour in shade');
    recommendations.push('Ensure 1 gallon water per person on site');
  } else if (weather.heatIndex > 90) {
    score *= 1.15;
    drivers.push({ text: `High heat index ${weather.heatIndex}°F`, weight: 1.15 });
    recommendations.push('Provide extra water breaks');
  }

  if (weather.alerts.length > 0) {
    score *= 1.5;
    drivers.push({ text: `Weather alerts: ${weather.alerts.slice(0, 2).join(', ')}`, weight: 1.5 });
    recommendations.push('Review weather alerts with crew during briefing');
  }

  // Crew multipliers
  const newHireRatio = crew.newHireCount / Math.max(crew.totalCount, 1);
  if (newHireRatio > 0.5) {
    score *= 2.5;
    drivers.push({ text: `${crew.newHireCount}/${crew.totalCount} are new hires (>50%)`, weight: 2.5 });
    recommendations.push(`Assign veteran mentor to shadow ${crew.newHireCount} new hire(s)`);
  } else if (newHireRatio > 0.3) {
    score *= 1.8;
    drivers.push({ text: `${crew.newHireCount} new hires on crew`, weight: 1.8 });
  }

  if (!crew.hasExpert && crew.totalCount > 2) {
    score *= 1.3;
    drivers.push({ text: 'No expert-level supervision', weight: 1.3 });
    recommendations.push('Consider reassigning an expert to this crew');
  }

  // Equipment multipliers
  if (criticalDefects.length > 0) {
    const mult = 1.0 + (criticalDefects.length * 0.2);
    score *= mult;
    drivers.push({ text: `${criticalDefects.length} critical equipment defects`, weight: mult });
    recommendations.push(`Verify defect resolution before dispatch: ${criticalDefects.slice(0, 3).join(', ')}`);
  }

  // Temporal multipliers
  if (isMondayFlag) {
    score *= 1.1;
    drivers.push({ text: 'Monday (elevated baseline risk)', weight: 1.1 });
  }

  // Clamp and sort
  score = Math.min(Math.max(score, 1.0), 5.0);
  const topDrivers = drivers.sort((a, b) => b.weight - a.weight).slice(0, 3).map(d => d.text);
  const level = getRiskLevel(score);

  if (level === 'CRITICAL') {
    recommendations.push('Consider postponing non-critical work');
  } else if (level === 'HIGH') {
    recommendations.push('Mandatory safety officer presence');
  }

  return {
    total: Math.round(score * 100) / 100,
    level,
    drivers: topDrivers,
    recommendations: [...new Set(recommendations)].slice(0, 6),
  };
}
