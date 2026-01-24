/**
 * Extract initials from name or email
 * @param name - User's full name
 * @param email - User's email (fallback if name not provided)
 * @returns Two-letter uppercase initials
 */
export function getInitials(
  name: string | null | undefined,
  email: string | null | undefined
): string {
  if (name && name.trim()) {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  
  if (email) {
    const localPart = email.split('@')[0];
    return localPart.slice(0, 2).toUpperCase();
  }
  
  return '?';
}
