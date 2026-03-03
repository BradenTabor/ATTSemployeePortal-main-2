/**
 * RapidReportingTimer — OSHA 8/24hr countdown for unreported incidents
 *
 * Displays countdown cards for fatality (8hr) and hospitalization/amputation/eye loss (24hr).
 * OSHA phone: 1-800-321-OSHA (6742)
 * OSHA online: https://www.osha.gov/ords/ser/serform.html
 */

import { useUnreportedOshaEvents, useMarkAsReported, RapidReportingEvent } from '../../hooks/queries/useRapidReporting';
import { Loader2, Phone, ExternalLink } from 'lucide-react';
import { toast } from '../../lib/toast';
import { useDashboardCardTheme } from '../../contexts/dashboardCardTheme';

const OSHA_PHONE = '1-800-321-OSHA (6742)';
const OSHA_LINK = 'https://www.osha.gov/ords/ser/serform.html';

function formatTimeRemaining(event: RapidReportingEvent): string {
  if (event.urgency === 'overdue') {
    const overdueHours = event.elapsed_hours - event.deadline_hours;
    const h = Math.floor(overdueHours);
    const m = Math.floor((overdueHours % 1) * 60);
    const s = Math.floor(((overdueHours % 1) * 60 % 1) * 60);
    return `OVERDUE by ${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  const h = Math.floor(event.remaining_hours);
  const m = Math.floor((event.remaining_hours % 1) * 60);
  const s = Math.floor(((event.remaining_hours % 1) * 60 % 1) * 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} remaining`;
}

const URGENCY_STYLES: Record<RapidReportingEvent['urgency'], string> = {
  green: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  yellow: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  red: 'bg-red-500/10 border-red-500/30 text-red-400',
  overdue: 'bg-red-600/20 border-red-500/50 text-red-300',
};

export default function RapidReportingTimer() {
  const { cardClass } = useDashboardCardTheme();
  const { data: events, isLoading } = useUnreportedOshaEvents();
  const markAsReported = useMarkAsReported();

  if (isLoading) {
    return (
      <div className={`${cardClass} p-4`} role="status" aria-label="Loading rapid reporting status">
        <div className="flex items-center justify-center py-6 text-white/60">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </div>
    );
  }

  if (!events || events.length === 0) return null;

  const handleMarkReported = async (incidentId: string) => {
    try {
      await markAsReported.mutateAsync(incidentId);
      toast.success('Marked as reported to OSHA');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to mark as reported');
    }
  };

  return (
    <div className={`${cardClass} p-4`} role="region" aria-label="OSHA rapid reporting deadlines">
      <div className="space-y-4">
      {events.map((event) => (
        <div
          key={event.id}
          className={`rounded-xl border p-4 ${URGENCY_STYLES[event.urgency]}`}
        >
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-mono font-semibold">{event.case_number}</span>
            <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-white/10 capitalize">
              {event.severity.replace('_', ' ')}
            </span>
          </div>
          <p className="text-lg sm:text-xl font-bold mb-3 tabular-nums">
            {formatTimeRemaining(event)}
          </p>
          <div className="flex flex-wrap gap-2 mb-3 text-sm">
            <a
              href={`tel:+1-800-321-6742`}
              className="inline-flex items-center gap-1 underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-current rounded"
              aria-label={`Call OSHA: ${OSHA_PHONE}`}
            >
              <Phone className="w-4 h-4" />
              {OSHA_PHONE}
            </a>
            <a
              href={OSHA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-current rounded"
              aria-label="OSHA online reporting form (opens in new tab)"
            >
              <ExternalLink className="w-4 h-4" />
              Online reporting
            </a>
          </div>
          <button
            type="button"
            onClick={() => handleMarkReported(event.id)}
            disabled={markAsReported.isPending}
            className="px-4 py-2 rounded-lg border border-current bg-white/10 hover:bg-white/20 font-medium text-sm disabled:opacity-50 inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            {markAsReported.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            Mark as Reported to OSHA
          </button>
        </div>
      ))}
      </div>
    </div>
  );
}
