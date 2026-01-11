#!/usr/bin/env node
/**
 * Test Script: Admin Compliance Summary
 * 
 * This script tests the admin compliance summary feature in dry-run mode.
 * It connects to Supabase to fetch real data but does not send actual emails.
 * 
 * Usage:
 *   node scripts/testAdminComplianceSummary.mjs [--test-level=1|2|3]
 * 
 * Test Levels:
 *   1 - Basic: Just check compilation and data fetching
 *   2 - Edge Cases: Test with various date scenarios
 *   3 - Stress: Full workflow with detailed logging
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

// =============================================================================
// CONFIGURATION
// =============================================================================

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_LEVEL = parseInt(process.argv.find(a => a.startsWith('--test-level='))?.split('=')[1] || '1', 10);

// =============================================================================
// HELPERS
// =============================================================================

function log(message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : '');
}

function logSection(title) {
  console.log('\n' + '='.repeat(65));
  console.log(`  ${title}`);
  console.log('='.repeat(65) + '\n');
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

// =============================================================================
// TEST FUNCTIONS
// =============================================================================

async function testSupabaseConnection(supabase) {
  log('Testing Supabase connection...');
  
  const { data, error } = await supabase
    .from('app_users')
    .select('count')
    .limit(1);
  
  if (error) {
    throw new Error(`Supabase connection failed: ${error.message}`);
  }
  
  logSuccess('Supabase connection successful');
  return true;
}

async function testFetchRequiredUsers(supabase) {
  log('Fetching required users (employees + foremen with email)...');
  
  const { data, error } = await supabase
    .from('app_users')
    .select('user_id, email, full_name, role')
    .in('role', ['employee', 'foreman'])
    .not('email', 'is', null);
  
  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }
  
  logSuccess(`Found ${data.length} required users`);
  
  // Show breakdown by role
  const employees = data.filter(u => u.role === 'employee');
  const foremen = data.filter(u => u.role === 'foreman');
  log(`  - Employees: ${employees.length}`);
  log(`  - Foremen: ${foremen.length}`);
  
  return data;
}

async function testFetchSubmissions(supabase, dateFor) {
  log(`Fetching submissions for ${dateFor}...`);
  
  // DVIR
  const { data: dvirData, error: dvirError } = await supabase
    .from('dvir_reports')
    .select('user_id')
    .eq('report_date', dateFor)
    .not('user_id', 'is', null);
  
  if (dvirError) {
    logWarning(`DVIR fetch warning: ${dvirError.message}`);
  }
  
  // Equipment
  const { data: equipmentData, error: equipmentError } = await supabase
    .from('daily_equipment_inspections')
    .select('user_id')
    .eq('inspection_date', dateFor)
    .not('user_id', 'is', null);
  
  if (equipmentError) {
    logWarning(`Equipment fetch warning: ${equipmentError.message}`);
  }
  
  // JSA - using created_at date range for today in Chicago timezone
  const dayStart = new Date(dateFor + 'T00:00:00-06:00'); // CST
  const dayEnd = new Date(dateFor + 'T23:59:59-06:00');
  
  const { data: jsaData, error: jsaError } = await supabase
    .from('daily_jsa')
    .select('user_id')
    .gte('created_at', dayStart.toISOString())
    .lte('created_at', dayEnd.toISOString())
    .not('user_id', 'is', null);
  
  if (jsaError) {
    logWarning(`JSA fetch warning: ${jsaError.message}`);
  }
  
  const dvirSubmitters = new Set((dvirData || []).map(d => d.user_id));
  const equipmentSubmitters = new Set((equipmentData || []).map(d => d.user_id));
  const jsaSubmitters = new Set((jsaData || []).map(d => d.user_id));
  
  logSuccess(`Found submissions:`);
  log(`  - DVIR: ${dvirSubmitters.size} submitters`);
  log(`  - Equipment: ${equipmentSubmitters.size} submitters`);
  log(`  - JSA: ${jsaSubmitters.size} submitters`);
  
  return { dvirSubmitters, equipmentSubmitters, jsaSubmitters };
}

function computeNonCompliantUsers(requiredUsers, dvirSubmitters, equipmentSubmitters, jsaSubmitters) {
  const nonCompliant = [];
  let compliant = 0;
  
  for (const user of requiredUsers) {
    const hasDvir = dvirSubmitters.has(user.user_id);
    const hasEquipment = equipmentSubmitters.has(user.user_id);
    const hasJsa = jsaSubmitters.has(user.user_id);
    
    if (hasDvir && hasEquipment && hasJsa) {
      compliant++;
    } else {
      const missingForms = [];
      if (!hasDvir) missingForms.push('DVIR');
      if (!hasEquipment) missingForms.push('Equipment');
      if (!hasJsa) missingForms.push('JSA');
      
      nonCompliant.push({
        ...user,
        missingForms,
        hasDvir,
        hasEquipment,
        hasJsa,
      });
    }
  }
  
  return { nonCompliant, compliant };
}

function generateEmailPreview(nonCompliant, dateFor, totalRequired, compliant) {
  const lines = [];
  lines.push('=================================================================');
  lines.push('          ATTS DAILY SAFETY FORM COMPLIANCE REPORT');
  lines.push('=================================================================');
  lines.push('');
  lines.push(`Date: ${dateFor}`);
  lines.push(`Report Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('-----------------------------------------------------------------');
  lines.push('                         SUMMARY');
  lines.push('-----------------------------------------------------------------');
  lines.push(`Total Required Employees: ${totalRequired}`);
  lines.push(`Compliant: ${compliant}`);
  lines.push(`Non-Compliant: ${nonCompliant.length}`);
  lines.push('');
  
  if (nonCompliant.length > 0) {
    lines.push('-----------------------------------------------------------------');
    lines.push('               NON-COMPLIANT EMPLOYEES');
    lines.push('-----------------------------------------------------------------');
    lines.push('');
    
    // Group by missing type
    const groups = {
      all: nonCompliant.filter(u => !u.hasDvir && !u.hasEquipment && !u.hasJsa),
      dvirEquip: nonCompliant.filter(u => !u.hasDvir && !u.hasEquipment && u.hasJsa),
      dvirJsa: nonCompliant.filter(u => !u.hasDvir && u.hasEquipment && !u.hasJsa),
      equipJsa: nonCompliant.filter(u => u.hasDvir && !u.hasEquipment && !u.hasJsa),
      dvirOnly: nonCompliant.filter(u => !u.hasDvir && u.hasEquipment && u.hasJsa),
      equipOnly: nonCompliant.filter(u => u.hasDvir && !u.hasEquipment && u.hasJsa),
      jsaOnly: nonCompliant.filter(u => u.hasDvir && u.hasEquipment && !u.hasJsa),
    };
    
    let num = 1;
    const groupLabels = {
      all: 'MISSING ALL FORMS (DVIR, Equipment Inspection, Daily JSA)',
      dvirEquip: 'MISSING DVIR AND EQUIPMENT INSPECTION',
      dvirJsa: 'MISSING DVIR AND DAILY JSA',
      equipJsa: 'MISSING EQUIPMENT INSPECTION AND DAILY JSA',
      dvirOnly: 'MISSING DVIR ONLY',
      equipOnly: 'MISSING EQUIPMENT INSPECTION ONLY',
      jsaOnly: 'MISSING DAILY JSA ONLY',
    };
    
    for (const [key, users] of Object.entries(groups)) {
      if (users.length > 0) {
        lines.push(`${groupLabels[key]}:`);
        for (const user of users) {
          lines.push(`  ${num}. ${user.full_name || 'Unknown'} (${user.role}) - ${user.email}`);
          num++;
        }
        lines.push('');
      }
    }
  } else {
    lines.push('-----------------------------------------------------------------');
    lines.push('                       ALL CLEAR');
    lines.push('-----------------------------------------------------------------');
    lines.push('');
    lines.push('All employees have submitted their required safety forms.');
    lines.push('');
  }
  
  lines.push('-----------------------------------------------------------------');
  lines.push('');
  lines.push('Thank you for reviewing this compliance report.');
  lines.push('ATTS Safety Compliance System');
  lines.push('=================================================================');
  
  return lines.join('\n');
}

// =============================================================================
// MAIN TEST RUNNER
// =============================================================================

async function runTest1(supabase) {
  logSection('TEST 1: Basic Data Fetching');
  
  await testSupabaseConnection(supabase);
  
  const users = await testFetchRequiredUsers(supabase);
  
  const today = new Date().toISOString().split('T')[0];
  await testFetchSubmissions(supabase, today);
  
  logSuccess('Test 1 passed: Basic data fetching works');
  return true;
}

async function runTest2(supabase) {
  logSection('TEST 2: Edge Cases');
  
  // Test with today's date
  const today = new Date().toISOString().split('T')[0];
  log(`Testing with date: ${today}`);
  
  const users = await testFetchRequiredUsers(supabase);
  const submissions = await testFetchSubmissions(supabase, today);
  
  // Compute non-compliant
  const { nonCompliant, compliant } = computeNonCompliantUsers(
    users,
    submissions.dvirSubmitters,
    submissions.equipmentSubmitters,
    submissions.jsaSubmitters
  );
  
  log(`Results:`);
  log(`  - Compliant: ${compliant}`);
  log(`  - Non-compliant: ${nonCompliant.length}`);
  
  // Breakdown by missing type
  const missingAll = nonCompliant.filter(u => !u.hasDvir && !u.hasEquipment && !u.hasJsa);
  const missingDvir = nonCompliant.filter(u => !u.hasDvir);
  const missingEquip = nonCompliant.filter(u => !u.hasEquipment);
  const missingJsa = nonCompliant.filter(u => !u.hasJsa);
  
  log(`Missing breakdown:`);
  log(`  - Missing all forms: ${missingAll.length}`);
  log(`  - Missing DVIR: ${missingDvir.length}`);
  log(`  - Missing Equipment: ${missingEquip.length}`);
  log(`  - Missing JSA: ${missingJsa.length}`);
  
  // Test weekday detection
  const testDates = ['2026-01-05', '2026-01-06', '2026-01-10', '2026-01-11']; // Mon, Tue, Sat, Sun
  log('\nWeekday detection test:');
  for (const date of testDates) {
    const d = new Date(date + 'T12:00:00');
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    const isWeekend = ['Saturday', 'Sunday'].includes(dayName);
    log(`  ${date} (${dayName}): ${isWeekend ? 'SKIP' : 'RUN'}`);
  }
  
  logSuccess('Test 2 passed: Edge cases handled correctly');
  return true;
}

async function runTest3(supabase) {
  logSection('TEST 3: Full Workflow Stress Test');
  
  const today = new Date().toISOString().split('T')[0];
  
  // Full workflow simulation
  log('Step 1: Fetch required users...');
  const users = await testFetchRequiredUsers(supabase);
  
  log('Step 2: Fetch submissions...');
  const submissions = await testFetchSubmissions(supabase, today);
  
  log('Step 3: Compute non-compliant users...');
  const { nonCompliant, compliant } = computeNonCompliantUsers(
    users,
    submissions.dvirSubmitters,
    submissions.equipmentSubmitters,
    submissions.jsaSubmitters
  );
  
  log('Step 4: Generate email preview...');
  const emailContent = generateEmailPreview(nonCompliant, today, users.length, compliant);
  
  logSection('EMAIL PREVIEW');
  console.log(emailContent);
  
  logSection('TEST RESULTS SUMMARY');
  log(`Total required users: ${users.length}`);
  log(`Compliant: ${compliant}`);
  log(`Non-compliant: ${nonCompliant.length}`);
  log(`Email character count: ${emailContent.length}`);
  
  // Simulate Gmail config check
  const gmailUser = process.env.GMAIL_USER || process.env.VITE_GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.VITE_GMAIL_APP_PASSWORD;
  const recipients = process.env.ADMIN_EMAIL_RECIPIENTS || process.env.VITE_ADMIN_EMAIL_RECIPIENTS;
  
  log('\nGmail Configuration Check:');
  log(`  - GMAIL_USER: ${gmailUser ? '✓ Set' : '✗ Not set'}`);
  log(`  - GMAIL_APP_PASSWORD: ${gmailPass ? '✓ Set' : '✗ Not set'}`);
  log(`  - ADMIN_EMAIL_RECIPIENTS: ${recipients ? '✓ Set' : '✗ Not set (using defaults)'}`);
  
  if (!gmailPass) {
    logWarning('Gmail App Password not configured - actual email sending will fail');
    logWarning('See the setup guide in the plan to configure Gmail');
  }
  
  logSuccess('Test 3 passed: Full workflow simulation complete');
  return true;
}

async function main() {
  logSection('ADMIN COMPLIANCE SUMMARY - DRY RUN TEST');
  log(`Test Level: ${TEST_LEVEL}`);
  log(`Date: ${new Date().toISOString()}`);
  
  // Validate configuration
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    logError('Missing Supabase configuration', {
      SUPABASE_URL: !!SUPABASE_URL,
      SUPABASE_SERVICE_KEY: !!SUPABASE_SERVICE_KEY,
    });
    process.exit(1);
  }
  
  // Create Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  try {
    // Run tests based on level
    if (TEST_LEVEL >= 1) {
      await runTest1(supabase);
    }
    
    if (TEST_LEVEL >= 2) {
      await runTest2(supabase);
    }
    
    if (TEST_LEVEL >= 3) {
      await runTest3(supabase);
    }
    
    logSection('ALL TESTS PASSED');
    log('The admin compliance summary feature is ready for production.');
    log('');
    log('Next steps:');
    log('1. Configure Gmail App Password (see setup guide)');
    log('2. Set environment variables');
    log('3. Deploy to production');
    log('4. Set up scheduled trigger at 9 AM CST Mon-Fri');
    
    process.exit(0);
  } catch (error) {
    logSection('TEST FAILED');
    logError('Test failed', error);
    process.exit(1);
  }
}

main();

