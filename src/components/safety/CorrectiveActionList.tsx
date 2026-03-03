/**
 * CorrectiveActionList - Table/list of corrective actions with filtering
 *
 * Self-contained with own data fetching. Props: incidentId? for incident detail or none for dashboard.
 */

import { useState, useMemo } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { useCorrectiveActions } from '../../hooks/queries/useCorrectiveActions';
import { useUsersQuery } from '../../hooks/queries/useUsersQuery';
import type { CorrectiveAction, ActionStatus } from '../../types/correctiveAction';
import CorrectiveActionForm from './CorrectiveActionForm';
import { format, parseISO } from 'date-fns';
import { cn } from '../../lib/utils';
import { useDashboardCardTheme } from '../../contexts/dashboardCardTheme';

type StatusFilter = 'all' | 'open' | 'overdue' | 'completed' | 'verified';

const STATUS_LABELS: Record<ActionStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
  verified: 'Verified',
  overdue: 'Overdue',
};

const STATUS_STYLES: Record<ActionStatus, string> = {
  open: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  verified: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40',
  overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
};

interface CorrectiveActionListProps {
  incidentId?: string | null;
  className?: string;
}

export default function CorrectiveActionList({ incidentId, className = '' }: CorrectiveActionListProps) {
  const { cardClass } = useDashboardCardTheme();
  const { data: actions, isLoading } = useCorrectiveActions(incidentId);
  const { data: users } = useUsersQuery();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<CorrectiveAction | null>(null);
  const [showForm, setShowForm] = useState(false);

  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    users?.forEach((u) => m.set(u.user_id, u.full_name ?? u.email ?? u.user_id));
    return m;
  }, [users]);

  const filtered = useMemo(() => {
    const list = actions ?? [];
    if (filter === 'all') return list;
    if (filter === 'open') return list.filter((a) => a.status === 'open' || a.status === 'in_progress');
    if (filter === 'overdue') return list.filter((a) => a.is_overdue);
    if (filter === 'completed') return list.filter((a) => a.status === 'completed');
    if (filter === 'verified') return list.filter((a) => a.status === 'verified');
    return list;
  }, [actions, filter]);

  const handleRowClick = (a: CorrectiveAction) => {
    setSelected(a);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelected(null);
  };

  const handleSuccess = () => {
    handleCloseForm();
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <Loader2 className="w-6 h-6 animate-spin text-white/60" aria-hidden />
      </div>
    );
  }

  const list = filtered;

  return (
    <div className={cn(cardClass, 'p-4 space-y-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {(['all', 'open', 'overdue', 'completed', 'verified'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                filter === f
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : 'border-white/10 text-white/60 hover:bg-white/5'
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm hover:bg-emerald-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
        >
          <Plus className="w-4 h-4" />
          Add Action
        </button>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          {(actions?.length ?? 0) === 0 ? (
            <>
              <p className="text-sm text-white/50">No corrective actions yet.</p>
              <p className="text-xs text-white/30">Create one to track safety improvements.</p>
            </>
          ) : (
            <>
              <p className="text-sm text-white/50">No actions match this filter.</p>
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="text-xs text-emerald-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 rounded"
              >
                Show all actions
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.08] overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 py-2 text-xs font-semibold text-white/60 uppercase">Description</th>
                <th className="px-4 py-2 text-xs font-semibold text-white/60 uppercase">Type</th>
                <th className="px-4 py-2 text-xs font-semibold text-white/60 uppercase">Assigned To</th>
                <th className="px-4 py-2 text-xs font-semibold text-white/60 uppercase">Due Date</th>
                <th className="px-4 py-2 text-xs font-semibold text-white/60 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => handleRowClick(a)}
                  className="border-b border-white/5 hover:bg-white/5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-inset"
                >
                  <td className="px-4 py-2 text-sm text-white/90 max-w-[200px] truncate">{a.description}</td>
                  <td className="px-4 py-2 text-sm text-white/70 capitalize">{a.action_type.replace('_', ' ')}</td>
                  <td className="px-4 py-2 text-sm text-white/70">{a.assigned_to ? userMap.get(a.assigned_to) ?? '—' : '—'}</td>
                  <td className="px-4 py-2 text-sm text-white/70">{format(parseISO(a.due_date), 'MMM d, yyyy')}</td>
                  <td className="px-4 py-2">
                    <span
                      className={cn(
                        'inline-flex px-2 py-0.5 rounded-md text-xs font-medium border',
                        STATUS_STYLES[a.is_overdue ? 'overdue' : a.status]
                      )}
                    >
                      {a.is_overdue ? 'Overdue' : STATUS_LABELS[a.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <CorrectiveActionForm
          incidentId={incidentId}
          action={selected ?? undefined}
          onClose={handleCloseForm}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
