import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { toast } from '../../lib/toast';
import { logger } from '../../lib/logger';

interface Announcement {
  id: string;
  title: string;
  message: string;
  author: string;
  date: string;
  created_at: string;
}

/**
 * Fetches all announcements
 */
export function useAnnouncementsQuery() {
  return useQuery({
    queryKey: queryKeys.announcements.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        logger.error('Failed to fetch announcements:', error);
        throw new Error('Failed to load announcements');
      }

      return data as Announcement[];
    },
  });
}

/**
 * Fetches latest announcement for dashboard
 */
export function useLatestAnnouncementQuery() {
  return useQuery({
    queryKey: queryKeys.announcements.latest,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows
        logger.error('Failed to fetch latest announcement:', error);
        throw new Error('Failed to load announcement');
      }

      return data as Announcement | null;
    },
  });
}

/**
 * Creates a new announcement
 */
export function useCreateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (announcement: Omit<Announcement, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('announcements')
        .insert(announcement)
        .select()
        .single();

      if (error) {
        throw new Error('Failed to create announcement');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all });
      toast.success('Announcement published');
    },
    onError: (error) => {
      logger.error('Failed to create announcement:', error);
      toast.error('Failed to publish announcement');
    },
  });
}

/**
 * Updates an existing announcement
 */
export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: Partial<Announcement> & { id: string }) => {
      const { error } = await supabase
        .from('announcements')
        .update(data)
        .eq('id', id);

      if (error) {
        throw new Error('Failed to update announcement');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all });
      toast.success('Announcement updated');
    },
    onError: (error) => {
      logger.error('Failed to update announcement:', error);
      toast.error('Failed to update announcement');
    },
  });
}

/**
 * Deletes an announcement
 */
export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error('Failed to delete announcement');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all });
      toast.success('Announcement deleted');
    },
    onError: (error) => {
      logger.error('Failed to delete announcement:', error);
      toast.error('Failed to delete announcement');
    },
  });
}

