import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { logger } from '../../lib/logger';

export interface TeamContact {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  role: string;
  avatar_url: string | null;
}

function resolveAvatarUrl(path: string | null): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl ?? null;
}

export function useTeamContactsQuery() {
  return useQuery({
    queryKey: queryKeys.teamContacts.all,
    queryFn: async (): Promise<TeamContact[]> => {
      const { data, error } = await supabase
        .from('app_users')
        .select('id, full_name, email, phone_number, role, avatar_url')
        .eq('status', 'active')
        .order('full_name', { ascending: true, nullsFirst: false });

      if (error) {
        logger.error('Failed to fetch team contacts:', error);
        throw new Error('Failed to load team contacts');
      }

      return (data ?? [])
        .filter((u) => {
          if (u.email?.endsWith('@atts.test')) return false;
          if (u.full_name?.startsWith('Test ')) return false;
          return true;
        })
        .map((user) => ({
          ...user,
          avatar_url: resolveAvatarUrl(user.avatar_url),
        }));
    },
    staleTime: 5 * 60 * 1000,
  });
}
