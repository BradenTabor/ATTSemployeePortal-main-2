/** Test accounts seeded for E2E/RLS — must not appear in production user pickers. */
export function isTestAppUser(user: {
  email?: string | null;
  full_name?: string | null;
}): boolean {
  if (user.email?.toLowerCase().endsWith('@atts.test')) return true;
  if (user.full_name?.startsWith('Test ')) return true;
  return false;
}

/** Hide seeded test accounts outside local/dev builds. */
export function shouldHideTestUsers(): boolean {
  return import.meta.env.PROD;
}
