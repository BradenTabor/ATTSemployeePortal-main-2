/**
 * Test Supabase Client
 * 
 * Creates a Supabase client for testing with proper isolation.
 * Uses test environment variables and provides helper functions
 * for test data setup and teardown.
 */
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

// Test environment configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Test user credentials - these should be seeded in the test database
export const TEST_USERS = {
  employee: {
    email: 'test-employee@atts.test',
    password: 'TestPassword123!',
    role: 'employee' as const,
  },
  foreman: {
    email: 'test-foreman@atts.test',
    password: 'TestPassword123!',
    role: 'foreman' as const,
  },
  mechanic: {
    email: 'test-mechanic@atts.test',
    password: 'TestPassword123!',
    role: 'mechanic' as const,
  },
  general_foreman: {
    email: 'test-gf@atts.test',
    password: 'TestPassword123!',
    role: 'general_foreman' as const,
  },
  admin: {
    email: 'test-admin@atts.test',
    password: 'TestPassword123!',
    role: 'admin' as const,
  },
} as const;

export type TestUserRole = keyof typeof TEST_USERS;

/**
 * Create a Supabase client for testing
 */
export function createTestClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase test environment variables');
  }
  
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Create a Supabase client with service role for admin operations
 */
export function createServiceClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Missing Supabase service role key for test setup');
  }
  
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Sign in as a test user
 */
export async function signInAsTestUser(
  client: SupabaseClient,
  role: TestUserRole
): Promise<User> {
  const testUser = TEST_USERS[role];
  
  const { data, error } = await client.auth.signInWithPassword({
    email: testUser.email,
    password: testUser.password,
  });
  
  if (error) {
    throw new Error(`Failed to sign in as ${role}: ${error.message}`);
  }
  
  if (!data.user) {
    throw new Error(`No user returned for ${role}`);
  }
  
  return data.user;
}

/**
 * Sign out the current user
 */
export async function signOut(client: SupabaseClient): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) {
    throw new Error(`Failed to sign out: ${error.message}`);
  }
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser(client: SupabaseClient): Promise<User | null> {
  const { data: { user } } = await client.auth.getUser();
  return user;
}

/**
 * Clean up test data from tables
 * Should be called in afterEach or afterAll hooks
 */
export async function cleanupTestData(
  serviceClient: SupabaseClient,
  options: {
    dvir?: boolean;
    jsa?: boolean;
    equipment?: boolean;
    testPrefix?: string;
  } = {}
): Promise<void> {
  const { dvir = true, jsa = true, equipment = true, testPrefix = 'TEST-' } = options;
  
  if (dvir) {
    await serviceClient
      .from('dvir_reports')
      .delete()
      .like('truck_number', `${testPrefix}%`);
  }
  
  if (jsa) {
    await serviceClient
      .from('daily_jsa')
      .delete()
      .like('work_location', `%Test%`);
  }
  
  if (equipment) {
    await serviceClient
      .from('daily_equipment_inspections')
      .delete()
      .like('submitted_by', `%Test%`);
  }
}

/**
 * Clean up test photos from storage buckets
 */
export async function cleanupTestPhotos(
  serviceClient: SupabaseClient,
  bucket: 'dvir-photos' | 'equipment-inspection-photos',
  prefix: string = 'test-'
): Promise<void> {
  const { data: files, error } = await serviceClient.storage
    .from(bucket)
    .list(prefix);
  
  if (error) {
    console.warn(`Failed to list test photos in ${bucket}: ${error.message}`);
    return;
  }
  
  if (files && files.length > 0) {
    const paths = files.map(f => `${prefix}${f.name}`);
    await serviceClient.storage.from(bucket).remove(paths);
  }
}

/**
 * Wait for a condition to be true (useful for async operations)
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
}
