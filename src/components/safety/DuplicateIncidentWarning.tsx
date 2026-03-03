/**
 * DuplicateIncidentWarning - Displays potential duplicate incidents with new/link options
 *
 * Companion to useDuplicateIncidentCheck. Shows matches and lets user choose
 * "This is a new case" (dismiss) or "Link to existing case #[number]" (returns selected case ID).
 */

import { AlertTriangle } from 'lucide-react';
import type { DuplicateMatch } from '../../hooks/queries/useDuplicateIncidentCheck';
import { format, parseISO } from 'date-fns';

interface DuplicateIncidentWarningProps {
  matches: DuplicateMatch[];
  onDismiss: () => void;
  onLinkToCase: (caseId: string) => void;
  className?: string;
}

export default function DuplicateIncidentWarning({
  matches,
  onDismiss,
  onLinkToCase,
  className = '',
}: DuplicateIncidentWarningProps) {
  if (!matches || matches.length === 0) return null;

  const primary = matches[0];

  return (
    <div
      className={`rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 ${className}`}
      role="alert"
    >
      <div className="flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-amber-200 mb-3">
            A similar incident was recorded for this employee on{' '}
            {format(parseISO(primary.incident_date), 'MMM d, yyyy')} (Case #{primary.case_number}).
            Is this a new case or a continuation?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onDismiss}
              className="px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-200 text-sm hover:bg-amber-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
            >
              This is a new case
            </button>
            {matches.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onLinkToCase(m.id)}
                className="px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/20 text-amber-200 text-sm hover:bg-amber-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
              >
                Link to existing case #{m.case_number}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
