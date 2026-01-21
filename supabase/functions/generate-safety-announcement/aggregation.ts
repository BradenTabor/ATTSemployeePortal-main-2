/**
 * Data aggregation functions for generate-safety-announcement Edge Function
 */

import type { HazardCount, DvirIssue, EquipmentIssue, AggregatedStats } from './types.ts';

// =============================================================================
// JSA AGGREGATION
// =============================================================================

interface JsaData {
  hazards_present?: Record<string, boolean>;
  ppe?: Record<string, { required?: boolean }>;
  notes?: string;
  weather_conditions?: {
    conditions?: Record<string, boolean>;
    modifiers?: Record<string, boolean>;
  };
  weather_hazards?: string;
}

export function aggregateJsaData(jsas: JsaData[]): {
  topHazards: HazardCount[];
  topPPE: [string, number][];
  nearMissCount: number;
  weatherConditions: string[];
} {
  const hazardCounts = new Map<string, number>();
  const ppeCounts = new Map<string, number>();
  let nearMissCount = 0;
  const weatherConditions = new Set<string>();

  for (const jsa of jsas) {
    // hazards_present is a JSON object like { "Electrical Contact": true, "Falls": true }
    if (jsa.hazards_present && typeof jsa.hazards_present === 'object') {
      for (const [hazard, isPresent] of Object.entries(jsa.hazards_present)) {
        if (isPresent === true) {
          hazardCounts.set(hazard, (hazardCounts.get(hazard) || 0) + 1);
        }
      }
    }
    
    // ppe is a JSON object like { "Hard Hat": { required: true, condition: "good" } }
    if (jsa.ppe && typeof jsa.ppe === 'object') {
      for (const [ppeItem, state] of Object.entries(jsa.ppe)) {
        if (state && typeof state === 'object' && state.required) {
          ppeCounts.set(ppeItem, (ppeCounts.get(ppeItem) || 0) + 1);
        }
      }
    }
    
    // Check notes for near-miss mentions
    if (jsa.notes && typeof jsa.notes === 'string') {
      const notesLower = jsa.notes.toLowerCase();
      if (notesLower.includes('near miss') || notesLower.includes('near-miss') || notesLower.includes('close call')) {
        nearMissCount++;
      }
    }
    
    // weather_conditions is a JSON object
    if (jsa.weather_conditions && typeof jsa.weather_conditions === 'object') {
      const wc = jsa.weather_conditions;
      if (wc.conditions) {
        for (const [condition, isActive] of Object.entries(wc.conditions)) {
          if (isActive === true) weatherConditions.add(condition);
        }
      }
      if (wc.modifiers) {
        for (const [modifier, isActive] of Object.entries(wc.modifiers)) {
          if (isActive === true) weatherConditions.add(modifier);
        }
      }
    }
    
    // Also check weather_hazards text field
    if (jsa.weather_hazards && typeof jsa.weather_hazards === 'string' && jsa.weather_hazards.trim()) {
      weatherConditions.add(jsa.weather_hazards.trim());
    }
  }

  const topHazards: HazardCount[] = [...hazardCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([hazard, count]) => ({ hazard, count }));

  const topPPE: [string, number][] = [...ppeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return {
    topHazards,
    topPPE,
    nearMissCount,
    weatherConditions: [...weatherConditions],
  };
}

// =============================================================================
// DVIR AGGREGATION
// =============================================================================

interface DvirData {
  truck_number?: string;
  vehicle_trailer_checklist?: Record<string, unknown>;
  aerial_checklist?: Record<string, unknown>;
}

export function aggregateDvirData(dvirs: DvirData[]): {
  dvirWithIssues: number;
  dvirIssues: DvirIssue[];
} {
  const dvirIssues: DvirIssue[] = [];
  let dvirWithIssues = 0;

  for (const dvir of dvirs) {
    let hasIssue = false;
    
    if (dvir.vehicle_trailer_checklist) {
      const checklist = dvir.vehicle_trailer_checklist;
      for (const [key, value] of Object.entries(checklist)) {
        if (value === false || value === 'fail' || value === 'Fail') {
          hasIssue = true;
          dvirIssues.push({
            type: key.replace(/_/g, ' '),
            truckNumber: dvir.truck_number || 'Unknown',
          });
        }
      }
    }
    
    if (dvir.aerial_checklist) {
      const checklist = dvir.aerial_checklist;
      for (const [key, value] of Object.entries(checklist)) {
        if (value === false || value === 'fail' || value === 'Fail') {
          hasIssue = true;
          dvirIssues.push({
            type: `Aerial: ${key.replace(/_/g, ' ')}`,
            truckNumber: dvir.truck_number || 'Unknown',
          });
        }
      }
    }
    
    if (hasIssue) dvirWithIssues++;
  }

  return { dvirWithIssues, dvirIssues };
}

// =============================================================================
// EQUIPMENT AGGREGATION
// =============================================================================

interface EquipmentData {
  equipment_type?: string;
  equipment_number?: string;
  general_checklist?: Record<string, unknown>;
  specific_checklist?: Record<string, unknown>;
}

export function aggregateEquipmentData(inspections: EquipmentData[]): {
  equipmentWithIssues: number;
  equipmentIssues: EquipmentIssue[];
} {
  const equipmentIssues: EquipmentIssue[] = [];
  let equipmentWithIssues = 0;

  for (const inspection of inspections) {
    let hasIssue = false;
    
    if (inspection.general_checklist && typeof inspection.general_checklist === 'object') {
      const checklist = inspection.general_checklist;
      for (const [key, value] of Object.entries(checklist)) {
        if (value === false || value === 'fail' || value === 'Fail' || value === 'no' || value === 'No') {
          hasIssue = true;
          equipmentIssues.push({
            type: key.replace(/_/g, ' '),
            equipmentType: `${inspection.equipment_type || 'Unknown'} #${inspection.equipment_number || '?'}`,
          });
        }
      }
    }
    
    if (inspection.specific_checklist && typeof inspection.specific_checklist === 'object') {
      const checklist = inspection.specific_checklist;
      for (const [key, value] of Object.entries(checklist)) {
        if (value === false || value === 'fail' || value === 'Fail' || value === 'no' || value === 'No') {
          hasIssue = true;
          equipmentIssues.push({
            type: key.replace(/_/g, ' '),
            equipmentType: `${inspection.equipment_type || 'Unknown'} #${inspection.equipment_number || '?'}`,
          });
        }
      }
    }
    
    if (hasIssue) equipmentWithIssues++;
  }

  return { equipmentWithIssues, equipmentIssues };
}

// =============================================================================
// BUILD USER PROMPT
// =============================================================================

export function buildUserPrompt(stats: AggregatedStats, formattedDate: string): string {
  return `Generate a safety announcement for: ${formattedDate}

## Recent Safety Data (${stats.totalSubmissions} submissions in the last 48 hours)

### Top Hazards Identified:
${stats.topHazards.length > 0 
  ? stats.topHazards.map(h => `- ${h.hazard} (${h.count} reports)`).join('\n')
  : '- No specific hazards reported'}

### PPE Requirements Logged:
${stats.topPPE.length > 0
  ? stats.topPPE.map(([ppe, count]) => `- ${ppe} (${count} reports)`).join('\n')
  : '- Standard PPE requirements'}

### Weather Conditions:
${stats.weatherConditions.length > 0
  ? stats.weatherConditions.join(', ')
  : 'No specific weather conditions reported'}

### Vehicle/Equipment Status:
- DVIRs with issues: ${stats.dvirWithIssues} of ${stats.dvirCount}
- Equipment with issues: ${stats.equipmentWithIssues} of ${stats.equipmentCount}

### Near-Misses:
${stats.nearMissCount > 0 ? `${stats.nearMissCount} near-miss(es) reported` : 'None reported'}

Generate a warm, personalized safety message based on this data. Remember:
- DO NOT include statistics or numbers in the message
- Start with a warm greeting
- Focus on the most relevant safety reminders
- End with an encouraging phrase
- Keep it under 283 characters`;
}
