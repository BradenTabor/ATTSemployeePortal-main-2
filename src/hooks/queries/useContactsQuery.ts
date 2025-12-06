import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { toast } from '../../lib/toast';
import { logger } from '../../lib/logger';

export interface ContactRequest {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  submitted_at: string;
}

interface UseContactsOptions {
  topic?: string;
  limit?: number;
}

/**
 * Fetch contact requests
 * This will appear in DevTools as ['contacts', 'list', {...}]
 */
export function useContactsQuery(options: UseContactsOptions = {}) {
  const { topic, limit = 10 } = options;

  return useQuery({
    queryKey: queryKeys.contactRequests.list({ topic }),
    queryFn: async (): Promise<ContactRequest[]> => {
      let query = supabase
        .from('contact_requests')
        .select('id, name, email, topic, message, submitted_at')
        .order('submitted_at', { ascending: false })
        .limit(limit);

      if (topic && topic !== 'all') {
        query = query.eq('topic', topic);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch contact requests:', error);
        throw new Error('Failed to load contact requests');
      }

      return data || [];
    },
  });
}

/**
 * Create a new contact request
 */
export function useCreateContactRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contact: Omit<ContactRequest, 'id' | 'submitted_at'>) => {
      const { data, error } = await supabase
        .from('contact_requests')
        .insert(contact)
        .select()
        .single();

      if (error) {
        throw new Error('Failed to submit contact request');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contactRequests.all });
      toast.success('Contact request submitted');
    },
    onError: (error) => {
      logger.error('Failed to submit contact request:', error);
      toast.error('Failed to submit contact request');
    },
  });
}

