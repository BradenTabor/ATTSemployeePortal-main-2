/**
 * Seed Test Users Script
 * 
 * Creates test users in Supabase Auth and app_users table.
 * Run this before executing tests to set up the test environment.
 * 
 * Usage: npx tsx tests/setup/seedTestUsers.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

// Load .env from project root (Node/tsx don't load it automatically)
config({ path: join(process.cwd(), '.env') });
config({ path: join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables:');
  console.error('- VITE_SUPABASE_URL or SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface TestUser {
  email: string;
  password: string;
  fullName: string;
  role: 'employee' | 'foreman' | 'mechanic' | 'general_foreman' | 'admin';
}

const TEST_USERS: TestUser[] = [
  {
    email: 'test-employee@atts.test',
    password: 'TestPassword123!',
    fullName: 'Test Employee',
    role: 'employee',
  },
  {
    email: 'test-foreman@atts.test',
    password: 'TestPassword123!',
    fullName: 'Test Foreman',
    role: 'foreman',
  },
  {
    email: 'test-mechanic@atts.test',
    password: 'TestPassword123!',
    fullName: 'Test Mechanic',
    role: 'mechanic',
  },
  {
    email: 'test-gf@atts.test',
    password: 'TestPassword123!',
    fullName: 'Test General Foreman',
    role: 'general_foreman',
  },
  {
    email: 'test-admin@atts.test',
    password: 'TestPassword123!',
    fullName: 'Test Admin',
    role: 'admin',
  },
];

async function createAuthUser(user: TestUser): Promise<string | null> {
  console.log(`Creating auth user: ${user.email}...`);
  
  // Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(u => u.email === user.email);
  
  if (existingUser) {
    console.log(`  User ${user.email} already exists (${existingUser.id})`);
    return existingUser.id;
  }
  
  // Create new user
  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true, // Auto-confirm email for testing
    user_metadata: {
      full_name: user.fullName,
    },
  });
  
  if (error) {
    console.error(`  Error creating user ${user.email}:`, error.message);
    return null;
  }
  
  console.log(`  Created user ${user.email} (${data.user.id})`);
  return data.user.id;
}

async function createAppUser(userId: string, user: TestUser): Promise<boolean> {
  console.log(`Creating app_users entry for: ${user.email}...`);
  
  const { error } = await supabase
    .from('app_users')
    .upsert({
      user_id: userId,
      email: user.email,
      full_name: user.fullName,
      role: user.role,
    }, {
      onConflict: 'user_id',
    });
  
  if (error) {
    console.error(`  Error creating app_users entry for ${user.email}:`, error.message);
    return false;
  }
  
  console.log(`  Created app_users entry for ${user.email} with role: ${user.role}`);
  return true;
}

async function seedTestUsers(): Promise<void> {
  console.log('='.repeat(60));
  console.log('SEEDING TEST USERS');
  console.log('='.repeat(60));
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log('');
  
  const results: { email: string; success: boolean; userId?: string }[] = [];
  
  for (const user of TEST_USERS) {
    const userId = await createAuthUser(user);
    
    if (userId) {
      const appUserSuccess = await createAppUser(userId, user);
      results.push({ email: user.email, success: appUserSuccess, userId });
    } else {
      results.push({ email: user.email, success: false });
    }
    
    console.log('');
  }
  
  console.log('='.repeat(60));
  console.log('SEED RESULTS');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`Successful: ${successful.length}/${results.length}`);
  successful.forEach(r => {
    console.log(`  ✓ ${r.email} (${r.userId})`);
  });
  
  if (failed.length > 0) {
    console.log(`Failed: ${failed.length}/${results.length}`);
    failed.forEach(r => {
      console.log(`  ✗ ${r.email}`);
    });
  }
  
  console.log('');
  console.log('='.repeat(60));
  
  if (failed.length > 0) {
    process.exit(1);
  }
}

async function cleanupTestUsers(): Promise<void> {
  console.log('='.repeat(60));
  console.log('CLEANING UP TEST USERS');
  console.log('='.repeat(60));
  
  // Delete from app_users first (due to foreign key)
  const { error: appUsersError } = await supabase
    .from('app_users')
    .delete()
    .ilike('email', '%@atts.test');
  
  if (appUsersError) {
    console.error('Error deleting from app_users:', appUsersError.message);
  } else {
    console.log('Deleted test users from app_users');
  }
  
  // Delete from auth.users
  const { data: users } = await supabase.auth.admin.listUsers();
  const testUsers = users?.users?.filter(u => u.email?.endsWith('@atts.test')) || [];
  
  for (const user of testUsers) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) {
      console.error(`Error deleting auth user ${user.email}:`, error.message);
    } else {
      console.log(`Deleted auth user: ${user.email}`);
    }
  }
  
  console.log('');
  console.log('Cleanup complete');
}

// CLI handling
const args = process.argv.slice(2);

if (args.includes('--cleanup')) {
  cleanupTestUsers().catch(console.error);
} else {
  seedTestUsers().catch(console.error);
}
