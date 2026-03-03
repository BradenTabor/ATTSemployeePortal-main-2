/**
 * useCorrectiveActions - React Query hooks for CAPA (Corrective Action) tracking
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import type { CorrectiveAction, ActionType, ActionStatus } from '../../types/correctiveAction';
import { isBefore, parseISO } from 'date-fns';

function toCorrectiveAction(row: Record<string, unknown>): CorrectiveAction {
  const dueDate = (row.due_date as string) ?? '';
  const status = (row.status as ActionStatus) ?? 'open';
  const isOverdue = Boolean(
    status !== 'completed' &&
      status !== 'verified' &&
      dueDate &&
      isBefore(parseISO(dueDate), new Date())
  );

  return {
    id: row.id as string,
    incident_id: row.incident_id as string,
    description: row.description as string,
    action_type: row.action_type as ActionType,
    assigned_to: (row.assigned_to as string) ?? null,
    assigned_to_name: row.assigned_to_name as string | undefined,
    assigned_by: row.assigned_by as string,
    assigned_by_name: row.assigned_by_name as string | undefined,
    due_date: dueDate,
    status,
    completed_at: (row.completed_at as string) ?? null,
    completion_notes: (row.completion_notes as string) ?? null,
    verified_by: (row.verified_by as string) ?? null,
    verified_at: (row.verified_at as string) ?? null,
    verification_notes: (row.verification_notes as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    is_overdue: isOverdue,
  };
}

export function useCorrectiveActions(incidentId?: string | null) {
  return useQuery({
    queryKey: incidentId ? queryKeys.correctiveActions.byIncident(incidentId) : queryKeys.correctiveActions.all,
    queryFn: async () => {
      let q = supabase
        .from('corrective_actions')
        .select('*')
        .order('due_date', { ascending: true });

      if (incidentId) {
        q = q.eq('incident_id', incidentId);
      }

      const { data, error } = await q;

      if (error) throw new Error(error.message);

      const rows = (data ?? []) as Record<string, unknown>[];
      return rows.map(toCorrectiveAction);
    },
    enabled: true,
  });
}

export function useOpenCorrectiveActions() {
  return useQuery({
    queryKey: queryKeys.correctiveActions.open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corrective_actions')
        .select('*')
        .in('status', ['open', 'in_progress', 'overdue'])
        .order('due_date', { ascending: true });

      if (error) throw new Error(error.message);

      const rows = (data ?? []) as Record<string, unknown>[];
      return rows.map(toCorrectiveAction);
    },
  });
}

export interface CreateCorrectiveActionInput {
  incident_id?: string | null;
  description: string;
  action_type: ActionType;
  assigned_to?: string | null;
  assigned_by: string;
  due_date: string;
  completion_notes?: string | null;
}

export function useCreateCorrectiveAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCorrectiveActionInput) => {
      const { data, error } = await supabase
        .from('corrective_actions')
        .insert({
          incident_id: input.incident_id ?? null,
          description: input.description,
          action_type: input.action_type,
          assigned_to: input.assigned_to ?? null,
          assigned_by: input.assigned_by,
          due_date: input.due_date,
          status: 'open',
          completion_notes: input.completion_notes ?? null,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return toCorrectiveAction(data as Record<string, unknown>);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.correctiveActions.all });
      if (data.incident_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.correctiveActions.byIncident(data.incident_id),
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.correctiveActions.open });
    },
  });
}

export function useUpdateCorrectiveActionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      completion_notes,
    }: {
      id: string;
      status: ActionStatus;
      completion_notes?: string | null;
    }) => {
      const updates: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
        updates.completion_notes = completion_notes ?? null;
      }

      const { data, error } = await supabase
        .from('corrective_actions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return toCorrectiveAction(data as Record<string, unknown>);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.correctiveActions.all });
      if (data.incident_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.correctiveActions.byIncident(data.incident_id),
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.correctiveActions.open });
    },
  });
}

export function useVerifyCorrectiveAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      verified_by,
      verification_notes,
    }: {
      id: string;
      verified_by: string;
      verification_notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('corrective_actions')
        .update({
          status: 'verified',
          verified_by,
          verified_at: new Date().toISOString(),
          verification_notes: verification_notes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return toCorrectiveAction(data as Record<string, unknown>);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.correctiveActions.all });
      if (data.incident_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.correctiveActions.byIncident(data.incident_id),
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.correctiveActions.open });
    },
  });
}
