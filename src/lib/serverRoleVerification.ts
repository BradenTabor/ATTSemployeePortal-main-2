/**
 * Server-Side Role Verification Helper (SEC-004)
 * 
 * Provides utilities for server-side role verification to complement
 * client-side checks. Note that RLS policies provide the primary server-side
 * protection, but this helper can be used for explicit verification when needed.
 * 
 * IMPORTANT: RLS policies are the primary security mechanism. Client-side
 * role checks are for UX only (showing/hiding UI elements). All data access
 * is protected by RLS policies which cannot be bypassed by client manipulation.
 */

import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { logger, redactUserId } from './logger';

/**
 * Verify user has admin role via server-side query
 * Uses RLS-protected query - if RLS blocks access, user is not admin
 * 
 * @param userId - User ID to verify
 * @returns Promise<boolean> - true if user is admin, false otherwise
 */
export async function verifyAdminRole(userId: string): Promise<boolean> {
  try {
    // Query app_users with RLS - if user can read their own role and it's 'admin', return true
    // If RLS blocks or role is not admin, return false
    const { data, error } = await supabase
      .from('app_users')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      logger.warn(`[ServerRoleVerification] Failed to verify admin role for ${redactUserId(userId)}:`, error?.message);
      return false;
    }

    const isAdmin = data.role === 'admin';
    
    if (!isAdmin) {
      logger.debug(`[ServerRoleVerification] User ${redactUserId(userId)} is not admin (role: ${data.role})`);
    }

    return isAdmin;
  } catch (error) {
    logger.error(`[ServerRoleVerification] Error verifying admin role for ${redactUserId(userId)}:`, error);
    return false;
  }
}

/**
 * Verify user has one of the specified roles via server-side query
 * 
 * @param userId - User ID to verify
 * @param allowedRoles - Array of allowed roles
 * @returns Promise<boolean> - true if user has one of the allowed roles
 */
export async function verifyUserRole(
  userId: string,
  allowedRoles: string[]
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('app_users')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      logger.warn(`[ServerRoleVerification] Failed to verify role for ${redactUserId(userId)}:`, error?.message);
      return false;
    }

    const hasRole = allowedRoles.includes(data.role || '');
    
    if (!hasRole) {
      logger.debug(`[ServerRoleVerification] User ${redactUserId(userId)} does not have required role (has: ${data.role}, required: ${allowedRoles.join(', ')})`);
    }

    return hasRole;
  } catch (error) {
    logger.error(`[ServerRoleVerification] Error verifying role for ${redactUserId(userId)}:`, error);
    return false;
  }
}

/**
 * React hook for server-side role verification
 * Use this for critical operations that need explicit server-side verification
 * 
 * @param userId - User ID to verify
 * @param requiredRole - Required role (or 'admin' for admin access)
 * @returns Object with { isAuthorized, loading, error }
 */
export function useServerRoleVerification(
  userId: string | null | undefined,
  requiredRole: 'admin' | string[]
): { isAuthorized: boolean; loading: boolean; error: string | null } {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const verify = async () => {
      try {
        const allowedRoles = requiredRole === 'admin' ? ['admin'] : requiredRole;
        const authorized = await verifyUserRole(userId, allowedRoles);
        setIsAuthorized(authorized);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Verification failed');
        setIsAuthorized(false);
      } finally {
        setLoading(false);
      }
    };

    void verify();
  }, [userId, requiredRole]);

  return { isAuthorized, loading, error };
}
