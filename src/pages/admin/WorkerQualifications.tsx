import { useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkerQualifications, useUpdateQualification } from '../../hooks/queries/useWorkerQualifications';
import type { ElectricalQualificationLevel } from '../../types/electricalQualification';
import { QUALIFICATION_LABELS } from '../../types/electricalQualification';
import { toast } from '../../lib/toast';
import { logger } from '../../lib/logger';
import { Loader2 } from 'lucide-react';
import TableSkeleton from '../../components/skeletons/TableSkeleton';

const LEVELS: ElectricalQualificationLevel[] = [
  'unqualified',
  'line_clearance_tree_trimmer',
  'qualified_269',
];

export default function WorkerQualifications() {
  const { user, role } = useAuth();
  const [filterLevel, setFilterLevel] = useState<ElectricalQualificationLevel | undefined>();
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const canAccess = role === 'admin' || role === 'safety_officer';
  const { data: workers, isLoading, error } = useWorkerQualifications(filterLevel, {
    enabled: canAccess,
  });
  const updateQual = useUpdateQualification();

  if (role !== 'admin' && role !== 'safety_officer') {
    return (
      <DashboardLayout title="Worker Qualifications">
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-red-400">Access Denied — admin or safety officer role required.</p>
        </div>
      </DashboardLayout>
    );
  }

  const handleChange = async (userId: string, newLevel: ElectricalQualificationLevel) => {
    if (!user?.id) {
      toast.error('You must be signed in to update qualifications.');
      return;
    }
    setEditingUserId(userId);
    try {
      await updateQual.mutateAsync({
        userId,
        level: newLevel,
        adminAuthUserId: user.id,
      });
      toast.success('Qualification updated.');
      setEditingUserId(null);
    } catch (e) {
      logger.error('Failed to update qualification', { error: e, userId });
      toast.error('Failed to update qualification.');
      setEditingUserId(null);
    }
  };

  return (
    <DashboardLayout title="Worker Qualifications">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-gray-900 via-gray-900/95 to-gray-950 px-4 py-4 shadow-lg shadow-black/25 before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:pointer-events-none">
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            Worker Qualifications
          </h1>
          <p className="mt-1 text-sm text-white/60">
            OSHA 1910.269(r) electrical qualification levels. Filter and edit inline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-white/60">Filter:</span>
          <select
            value={filterLevel ?? ''}
            onChange={(e) =>
              setFilterLevel((e.target.value || undefined) as ElectricalQualificationLevel | undefined)
            }
            className="rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
          >
            <option value="">All levels</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {QUALIFICATION_LABELS[l]}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div
            role="alert"
            className="relative overflow-hidden rounded-xl border border-red-500/30 bg-gradient-to-br from-red-950/90 to-red-950/70 px-4 py-3 shadow-lg shadow-black/25 before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-red-400/10 before:to-transparent before:pointer-events-none text-sm text-red-300"
            data-testid="worker-qualifications-error"
          >
            {(error as Error)?.message ?? 'Failed to load workers.'}
          </div>
        )}

        {isLoading ? (
          <div data-testid="worker-qualifications-skeleton">
            <TableSkeleton rows={10} columns={5} />
          </div>
        ) : !workers?.length && !error ? (
          <div
            className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center text-white/60 before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:pointer-events-none"
            data-testid="worker-qualifications-empty"
          >
            <p className="text-sm">No workers match the current filter.</p>
            <p className="mt-1 text-xs">Change the filter or ensure users exist in the system.</p>
          </div>
        ) : (
          <>
            <div
              className="relative hidden overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-gray-900 via-gray-900/95 to-gray-950 shadow-lg shadow-black/25 before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:pointer-events-none sm:block"
              data-testid="worker-qualifications-table"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3 font-semibold text-white/80">Name</th>
                      <th className="px-4 py-3 font-semibold text-white/80">Role</th>
                      <th className="px-4 py-3 font-semibold text-white/80">Electrical Qualification</th>
                      <th className="px-4 py-3 font-semibold text-white/80">Qualification Date</th>
                      <th className="px-4 py-3 font-semibold text-white/80">Verified By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(workers ?? []).map((w) => (
                      <tr key={w.user_id} className="border-b border-white/5">
                        <td className="px-4 py-3 text-white">{w.full_name ?? '—'}</td>
                        <td className="px-4 py-3 text-white/70">{w.role ?? '—'}</td>
                        <td className="px-4 py-3">
                          {editingUserId === w.user_id ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" aria-hidden />
                              Saving…
                            </span>
                          ) : (
                            <select
                              value={w.electrical_qualification_level}
                              onChange={(e) =>
                                handleChange(
                                  w.user_id,
                                  e.target.value as ElectricalQualificationLevel
                                )
                              }
                              aria-label={`Update qualification for ${w.full_name ?? 'worker'}`}
                              className="rounded border border-white/10 bg-gray-800 px-2 py-1 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
                            >
                              {LEVELS.map((l) => (
                                <option key={l} value={l}>
                                  {QUALIFICATION_LABELS[l]}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-4 py-3 text-white/70">
                          {w.electrical_qualification_date ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-white/70">
                          {w.electrical_qualification_verified_by ? 'Recorded' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="space-y-3 sm:hidden" data-testid="worker-qualifications-cards">
              {(workers ?? []).map((w) => (
                <div
                  key={w.user_id}
                  className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-4 before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:pointer-events-none"
                >
                  <p className="font-medium text-white">{w.full_name ?? '—'}</p>
                  <p className="text-xs text-white/60">{w.role ?? '—'}</p>
                  <div className="mt-3">
                    <span className="text-xs text-white/60">Qualification: </span>
                    {editingUserId === w.user_id ? (
                      <span className="flex items-center gap-2 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-400" aria-hidden />
                        Saving…
                      </span>
                    ) : (
                      <select
                        value={w.electrical_qualification_level}
                        onChange={(e) =>
                          handleChange(w.user_id, e.target.value as ElectricalQualificationLevel)
                        }
                        aria-label={`Update qualification for ${w.full_name ?? 'worker'}`}
                        className="mt-1 w-full rounded border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
                      >
                        {LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {QUALIFICATION_LABELS[l]}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-white/50">
                    Date: {w.electrical_qualification_date ?? '—'} ·{' '}
                    {w.electrical_qualification_verified_by ? 'Verified' : 'Not verified'}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
