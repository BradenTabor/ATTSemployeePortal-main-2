import { useAuth } from '../contexts/AuthContext';

/**
 * Hook to determine if the current user can view job progress information.
 * 
 * Roles that CAN view progress: admin, general_foreman
 * Roles that CANNOT view progress: employee, foreman, safety_officer, mechanic, manager
 */
export function useCanViewJobProgress(): { canViewProgress: boolean } {
  const { role } = useAuth();
  
  // Only admin and general_foreman can view job progress
  const allowedRoles = ['admin', 'general_foreman'];
  
  const canViewProgress = role !== null && allowedRoles.includes(role);
  
  return { canViewProgress };
}

