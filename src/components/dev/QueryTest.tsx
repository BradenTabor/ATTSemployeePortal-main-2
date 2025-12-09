/**
 * QueryTest - Dev-only component for debugging assigned job queries.
 *
 * Usage: Import and render in Dashboard.tsx (or any page) during development
 *        to inspect the raw Supabase query results for user-assigned jobs.
 *
 * IMPORTANT: Remove or disable before merging to production!
 */

import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { logger } from "../../lib/logger";

interface QueryTestProps {
  showRaw?: boolean;
}

export default function QueryTest({ showRaw = true }: QueryTestProps) {
  const { user } = useAuth();
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setResult(null);
      setLoading(false);
      return;
    }

    const runQuery = async () => {
      setLoading(true);
      setError(null);

      try {
        logger.info("[QueryTest] Running assigned jobs query for user:", user.id);

        const { data, error: queryError } = await supabase
          .from("job_crew_assignments")
          .select(`
            id,
            job_id,
            user_id,
            assigned_at,
            job:job_progress_trackers(
              id,
              job_name,
              job_location,
              start_date,
              end_date,
              status,
              created_at,
              updated_at,
              milestones:job_milestones(id, title, is_completed, sort_order)
            )
          `)
          .eq("user_id", user.id);

        if (queryError) {
          logger.error("[QueryTest] Query error:", queryError);
          setError(queryError.message);
        } else {
          logger.info("[QueryTest] Query result:", data);
          setResult(data);
        }
      } catch (err) {
        logger.error("[QueryTest] Unexpected error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    runQuery();
  }, [user?.id]);

  // Only render in development
  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 max-w-md max-h-96 overflow-auto z-50 rounded-lg border border-yellow-500/50 bg-black/90 p-4 text-xs font-mono shadow-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-yellow-400 font-bold">🔧 QueryTest (dev only)</span>
        <span className="text-white/50">User: {user?.id?.slice(0, 8)}...</span>
      </div>

      {loading && <p className="text-blue-400">Loading...</p>}

      {error && <p className="text-red-400">Error: {error}</p>}

      {!loading && !error && result && showRaw && (
        <pre className="text-green-300 whitespace-pre-wrap break-all">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}

      {!loading && !error && !result && (
        <p className="text-gray-400">No user or no assignments found.</p>
      )}
    </div>
  );
}

