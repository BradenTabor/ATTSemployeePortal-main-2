/**
 * Role-based navigation utilities.
 * Centralizes role → dashboard path mapping for consistent navigation.
 */

/**
 * Get the appropriate dashboard route for a user's role.
 *
 * @param role - User's role from AuthContext (can be null/undefined)
 * @returns Dashboard path for the role
 *
 * @example
 * ```ts
 * const { role } = useAuth();
 * navigate(getRoleDashboard(role)); // foreman → /foreman-dashboard
 * ```
 */
export function getRoleDashboard(role: string | null | undefined): string {
  if (!role) return '/dashboard';

  switch (role) {
    case 'admin':
      return '/admin';
    case 'mechanic':
      return '/mechanic-dashboard';
    case 'general_foreman':
      return '/general-foreman-dashboard';
    case 'safety_officer':
      return '/safety-officer-dashboard';
    case 'foreman':
      return '/foreman-dashboard';
    default:
      return '/dashboard';
  }
}
