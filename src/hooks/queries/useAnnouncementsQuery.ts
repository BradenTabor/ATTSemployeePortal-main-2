import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { toast } from '../../lib/toast';
import { logger } from '../../lib/logger';
import { NotificationBuilders, createNotificationSilent } from '../../lib/pushNotifications';

export interface Announcement {
  id: string;
  title: string;
  message: string;
  author: string;
  date: string;
  created_at: string;
}

/**
 * Fetches announcements with optional limit
 * @param limit - Optional number of announcements to fetch (defaults to all)
 */
export function useAnnouncementsQuery(limit?: number) {
  return useQuery({
    queryKey: limit
      ? [...queryKeys.announcements.all, { limit }]
      : queryKeys.announcements.all,
    queryFn: async () => {
      let query = supabase
        .from('announcements')
        .select('*')
        .order('date', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

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
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all });
      
      // Send notification to all users (non-blocking)
      logger.info('[Announcements] Sending push notification for new announcement:', data.title);
      
      const notificationResult = await createNotificationSilent(
        NotificationBuilders.announcement({
          title: data.title,
          message: data.message,
        })
      );
      
      if (notificationResult) {
        logger.info('[Announcements] ✅ Create notification sent:', notificationResult);
        toast.success(`Announcement published and sent to ${notificationResult.dispatched} users!`);
      } else {
        logger.warn('[Announcements] ⚠️ Create notification failed silently');
        toast.success('Announcement published');
      }
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
      ...updates
    }: Partial<Announcement> & { id: string }) => {
      // Debug trace for announcement update
      logger.debug('[useAnnouncementsQuery] UPDATE: Attempting update', { id, updates });
      
      // Only include fields that exist in the table
      const updatePayload: Record<string, unknown> = {};
      if (updates.title !== undefined) updatePayload.title = updates.title;
      if (updates.message !== undefined) updatePayload.message = updates.message;
      if (updates.author !== undefined) updatePayload.author = updates.author;
      if (updates.date !== undefined) updatePayload.date = updates.date;
      
      const { data: result, error } = await supabase
        .from('announcements')
        .update(updatePayload)
        .eq('id', id)
        .select();

      if (error) {
        logger.error('[useAnnouncementsQuery] UPDATE failed:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(`Failed to update announcement: ${error.message}`);
      }
      
      return result;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all });
      
      // Send notification to all users about the updated announcement (non-blocking)
      if (data && data.length > 0) {
        const updatedAnnouncement = data[0];
        logger.info('[Announcements] Sending push notification for updated announcement:', updatedAnnouncement.title);
        
        const notificationResult = await createNotificationSilent(
          NotificationBuilders.announcement({
            title: `Updated: ${updatedAnnouncement.title}`,
            message: updatedAnnouncement.message,
          })
        );
        
        if (notificationResult) {
          logger.info('[Announcements] ✅ Update notification sent:', notificationResult);
          toast.success(`Announcement updated and sent to ${notificationResult.dispatched} users!`);
        } else {
          logger.warn('[Announcements] ⚠️ Update notification failed silently');
          toast.success('Announcement updated');
        }
      } else {
        toast.success('Announcement updated');
      }
    },
    onError: (error) => {
      logger.error('🔧 UPDATE MUTATION ERROR:', error);
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

