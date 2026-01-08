/**
 * Hook to generate safety announcements via Edge Function
 * 
 * Usage:
 * ```tsx
 * const { generate, isLoading, announcement, error } = useGenerateAnnouncement();
 * 
 * <button onClick={() => generate({ dryRun: true })}>
 *   Preview Announcement
 * </button>
 * ```
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Announcement {
  title: string;
  body: string;
  summary: string;
}

interface GenerateOptions {
  windowHours?: number;
  dryRun?: boolean;
}

interface GenerateResult {
  success: boolean;
  announcement?: Announcement;
  announcementId?: string;
  stats?: {
    jsaCount: number;
    dvirCount: number;
    equipmentCount: number;
    totalSubmissions: number;
    topHazards: Array<{ hazard: string; count: number }>;
    nearMissCount: number;
    tokensUsed: number;
  };
  error?: string;
}

export function useGenerateAnnouncement() {
  const [isLoading, setIsLoading] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<GenerateResult['stats'] | null>(null);

  const generate = async (options: GenerateOptions = {}): Promise<GenerateResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'generate-safety-announcement',
        {
          body: {
            windowHours: options.windowHours ?? 24,
            dryRun: options.dryRun ?? false,
          },
        }
      );

      if (fnError) throw fnError;

      if (data?.success) {
        setAnnouncement(data.announcement);
        setStats(data.stats);
        return data;
      } else {
        throw new Error(data?.error || 'Failed to generate announcement');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setAnnouncement(null);
    setError(null);
    setStats(null);
  };

  return {
    generate,
    isLoading,
    announcement,
    stats,
    error,
    reset,
  };
}

export default useGenerateAnnouncement;
