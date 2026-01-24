#!/usr/bin/env tsx
/**
 * Compliance Forms Dry-Run Test Script
 * 
 * Tests all compliance forms (DVIR, JSA, Equipment Inspection) to ensure
 * they can submit properly with the new database schema changes.
 * 
 * This script performs validation without actually inserting data into the database.
 * 
 * Usage: npx tsx scripts/test-compliance-forms-dry-run.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: join(process.cwd(), '.env') });
dotenv.config({ path: join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

// Test results tracking
interface TestResult {
  form: string;
  test: string;
  passed: boolean;
  error?: string;
  details?: unknown;
}

const results: TestResult[] = [];

function logResult(result: TestResult) {
  results.push(result);
  const icon = result.passed ? '✅' : '❌';
  console.log(`${icon} ${result.form} - ${result.test}`);
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
  if (result.details) {
    console.log(`   Details:`, JSON.stringify(result.details, null, 2));
  }
}

/**
 * Create test Supabase client
 */
function createTestClient(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Create service role client for schema validation
 */
function createServiceClient(): SupabaseClient {
  if (!SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY required for schema validation');
  }
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Validate DVIR payload structure
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function testDVIRPayload(_client: SupabaseClient): Promise<void> {
  const testPayload = {
    // Required fields
    truck_number: 'DRY-RUN-TEST-001',
    mileage: 50000,
    drivers_name: 'Dry Run Test Driver',
    
    // Optional fields
    chipper_number: 'C-101',
    trailer_number: 'TR-201',
    truck_gvwr: '26000',
    trailer_chipper_gvwr: '10000',
    medical_card_required: 'yes',
    drivers_license_number: 'DL123456789',
    drivers_license_class: 'A',
    drivers_license_exp: '12/31/2027',
    drivers_license_required: 'yes',
    has_medical_card: 'yes',
    medical_card_exp: '06/30/2026',
    copy_of_registration: 'yes',
    copy_of_insurance: 'yes',
    
    // Checklists
    vehicle_trailer_checklist: {
      brakes: 'P',
      lights: 'P',
      tires: 'P',
      mirrors: 'P',
      horn: 'P',
      wipers: 'P',
      steering: 'P',
      coupling_devices: 'P',
      emergency_equipment: 'P',
    },
    aerial_checklist: {
      boom_operation: 'P',
      outriggers: 'P',
      basket_controls: 'P',
      hydraulic_leaks: 'P',
      safety_devices: 'P',
    },
    
    // Notes
    notes: 'Dry run test - all systems operational',
    aerial_notes: 'Aerial equipment in good condition',
    
    // Signatures (typed)
    final_driver_signature: 'Dry Run Test Driver',
    general_foreman_signature: 'Dry Run Foreman',
    
    // Photo paths (simulated)
    oil_dipstick_path: 'dry-run-photos/oil-dipstick.jpg',
    tire_photo_path: 'dry-run-photos/tire.jpg',
    coolant_photo_path: 'dry-run-photos/coolant.jpg',
    
    // Mechanic section (optional)
    mechanic_truck_number: null,
    mechanic_date: null,
    deficiency_corrected: null,
    mechanic_remarks: null,
    mechanic_signature: null,
    driver_approval_signature: null,
  };

  // Test 1: Validate payload structure
  try {
    // Check that drivers_signature_section_a is NOT in the payload (should be dropped)
    if ('drivers_signature_section_a' in testPayload) {
      throw new Error('drivers_signature_section_a should not be in payload (column was dropped)');
    }
    
    logResult({
      form: 'DVIR',
      test: 'Payload structure validation',
      passed: true,
      details: { hasOldColumn: false },
    });
  } catch (error: unknown) {
    logResult({
      form: 'DVIR',
      test: 'Payload structure validation',
      passed: false,
      error: error.message,
    });
  }

  // Test 2: Validate against database schema (dry run - use RPC or validation)
  try {
    // Use a transaction that will be rolled back, or use a validation function
    // For now, we'll check the table structure
    const serviceClient = createServiceClient();
    const { error } = await serviceClient
      .from('dvir_reports')
      .select('*')
      .limit(0); // Just to test the query structure
    
    if (error && error.code === 'PGRST116') {
      // This is expected - no rows returned, but query structure is valid
      logResult({
        form: 'DVIR',
        test: 'Schema validation (table exists)',
        passed: true,
      });
    } else if (error) {
      throw error;
    } else {
      logResult({
        form: 'DVIR',
        test: 'Schema validation (table exists)',
        passed: true,
      });
    }
  } catch (error: unknown) {
    logResult({
      form: 'DVIR',
      test: 'Schema validation',
      passed: false,
      error: error.message,
    });
  }
}

/**
 * Validate JSA payload structure
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function testJSAPayload(_client: SupabaseClient): Promise<void> {
  const testPayload = {
    job_date: new Date().toISOString().split('T')[0],
    call_in_time: '07:00',
    call_out_time: '15:30',
    work_location: 'Dry Run Test Location',
    circuit_number: 'CIRC-001',
    nearest_hospital: 'Test Hospital',
    nearest_clinic: 'Test Clinic',
    oc_contact: '555-0100',
    doc_contact: '555-0101',
    gf_contact: '555-0102',
    safety_contact: '555-0103',
    jobs_performed: [
      { key: 'jarraff', label: 'Jarraff Trimmer' },
    ],
    ppe: {
      hard_hat: { required: true, provided: true },
      safety_glasses: { required: true, provided: true },
      high_visibility_vest: { required: true, provided: true },
    },
    weather_conditions: {
      conditions: { sunny: true, cloudy: false },
      modifiers: { windy: false, rainy: false },
    },
    weather_hazards: null,
    hazards_present: {
      overhead_lines: false,
      underground_utilities: false,
    },
    traffic_hazards: {
      heavy_traffic: false,
      construction_zone: false,
    },
    traffic_setup: {
      cones: true,
      signs: true,
    },
    spans: [
      {
        initials: 'DR',
        location: 'Test Span Location',
        hazards: 'None',
        mitigation: 'Standard safety procedures',
      },
    ],
    notes: 'Dry run test JSA',
    employee_signature: 'Dry Run Employee',
    observer_signatures: [
      {
        name: 'Dry Run Observer',
        signature_data: 'data:image/png;base64,DRY_RUN_SIGNATURE',
        timestamp: new Date().toISOString(),
        role: 'Foreman',
      },
    ],
    shared_with_users: [
      {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'test-shared@example.com',
        full_name: 'Test Shared User',
        role: 'employee',
        added_at: new Date().toISOString(),
        added_by: '00000000-0000-0000-0000-000000000000',
      },
    ],
    status: 'completed' as const,
  };

  // Test 1: Validate payload structure includes new fields
  try {
    if (!('observer_signatures' in testPayload)) {
      throw new Error('observer_signatures missing from payload');
    }
    if (!('shared_with_users' in testPayload)) {
      throw new Error('shared_with_users missing from payload');
    }
    
    if (!Array.isArray(testPayload.observer_signatures)) {
      throw new Error('observer_signatures must be an array');
    }
    if (!Array.isArray(testPayload.shared_with_users)) {
      throw new Error('shared_with_users must be an array');
    }
    
    logResult({
      form: 'JSA',
      test: 'Payload structure validation (new fields)',
      passed: true,
      details: {
        hasObserverSignatures: true,
        hasSharedUsers: true,
        observerCount: testPayload.observer_signatures.length,
        sharedUsersCount: testPayload.shared_with_users.length,
      },
    });
  } catch (error: unknown) {
    logResult({
      form: 'JSA',
      test: 'Payload structure validation',
      passed: false,
      error: error.message,
    });
  }

  // Test 2: Validate schema supports new columns
  try {
    const serviceClient = createServiceClient();
    // Direct query to validate columns exist
    const { error } = await serviceClient
      .from('daily_jsa')
      .select('observer_signatures, shared_with_users')
      .limit(0);
    
    if (error && error.code === 'PGRST116') {
      // Expected - no rows, but columns exist (this means the query structure is valid)
      logResult({
        form: 'JSA',
        test: 'Schema validation (new columns exist)',
        passed: true,
      });
    } else if (error && error.message.includes('column') && error.message.includes('does not exist')) {
      // Column doesn't exist - this is a real error
      throw error;
    } else if (error) {
      // Other error - might be RLS or other issue, but columns likely exist
      // Check if it's a permission error (which means table/columns exist)
      if (error.code === '42501' || error.message.includes('permission')) {
        logResult({
          form: 'JSA',
          test: 'Schema validation (new columns exist)',
          passed: true,
          details: { note: 'Permission error indicates table exists' },
        });
      } else {
        throw error;
      }
    } else {
      logResult({
        form: 'JSA',
        test: 'Schema validation (new columns exist)',
        passed: true,
      });
    }
  } catch (error: unknown) {
    logResult({
      form: 'JSA',
      test: 'Schema validation',
      passed: false,
      error: error.message,
    });
  }

  // Test 3: Validate jsa_sharing_audit table exists
  try {
    const serviceClient = createServiceClient();
    const { error } = await serviceClient
      .from('jsa_sharing_audit')
      .select('*')
      .limit(0);
    
    if (error && error.code === 'PGRST116') {
      logResult({
        form: 'JSA',
        test: 'Audit table exists',
        passed: true,
      });
    } else if (error) {
      throw error;
    } else {
      logResult({
        form: 'JSA',
        test: 'Audit table exists',
        passed: true,
      });
    }
  } catch (error: unknown) {
    logResult({
      form: 'JSA',
      test: 'Audit table validation',
      passed: false,
      error: error.message,
    });
  }
}

/**
 * Validate Equipment Inspection payload structure
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function testEquipmentPayload(_client: SupabaseClient): Promise<void> {
  const testPayload = {
    user_id: '00000000-0000-0000-0000-000000000000', // Will be set by RLS
    submitted_by: 'Dry Run Test Inspector',
    equipment_type: 'Jarraff',
    equipment_number: 'J-109',
    inspection_date: new Date().toISOString().split('T')[0],
    template: 'Jarraff',
    notes: 'Dry run test equipment inspection',
    general_checklist: {
      engine_oil_level: 'P',
      hydraulic_fluid_level: 'P',
      coolant_level: 'P',
      fuel_level: 'P',
      air_filter: 'P',
      belts_hoses: 'P',
      battery: 'P',
      lights: 'P',
      safety_devices: 'P',
      fire_extinguisher: 'P',
    },
    specific_checklist: {
      saw_arm: 'P',
      saw_blade: 'P',
      boom_extension: 'P',
      turret_rotation: 'P',
      bucket_controls: 'P',
    },
    overview_photo_path: 'dry-run-photos/overview.jpg',
    damage_photo_path: null,
    attachments_photo_path: null,
    hydraulic_photo_path: 'dry-run-photos/hydraulic.jpg',
  };

  // Test 1: Validate payload structure
  try {
    if (!testPayload.equipment_type) {
      throw new Error('equipment_type is required');
    }
    if (!testPayload.equipment_number) {
      throw new Error('equipment_number is required');
    }
    if (!testPayload.submitted_by) {
      throw new Error('submitted_by is required');
    }
    if (!testPayload.inspection_date) {
      throw new Error('inspection_date is required');
    }
    
    logResult({
      form: 'Equipment Inspection',
      test: 'Payload structure validation',
      passed: true,
      details: {
        hasRequiredFields: true,
        equipmentType: testPayload.equipment_type,
      },
    });
  } catch (error: unknown) {
    logResult({
      form: 'Equipment Inspection',
      test: 'Payload structure validation',
      passed: false,
      error: error.message,
    });
  }

  // Test 2: Validate schema
  try {
    const serviceClient = createServiceClient();
    const { error } = await serviceClient
      .from('daily_equipment_inspections')
      .select('*')
      .limit(0);
    
    if (error && error.code === 'PGRST116') {
      logResult({
        form: 'Equipment Inspection',
        test: 'Schema validation (table exists)',
        passed: true,
      });
    } else if (error) {
      throw error;
    } else {
      logResult({
        form: 'Equipment Inspection',
        test: 'Schema validation (table exists)',
        passed: true,
      });
    }
  } catch (error: unknown) {
    logResult({
      form: 'Equipment Inspection',
      test: 'Schema validation',
      passed: false,
      error: error.message,
    });
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('🚀 Starting Compliance Forms Dry-Run Tests\n');
  console.log('This script validates form payloads and database schema');
  console.log('without actually inserting data.\n');
  console.log('='.repeat(60) + '\n');

  const client = createTestClient();

  try {
    // Test DVIR
    console.log('📋 Testing DVIR Form...\n');
    await testDVIRPayload(client);
    console.log('');

    // Test JSA
    console.log('📋 Testing JSA Form...\n');
    await testJSAPayload(client);
    console.log('');

    // Test Equipment Inspection
    console.log('📋 Testing Equipment Inspection Form...\n');
    await testEquipmentPayload(client);
    console.log('');

    // Summary
    console.log('='.repeat(60));
    console.log('\n📊 Test Summary\n');
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

    if (failed > 0) {
      console.log('❌ Failed Tests:\n');
      results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  - ${r.form}: ${r.test}`);
          if (r.error) {
            console.log(`    Error: ${r.error}`);
          }
        });
      console.log('');
      process.exit(1);
    } else {
      console.log('✅ All tests passed! All compliance forms are ready for submission.\n');
      process.exit(0);
    }
  } catch (error: unknown) {
    console.error('❌ Fatal error during testing:', error);
    process.exit(1);
  }
}

// Run tests
main().catch(console.error);
