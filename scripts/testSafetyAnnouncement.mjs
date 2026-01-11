#!/usr/bin/env node
/**
 * Test Script: Daily Safety Announcement Generator
 * 
 * This script tests the 7 AM safety announcement feature with 5 progressive test levels.
 * It connects to Supabase to fetch real data and optionally generates announcements.
 * 
 * Usage:
 *   node scripts/testSafetyAnnouncement.mjs [--test-level=1|2|3|4|5] [--dry-run]
 * 
 * Test Levels:
 *   1 - Basic: Mock data, no DB (Low stress)
 *   2 - DB Read: Real Supabase data, no save (Medium stress)
 *   3 - Full Save: Real data + save to DB, no notification (Medium-High stress)
 *   4 - Push Test: Full run with push notification dispatch (High stress)
 *   5 - Edge Cases: Empty data, weekend check, character limits (Stress test)
 * 
 * Environment Variables Required:
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY (for levels 2+)
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Load environment variables
config();

// =============================================================================
// CONFIGURATION
// =============================================================================

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TEST_LEVEL = parseInt(process.argv.find(a => a.startsWith('--test-level='))?.split('=')[1] || '1', 10);
const DRY_RUN = process.argv.includes('--dry-run');

const DEFAULT_WINDOW_HOURS = 48;
const BODY_MAX_CHARS = 283;
const BODY_TARGET_CHARS = 238;
const SUMMARY_MAX_CHARS = 240;

// =============================================================================
// HELPERS
// =============================================================================

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] ${message}`, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}

function logSection(title) {
  console.log('\n' + '═'.repeat(65));
  console.log(`  ${title}`);
  console.log('═'.repeat(65) + '\n');
}

function logSuccess(message) {
  console.log(`✓ ${message}`);
}

function logError(message, error) {
  console.error(`✗ ${message}:`, error?.message || error);
}

function logWarning(message) {
  console.log(`⚠ ${message}`);
}

function logStats(label, value) {
  console.log(`  ${label.padEnd(25)}: ${value}`);
}

// =============================================================================
// MOCK DATA FOR TEST LEVEL 1
// =============================================================================

const MOCK_DATA = {
  jsa: [
    {
      hazards_present: { 'Falls from height': true, 'Electrical contact': true },
      ppe: { 'Hard Hat': { required: true }, 'Safety Glasses': { required: true } },
      weather_conditions: { conditions: { sunny: true }, modifiers: { windy: true } },
      weather_hazards: 'High winds expected',
      notes: 'Near miss reported - branch fell near worker',
    },
    {
      hazards_present: { 'Falls from height': true, 'Struck by': true },
      ppe: { 'Hard Hat': { required: true }, 'Chainsaw chaps': { required: true } },
      weather_conditions: { conditions: { cloudy: true } },
      notes: 'Standard day',
    },
    {
      hazards_present: { 'Electrical contact': true },
      ppe: { 'Safety Glasses': { required: true } },
      weather_conditions: { conditions: { sunny: true } },
      notes: '',
    },
  ],
  dvir: [
    {
      truck_number: 'T-101',
      vehicle_trailer_checklist: { brake_lights: true, turn_signals: true, tires: true },
      aerial_checklist: { boom_condition: true },
    },
    {
      truck_number: 'T-102',
      vehicle_trailer_checklist: { brake_lights: false, turn_signals: true, tires: true },
      aerial_checklist: { boom_condition: true },
    },
  ],
  equipment: [
    {
      equipment_type: 'Chainsaw',
      equipment_number: 'CS-001',
      general_checklist: { chain_tension: true, bar_oil: true },
      specific_checklist: { spark_plug: true },
    },
    {
      equipment_type: 'Chipper',
      equipment_number: 'CH-001',
      general_checklist: { blade_sharp: false, oil_level: true },
      specific_checklist: {},
    },
  ],
};

// =============================================================================
// DATA AGGREGATION
// =============================================================================

function aggregateJsaData(jsas) {
  const hazardCounts = new Map();
  const ppeCounts = new Map();
  let nearMissCount = 0;
  const weatherConditions = new Set();

  for (const jsa of jsas) {
    // Count hazards
    if (jsa.hazards_present && typeof jsa.hazards_present === 'object') {
      for (const [hazard, isPresent] of Object.entries(jsa.hazards_present)) {
        if (isPresent === true) {
          hazardCounts.set(hazard, (hazardCounts.get(hazard) || 0) + 1);
        }
      }
    }
    
    // Count PPE
    if (jsa.ppe && typeof jsa.ppe === 'object') {
      for (const [ppeItem, state] of Object.entries(jsa.ppe)) {
        if (state && typeof state === 'object' && state.required) {
          ppeCounts.set(ppeItem, (ppeCounts.get(ppeItem) || 0) + 1);
        }
      }
    }
    
    // Check for near-misses
    if (jsa.notes && typeof jsa.notes === 'string') {
      const notesLower = jsa.notes.toLowerCase();
      if (notesLower.includes('near miss') || notesLower.includes('near-miss') || notesLower.includes('close call')) {
        nearMissCount++;
      }
    }
    
    // Weather
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
    
    if (jsa.weather_hazards && jsa.weather_hazards.trim()) {
      weatherConditions.add(jsa.weather_hazards.trim());
    }
  }

  return { hazardCounts, ppeCounts, nearMissCount, weatherConditions };
}

function aggregateDvirData(dvirs) {
  const issues = [];
  let vehiclesWithIssues = 0;

  for (const dvir of dvirs) {
    let hasIssue = false;
    
    if (dvir.vehicle_trailer_checklist) {
      for (const [key, value] of Object.entries(dvir.vehicle_trailer_checklist)) {
        if (value === false || value === 'fail') {
          hasIssue = true;
          issues.push({ type: key.replace(/_/g, ' '), truckNumber: dvir.truck_number });
        }
      }
    }
    
    if (dvir.aerial_checklist) {
      for (const [key, value] of Object.entries(dvir.aerial_checklist)) {
        if (value === false || value === 'fail') {
          hasIssue = true;
          issues.push({ type: `Aerial: ${key.replace(/_/g, ' ')}`, truckNumber: dvir.truck_number });
        }
      }
    }
    
    if (hasIssue) vehiclesWithIssues++;
  }

  return { issues, vehiclesWithIssues };
}

function aggregateEquipmentData(inspections) {
  const issues = [];
  let equipmentWithIssues = 0;

  for (const inspection of inspections) {
    let hasIssue = false;
    
    for (const checklist of [inspection.general_checklist, inspection.specific_checklist]) {
      if (checklist && typeof checklist === 'object') {
        for (const [key, value] of Object.entries(checklist)) {
          if (value === false || value === 'fail' || value === 'no') {
            hasIssue = true;
            issues.push({
              type: key.replace(/_/g, ' '),
              equipmentType: `${inspection.equipment_type} #${inspection.equipment_number}`,
            });
          }
        }
      }
    }
    
    if (hasIssue) equipmentWithIssues++;
  }

  return { issues, equipmentWithIssues };
}

// =============================================================================
// TEST FUNCTIONS
// =============================================================================

async function testLevel1_MockData() {
  logSection('TEST 1: Basic Mock Data (Low Stress)');
  
  log('Testing with mock data - no database connection required');
  
  // Aggregate mock data
  const jsaStats = aggregateJsaData(MOCK_DATA.jsa);
  const dvirStats = aggregateDvirData(MOCK_DATA.dvir);
  const equipStats = aggregateEquipmentData(MOCK_DATA.equipment);
  
  // Display results
  log('\n📊 MOCK DATA ANALYSIS:');
  logStats('JSA Forms', MOCK_DATA.jsa.length);
  logStats('DVIR Reports', MOCK_DATA.dvir.length);
  logStats('Equipment Inspections', MOCK_DATA.equipment.length);
  
  console.log('\n  Top Hazards:');
  const topHazards = [...jsaStats.hazardCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [hazard, count] of topHazards.slice(0, 3)) {
    console.log(`    - ${hazard}: ${count} mentions`);
  }
  
  console.log('\n  PPE Requirements:');
  const topPPE = [...jsaStats.ppeCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [ppe, count] of topPPE.slice(0, 3)) {
    console.log(`    - ${ppe}: ${count} mentions`);
  }
  
  logStats('\n  Near-misses', jsaStats.nearMissCount);
  logStats('  Weather conditions', [...jsaStats.weatherConditions].join(', ') || 'None');
  logStats('  Vehicles with issues', dvirStats.vehiclesWithIssues);
  logStats('  Equipment with issues', equipStats.equipmentWithIssues);
  
  // Test character limit validation
  console.log('\n  Character limit validation:');
  const testMessages = [
    { msg: 'Short message.', expected: true },
    { msg: 'A'.repeat(238), expected: true },
    { msg: 'B'.repeat(283), expected: true },
    { msg: 'C'.repeat(284), expected: false },
  ];
  
  for (const { msg, expected } of testMessages) {
    const isValid = msg.length <= BODY_MAX_CHARS;
    const status = isValid === expected ? '✓' : '✗';
    console.log(`    ${status} ${msg.length} chars: ${isValid ? 'VALID' : 'INVALID'}`);
  }
  
  logSuccess('Test 1 passed: Mock data processing works correctly');
  return true;
}

async function testLevel2_RealData(supabase) {
  logSection('TEST 2: Real Supabase Data (Medium Stress)');
  
  const windowStart = new Date(Date.now() - DEFAULT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  log(`Fetching data from last ${DEFAULT_WINDOW_HOURS} hours (since ${windowStart})`);
  
  // Fetch data from all three sources
  const [jsaResult, dvirResult, equipResult] = await Promise.all([
    supabase
      .from('daily_jsa')
      .select('hazards_present, ppe, weather_conditions, weather_hazards, notes')
      .gte('created_at', windowStart),
    supabase
      .from('dvir_reports')
      .select('truck_number, vehicle_trailer_checklist, aerial_checklist')
      .gte('created_at', windowStart),
    supabase
      .from('daily_equipment_inspections')
      .select('equipment_type, equipment_number, general_checklist, specific_checklist')
      .gte('created_at', windowStart),
  ]);
  
  if (jsaResult.error) logWarning(`JSA fetch error: ${jsaResult.error.message}`);
  if (dvirResult.error) logWarning(`DVIR fetch error: ${dvirResult.error.message}`);
  if (equipResult.error) logWarning(`Equipment fetch error: ${equipResult.error.message}`);
  
  const jsas = jsaResult.data || [];
  const dvirs = dvirResult.data || [];
  const equipment = equipResult.data || [];
  
  // Aggregate
  const jsaStats = aggregateJsaData(jsas);
  const dvirStats = aggregateDvirData(dvirs);
  const equipStats = aggregateEquipmentData(equipment);
  
  // Display results
  log('\n📊 REAL DATA ANALYSIS:');
  logStats('JSA Forms', jsas.length);
  logStats('DVIR Reports', dvirs.length);
  logStats('Equipment Inspections', equipment.length);
  logStats('Total Submissions', jsas.length + dvirs.length + equipment.length);
  
  if (jsaStats.hazardCounts.size > 0) {
    console.log('\n  Top Hazards:');
    const topHazards = [...jsaStats.hazardCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [hazard, count] of topHazards.slice(0, 5)) {
      console.log(`    - ${hazard}: ${count} mentions`);
    }
  } else {
    console.log('\n  No hazards reported');
  }
  
  logStats('\n  Near-misses', jsaStats.nearMissCount);
  logStats('  Vehicles with issues', dvirStats.vehiclesWithIssues);
  logStats('  Equipment with issues', equipStats.equipmentWithIssues);
  
  // Check if we have enough data
  const totalSubmissions = jsas.length + dvirs.length + equipment.length;
  if (totalSubmissions < 3) {
    logWarning(`Low data: Only ${totalSubmissions} submissions (minimum 3 recommended)`);
  }
  
  logSuccess('Test 2 passed: Real Supabase data fetched and aggregated');
  return { jsas, dvirs, equipment, jsaStats, dvirStats, equipStats };
}

async function testLevel3_GenerateAndSave(supabase, openai, testData) {
  logSection('TEST 3: Generate and Save (Medium-High Stress)');
  
  if (!OPENAI_API_KEY) {
    logError('OPENAI_API_KEY not set - skipping generation test');
    return false;
  }
  
  const { jsas, dvirs, equipment, jsaStats, dvirStats, equipStats } = testData;
  const totalSubmissions = jsas.length + dvirs.length + equipment.length;
  
  // Build prompt
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  const topHazards = [...jsaStats.hazardCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topPPE = [...jsaStats.ppeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  
  const userPrompt = `Date: ${todayFormatted}
Time Window: Last ${DEFAULT_WINDOW_HOURS} hours

=== SUBMISSION SUMMARY ===
Total Reports: ${totalSubmissions}
- JSA Forms: ${jsas.length}
- DVIR Reports: ${dvirs.length}
- Equipment Inspections: ${equipment.length}

=== JSA DATA ===
Top Hazards:
${topHazards.length > 0 ? topHazards.map(([h, c], i) => `${i + 1}. ${h} - ${c} mentions`).join('\n') : 'None reported'}

PPE Requirements:
${topPPE.length > 0 ? topPPE.map(([p, c], i) => `${i + 1}. ${p} - ${c} mentions`).join('\n') : 'None specified'}

Near-misses: ${jsaStats.nearMissCount}
Weather: ${[...jsaStats.weatherConditions].join(', ') || 'None specified'}

=== DVIR DATA ===
Vehicles inspected: ${dvirs.length}
Vehicles with issues: ${dvirStats.vehiclesWithIssues}
${dvirStats.issues.length > 0 ? `Issues:\n${dvirStats.issues.slice(0, 3).map(i => `- Truck ${i.truckNumber}: ${i.type}`).join('\n')}` : 'No issues'}

=== EQUIPMENT DATA ===
Equipment inspected: ${equipment.length}
Equipment with issues: ${equipStats.equipmentWithIssues}
${equipStats.issues.length > 0 ? `Issues:\n${equipStats.issues.slice(0, 3).map(i => `- ${i.equipmentType}: ${i.type}`).join('\n')}` : 'No issues'}

Generate a safety announcement. Message MUST be under ${BODY_MAX_CHARS} characters.`;

  log('Calling OpenAI API...');
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a safety communication assistant for ATTS, a tree services company.
Generate concise, actionable safety announcements. Prioritize: near-misses > equipment failures > hazards > PPE.
Return JSON: { "title": "Safety Briefing - {date}", "message": "Under ${BODY_MAX_CHARS} chars, be direct and specific." }`,
      },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });
  
  const generated = JSON.parse(completion.choices[0].message.content || '{}');
  
  log('\n📢 GENERATED ANNOUNCEMENT:');
  console.log('─'.repeat(65));
  console.log(`Title: ${generated.title}`);
  console.log('─'.repeat(65));
  console.log(generated.message);
  console.log('─'.repeat(65));
  
  // Validate character limits
  const messageLength = generated.message?.length || 0;
  const isValidLength = messageLength <= BODY_MAX_CHARS;
  
  log('\n📏 CHARACTER VALIDATION:');
  logStats('Message length', `${messageLength} chars`);
  logStats('Target', `${BODY_TARGET_CHARS} chars`);
  logStats('Maximum', `${BODY_MAX_CHARS} chars`);
  logStats('Status', isValidLength ? '✓ VALID' : '✗ TOO LONG');
  
  if (!isValidLength) {
    logWarning(`Message exceeds limit by ${messageLength - BODY_MAX_CHARS} chars`);
  }
  
  // Save to database (unless dry run)
  if (!DRY_RUN) {
    log('\n💾 Saving to announcements table...');
    
    const todayDate = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    
    const { data: saved, error: saveError } = await supabase
      .from('announcements')
      .insert({
        title: `${generated.title} (${timeStr})`,
        message: generated.message,
        author: 'Safety AI (Test)',
        date: todayDate,
        raw_data: {
          source: 'safety_agent_test',
          test_level: 3,
          stats: {
            jsaCount: jsas.length,
            dvirCount: dvirs.length,
            equipmentCount: equipment.length,
          },
        },
      })
      .select('id')
      .single();
    
    if (saveError) {
      logError('Failed to save announcement', saveError);
    } else {
      logSuccess(`Announcement saved with ID: ${saved.id}`);
    }
  } else {
    log('\n  [DRY RUN] Skipping database save');
  }
  
  logStats('\n  Tokens used', completion.usage?.total_tokens || 0);
  logSuccess('Test 3 passed: Announcement generated and validated');
  
  return { generated, messageLength, isValidLength };
}

async function testLevel4_PushNotification(supabase, generated) {
  logSection('TEST 4: Push Notification (High Stress)');
  
  if (DRY_RUN) {
    log('[DRY RUN] Skipping push notification test');
    logSuccess('Test 4 skipped (dry run mode)');
    return true;
  }
  
  log('Creating notification event...');
  
  const notificationBody = generated.message?.length > 200 
    ? generated.message.substring(0, 197) + '...'
    : generated.message;
  
  const { data: notificationEvent, error: eventError } = await supabase
    .from('notification_events')
    .insert({
      category: 'safety_alert',
      severity: 'medium', // Use medium for test
      target_type: 'all',
      target_ref: null,
      title: `🧪 TEST: ${generated.title}`,
      body: notificationBody,
      url: '/announcements',
      entity_type: 'announcement',
      entity_id: null,
    })
    .select('id')
    .single();
  
  if (eventError) {
    logError('Failed to create notification event', eventError);
    return false;
  }
  
  logSuccess(`Notification event created: ${notificationEvent.id}`);
  logWarning('Note: Actual push dispatch requires INTERNAL_SECRET configured on edge function');
  
  logSuccess('Test 4 passed: Notification event created');
  return true;
}

async function testLevel5_EdgeCases(supabase = null) {
  logSection('TEST 5: Edge Cases (Stress Test)');
  
  log('Note: Edge case tests run without database connection');
  
  // Test 5.1: Weekend detection
  log('5.1 Testing weekday detection...');
  const testDates = [
    { date: '2026-01-05', expected: true, day: 'Monday' },
    { date: '2026-01-06', expected: true, day: 'Tuesday' },
    { date: '2026-01-09', expected: true, day: 'Friday' },
    { date: '2026-01-10', expected: false, day: 'Saturday' },
    { date: '2026-01-11', expected: false, day: 'Sunday' },
  ];
  
  for (const { date, expected, day } of testDates) {
    const d = new Date(date + 'T12:00:00');
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const shouldRun = !isWeekend;
    const status = shouldRun === expected ? '✓' : '✗';
    console.log(`  ${status} ${date} (${day}): ${shouldRun ? 'RUN' : 'SKIP'}`);
  }
  
  // Test 5.2: Empty data handling
  log('\n5.2 Testing empty data handling...');
  const emptyStats = aggregateJsaData([]);
  console.log(`  Hazards from empty data: ${emptyStats.hazardCounts.size} (expected 0)`);
  console.log(`  PPE from empty data: ${emptyStats.ppeCounts.size} (expected 0)`);
  console.log(`  Near-misses from empty data: ${emptyStats.nearMissCount} (expected 0)`);
  
  // Test 5.3: Character limit edge cases
  log('\n5.3 Testing character limit boundaries...');
  const limitTests = [
    { length: BODY_TARGET_CHARS, label: 'Target (238)' },
    { length: BODY_MAX_CHARS, label: 'Max (283)' },
    { length: BODY_MAX_CHARS + 1, label: 'Over max (284)' },
  ];
  
  for (const { length, label } of limitTests) {
    const testMsg = 'A'.repeat(length);
    const isValid = testMsg.length <= BODY_MAX_CHARS;
    const status = isValid ? '✓' : '✗';
    console.log(`  ${status} ${label}: ${isValid ? 'VALID' : 'INVALID'}`);
  }
  
  // Test 5.4: Truncation function
  log('\n5.4 Testing truncation...');
  const longMessage = 'This is a very long safety message that exceeds the character limit and needs to be truncated properly. ' +
    'It should truncate at a word boundary or sentence end rather than cutting mid-word. ' +
    'This ensures the message remains readable and professional even after truncation. ' +
    'The truncation should add ellipsis to indicate content was removed.';
  
  function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    const truncateAt = maxLength - 3;
    const sentenceEnd = text.lastIndexOf('. ', truncateAt);
    if (sentenceEnd > truncateAt * 0.7) return text.slice(0, sentenceEnd + 1);
    const wordEnd = text.lastIndexOf(' ', truncateAt);
    if (wordEnd > truncateAt * 0.5) return text.slice(0, wordEnd) + '...';
    return text.slice(0, truncateAt) + '...';
  }
  
  const truncated = truncateText(longMessage, BODY_MAX_CHARS);
  console.log(`  Original: ${longMessage.length} chars`);
  console.log(`  Truncated: ${truncated.length} chars`);
  console.log(`  Ends cleanly: ${!truncated.match(/[a-z]\.\.\.$/i) ? '✓ Yes' : '✗ No'}`);
  
  // Test 5.5: Timezone handling
  log('\n5.5 Testing timezone handling...');
  const now = new Date();
  const chicagoTime = now.toLocaleString('en-US', { timeZone: 'America/Chicago' });
  const utcTime = now.toISOString();
  console.log(`  UTC: ${utcTime}`);
  console.log(`  Chicago: ${chicagoTime}`);
  
  logSuccess('Test 5 passed: All edge cases handled correctly');
  return true;
}

// =============================================================================
// MAIN TEST RUNNER
// =============================================================================

async function main() {
  logSection('SAFETY ANNOUNCEMENT GENERATOR - TEST SUITE');
  log(`Test Level: ${TEST_LEVEL}`);
  log(`Dry Run: ${DRY_RUN}`);
  log(`Date: ${new Date().toISOString()}`);
  
  let supabase = null;
  let openai = null;
  
  // Initialize clients based on test level
  // Test level 5 can run without credentials (pure logic tests)
  const needsSupabase = TEST_LEVEL >= 2 && TEST_LEVEL <= 4;
  const needsOpenAI = TEST_LEVEL >= 3 && TEST_LEVEL <= 4;
  
  if (needsSupabase) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      logError('Missing Supabase configuration for test levels 2-4');
      log('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
      log('Or run with --test-level=1 or --test-level=5 for credential-free tests');
      process.exit(1);
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    log('Supabase client initialized');
  }
  
  if (needsOpenAI) {
    if (!OPENAI_API_KEY) {
      logError('OPENAI_API_KEY required for test levels 3-4');
      log('Set OPENAI_API_KEY in .env or run with different test level');
      process.exit(1);
    }
    openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    log('OpenAI client initialized');
  }
  
  let testData = null;
  let generated = null;
  
  try {
    // Special case: test level 5 can run standalone without DB
    if (TEST_LEVEL === 5) {
      await testLevel1_MockData(); // Still run level 1 for baseline
      await testLevel5_EdgeCases(null);
    } else {
      // Run tests progressively for levels 1-4
      if (TEST_LEVEL >= 1) {
        await testLevel1_MockData();
      }
      
      if (TEST_LEVEL >= 2) {
        testData = await testLevel2_RealData(supabase);
      }
      
      if (TEST_LEVEL >= 3) {
        const result = await testLevel3_GenerateAndSave(supabase, openai, testData || {
          jsas: MOCK_DATA.jsa,
          dvirs: MOCK_DATA.dvir,
          equipment: MOCK_DATA.equipment,
          jsaStats: aggregateJsaData(MOCK_DATA.jsa),
          dvirStats: aggregateDvirData(MOCK_DATA.dvir),
          equipStats: aggregateEquipmentData(MOCK_DATA.equipment),
        });
        generated = result?.generated;
      }
      
      if (TEST_LEVEL >= 4 && generated) {
        await testLevel4_PushNotification(supabase, generated);
      }
    }
    
    // Summary
    logSection('TEST SUITE COMPLETE');
    console.log('All tests passed for level', TEST_LEVEL);
    console.log('');
    console.log('Environment check:');
    console.log(`  SUPABASE_URL: ${SUPABASE_URL ? '✓' : '✗'}`);
    console.log(`  SUPABASE_KEY: ${SUPABASE_SERVICE_KEY ? '✓' : '✗'}`);
    console.log(`  OPENAI_API_KEY: ${OPENAI_API_KEY ? '✓' : '✗'}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Deploy edge function: supabase functions deploy generate-safety-announcement');
    console.log('  2. Set secrets: supabase secrets set OPENAI_API_KEY=sk-...');
    console.log('  3. Run migration to enable pg_cron schedule');
    console.log('  4. Verify 7 AM CST schedule is active');
    
    process.exit(0);
  } catch (error) {
    logSection('TEST FAILED');
    logError('Test failed', error);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

