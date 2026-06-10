import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { toast } from '../../lib/toast';
import { logger } from '../../lib/logger';
import { isTestAppUser, shouldHideTestUsers } from '../../lib/testUsers';

interface User {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
}

interface UseUsersOptions {
  role?: string;
  search?: string;
  /** Defaults to true in production builds. */
  excludeTestUsers?: boolean;
}

/**
 * Fetches all users from app_users
 */
export function useUsersQuery(options?: UseUsersOptions) {
  return useQuery({
    queryKey: queryKeys.users.list(options),
    queryFn: async () => {
      let query = supabase
        .from('app_users')
        .select('id, user_id, email, full_name, role, created_at')
        .order('created_at', { ascending: false });

      if (options?.role) {
        query = query.eq('role', options.role);
      }

      if (options?.search) {
        query = query.ilike('email', `%${options.search}%`);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch users:', error);
        throw new Error('Failed to load users');
      }

      const excludeTestUsers = options?.excludeTestUsers ?? shouldHideTestUsers();
      const users = (data ?? []) as User[];

      return excludeTestUsers ? users.filter((u) => !isTestAppUser(u)) : users;
    },
  });
}

/**
 * Fetches a single user by ID
 */
export function useUserQuery(userId: string) {
  return useQuery({
    queryKey: queryKeys.users.detail(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_users')
        .select('id, user_id, email, full_name, role, created_at')
        .eq('user_id', userId)
        .single();

      if (error) {
        logger.error('Failed to fetch user:', error);
        throw new Error('Failed to load user');
      }

      return data as User;
    },
    enabled: !!userId,
  });
}

/**
 * Updates a user's role
 */
export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase
        .from('app_users')
        .update({ role })
        .eq('user_id', userId);

      if (error) {
        throw new Error('Failed to update role');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      toast.success('User role updated');
    },
    onError: (error) => {
      logger.error('Failed to update user role:', error);
      toast.error('Failed to update role');
    },
  });
}

/**
 * Deletes a user
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('app_users')
        .delete()
        .eq('user_id', userId);

      if (error) {
        throw new Error('Failed to delete user');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      toast.success('User deleted');
    },
    onError: (error) => {
      logger.error('Failed to delete user:', error);
      toast.error('Failed to delete user');
    },
  });
}

