import { useState, useEffect } from 'react';
import { Sparkles, Copy, RefreshCcw, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { logger } from '../../../lib/logger';
import { cn } from '../../../lib/utils';
import type { AiSummaryState } from './types';

export interface AttendanceSummaryApiResponse {
  success?: boolean;
  summary?: string;
  cached?: boolean;
  generated_at?: string;
  error?: string;
  retryable?: boolean;
}

async function generateAttendanceSummary(
  startDate: string,
  endDate: string,
  forceRegenerate = false
): Promise<AttendanceSummaryApiResponse> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    throw new Error('Not authenticated. Please log in to generate summaries.');
  }
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Supabase URL not configured');
  }
  const response = await fetch(`${supabaseUrl}/functions/v1/generate-attendance-summary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      start_date: startDate,
      end_date: endDate,
      force_regenerate: forceRegenerate,
    }),
  });
  const result = (await response.json()) as AttendanceSummaryApiResponse;
  if (!response.ok) {
    const msg = result.error ?? `Failed to generate summary (${response.status})`;
    const err = new Error(msg) as Error & { retryable?: boolean };
    err.retryable = result.retryable ?? true;
    throw err;
  }
  return result;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

interface AiAttendanceSummaryProps {
  startDate: string;
  endDate: string;
}

export default function AiAttendanceSummary({ startDate, endDate }: AiAttendanceSummaryProps) {
  const [state, setState] = useState<AiSummaryState>({
    status: 'idle',
    summary: null,
    generatedAt: null,
    cached: false,
    error: null,
    retryable: false,
  });
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (forceRegenerate = false) => {
    setState((s) => ({ ...s, status: 'loading', error: null }));
    try {
      const result = await generateAttendanceSummary(startDate, endDate, forceRegenerate);
      setState({
        status: 'success',
        summary: result.summary ?? null,
        generatedAt: result.generated_at ?? null,
        cached: result.cached ?? false,
        error: null,
        retryable: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate summary';
      const retryable = err instanceof Error && 'retryable' in err ? (err as Error & { retryable: boolean }).retryable : true;
      logger.error('Attendance AI summary failed:', err);
      setState((s) => ({
        ...s,
        status: 'error',
        error: message,
        retryable,
      }));
    }
  };

  const handleCopy = async () => {
    if (!state.summary) return;
    const text = `Attendance Summary (${startDate} – ${endDate})\nGenerated: ${state.generatedAt ?? '—'}\n\n${state.summary}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      logger.error('Failed to copy to clipboard');
    }
  };

  const [isStale, setIsStale] = useState(false);
  useEffect(() => {
    if (!state.generatedAt) return;
    const generated = new Date(state.generatedAt).getTime();
    const check = () =>
      setIsStale((Date.now() - generated) > 24 * 60 * 60 * 1000);
    const t = setTimeout(check, 0);
    const id = setInterval(check, 60_000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, [state.generatedAt]);

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden',
        state.status === 'error'
          ? 'border-red-500/20 bg-red-500/5'
          : 'border-[#c084fc]/20 bg-gradient-to-br from-[#c084fc]/5 to-transparent'
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#c084fc]/15 border border-[#c084fc]/25 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-[#c084fc]" />
          </div>
          <span className="text-sm font-medium text-white">AI Attendance Summary</span>
        </div>
        {state.status === 'success' && state.summary && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40">
              {state.cached && 'Cached · '}
              {state.generatedAt ? formatTimeAgo(state.generatedAt) : ''}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? 'Copied' : 'Copy summary'}
              className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#c084fc]/50"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => handleGenerate(true)}
              aria-label="Regenerate summary"
              className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#c084fc]/50"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="px-4 py-3">
        {state.status === 'idle' && (
          <div className="py-2">
            <p className="text-sm text-gray-400 mb-3">
              Get a brief AI-generated summary of attendance trends for the selected range.
            </p>
            <button
              type="button"
              onClick={() => handleGenerate(false)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#c084fc]/20 border border-[#c084fc]/30 text-[#e9d5ff] text-sm font-medium hover:bg-[#c084fc]/30 transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#c084fc]/50"
            >
              <Sparkles className="w-4 h-4" />
              Generate Summary
            </button>
          </div>
        )}

        {state.status === 'loading' && (
          <div className="py-4 space-y-2">
            <div className="h-3 w-full rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full w-1/3 rounded-full bg-[#c084fc]/40 animate-pulse" />
            </div>
            <p className="text-xs text-gray-500">Analyzing attendance data...</p>
          </div>
        )}

        {state.status === 'success' && state.summary && (
          <div className="py-2">
            <p className="text-sm text-white/90 whitespace-pre-wrap">{state.summary}</p>
            {isStale && (
              <p className="text-[10px] text-amber-400/80 mt-2">
                Summary may be outdated (over 24h). Use refresh to regenerate.
              </p>
            )}
          </div>
        )}

        {state.status === 'error' && (
          <div className="py-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-300">Failed to generate summary</p>
                <p className="text-xs text-gray-400 mt-0.5">{state.error}</p>
                {state.retryable && (
                  <button
                    type="button"
                    onClick={() => handleGenerate(true)}
                    className="mt-2 text-xs font-medium text-[#c084fc] hover:text-[#e9d5ff] transition-colors"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
