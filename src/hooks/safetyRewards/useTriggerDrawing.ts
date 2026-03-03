import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { logger } from '../../lib/logger';

interface TriggerDrawingInput {
  year: number;
  month: number;
  force?: boolean;
}

interface DrawingResult {
  winners: {
    grandPrize: { userId: string; name: string; entries: number } | null;
    runnerUp1: { userId: string; name: string; entries: number } | null;
    runnerUp2: { userId: string; name: string; entries: number } | null;
  };
  totalEntries: number;
  totalParticipants: number;
}

export class DrawingConflictError extends Error {
  constructor(public existingDrawing: Record<string, unknown>) {
    super('Drawing already exists for this month');
    this.name = 'DrawingConflictError';
  }
}

async function triggerDrawing(input: TriggerDrawingInput): Promise<DrawingResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('You must be signed in to run a drawing');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const response = await fetch(
    `${supabaseUrl}/functions/v1/run-monthly-drawing`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(input),
    },
  );

  let body: { error?: string; existingDrawing?: Record<string, unknown> } = {};
  try {
    body = await response.json();
  } catch {
    logger.error('Drawing failed: invalid response body', { status: response.status });
    throw new Error(response.ok ? 'Invalid response from server' : 'Drawing failed');
  }

  if (response.status === 409) {
    throw new DrawingConflictError(body.existingDrawing ?? {});
  }

  if (!response.ok) {
    const message = body.error ?? (response.status === 404 ? 'No reward configured for this month' : 'Drawing failed');
    logger.error('Drawing failed', { status: response.status, body });
    throw new Error(message);
  }

  return body as DrawingResult;
}

export function useTriggerDrawing() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: triggerDrawing,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: queryKeys.safetyRewards.drawing(variables.year, variables.month),
      });
      qc.invalidateQueries({
        queryKey: queryKeys.safetyRewards.totalEntries(variables.year, variables.month),
      });
      qc.invalidateQueries({ queryKey: queryKeys.safetyRewards.allRewards });
    },
  });
}
