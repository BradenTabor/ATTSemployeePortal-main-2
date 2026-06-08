import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Award,
  BarChart3,
  Flag,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCaptureBaselineCohort,
  useGamificationAdminMetrics,
  useGamificationProgramSettings,
} from '@/hooks/gamification';
import { itemVariants } from './constants';
import { GamificationProgramAdminSection } from './GamificationProgramAdminSection';

interface StatBoxProps {
  label: string;
  value: string | number;
  subValue?: string;
  color?: 'emerald' | 'amber' | 'blue' | 'purple' | 'red';
}

function StatBox({ label, value, subValue, color = 'emerald' }: StatBoxProps) {
  const colorClasses = {
    emerald: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
    amber: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
    blue: 'border-blue-500/30 bg-blue-500/5 text-blue-400',
    purple: 'border-purple-500/30 bg-purple-500/5 text-purple-400',
    red: 'border-red-500/30 bg-red-500/5 text-red-400',
  };

  return (
    <div className={cn('rounded-lg sm:rounded-xl border p-2 sm:p-3', colorClasses[color].split(' ').slice(0, 2))}>
      <span className="text-[9px] sm:text-[10px] uppercase tracking-wide text-white/50">{label}</span>
      <p className={cn('text-base sm:text-xl font-bold tabular-nums mt-0.5', colorClasses[color].split(' ')[2])}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {subValue && <p className="text-[9px] sm:text-[10px] text-white/40 mt-0.5">{subValue}</p>}
    </div>
  );
}

function TrendBadge({ current, prior }: { current: number; prior: number }) {
  if (prior === 0 && current === 0) {
    return <span className="text-[10px] text-white/40">—</span>;
  }
  const up = current >= prior;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-medium', up ? 'text-emerald-400' : 'text-amber-400')}>
      {up ? <TrendingUp className="w-3 h-3" aria-hidden /> : <TrendingDown className="w-3 h-3" aria-hidden />}
      {prior > 0 ? `${Math.round(((current - prior) / prior) * 100)}%` : 'new'}
    </span>
  );
}

interface GamificationAnalyticsSectionProps {
  days: number;
}

export function GamificationAnalyticsSection({ days }: GamificationAnalyticsSectionProps) {
  const { data, isLoading, error, refetch, isRefetching } = useGamificationAdminMetrics(days);
  const { data: programSettings } = useGamificationProgramSettings();
  const captureMutation = useCaptureBaselineCohort();

  const longTail = data?.longTailActivation;
  const baselineReady = longTail?.status === 'ready';
  const missingHire = data?.hireDatePrecondition.missingCount ?? 0;

  return (
    <motion.section variants={itemVariants} className="space-y-2 sm:space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" aria-hidden />
          <div>
            <h2 className="text-sm sm:text-lg font-semibold text-white">Gamification Program</h2>
            <p className="text-[10px] sm:text-xs text-white/50">
              Long-tail activation, engagement, and launch readiness
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="self-start text-[10px] sm:text-xs px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white/80"
        >
          Refresh metrics
        </button>
      </div>

      {programSettings && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2 sm:p-3 text-[10px] sm:text-xs text-white/60">
          <span className="text-amber-300/90 font-medium">Program owners: </span>
          {programSettings.programOwnerUserId ?? 'not set'}
          {programSettings.programBackupUserId ? ` · backup ${programSettings.programBackupUserId}` : ''}
          <span className="block mt-1 text-white/40">
            Season-needs-campaign nudge fires to the program owner when Phase 2 is live and a scheduled season lacks an activated campaign.
          </span>
        </div>
      )}

      <GamificationProgramAdminSection />

      {isLoading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 animate-pulse h-32" />
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200" role="alert">
          {error.message}
        </div>
      ) : data ? (
        <>
          {missingHire > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3" role="alert">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="text-xs sm:text-sm font-medium text-amber-200">
                    {missingHire} real user{missingHire === 1 ? '' : 's'} missing hire_date — baseline capture blocked
                  </p>
                  <ul className="mt-1 text-[10px] sm:text-xs text-amber-200/80 list-disc pl-4">
                    {data.hireDatePrecondition.missingUsers.map((u) => (
                      <li key={u.userId}>
                        {u.fullName ?? u.email ?? u.userId}
                        {u.role ? ` (${u.role})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {!baselineReady && missingHire === 0 && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-xs sm:text-sm font-medium text-blue-200">Pre-launch baseline not captured</p>
                <p className="text-[10px] sm:text-xs text-white/50 mt-0.5">
                  One-time snapshot of rarely-active field users (≤2 active days in prior 90d). Required for long-tail lift metrics.
                </p>
              </div>
              <button
                type="button"
                onClick={() => captureMutation.mutate()}
                disabled={captureMutation.isPending}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-200 text-xs font-medium hover:bg-blue-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                {captureMutation.isPending ? 'Capturing…' : 'Capture baseline cohort'}
              </button>
            </div>
          )}

          {captureMutation.isError && (
            <p className="text-xs text-red-300" role="alert">{captureMutation.error.message}</p>
          )}
          {captureMutation.isSuccess && (
            <p className="text-xs text-emerald-300" role="status">
              Baseline captured — {captureMutation.data.cohortSize} users in cohort.
            </p>
          )}

          <div
            className={cn(
              'rounded-xl border p-3 sm:p-4',
              baselineReady
                ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-white/[0.02] to-emerald-500/5'
                : 'border-white/10 bg-white/[0.03]',
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-amber-400" aria-hidden />
              <h3 className="text-xs sm:text-sm font-semibold text-white">Long-tail activation</h3>
            </div>
            {baselineReady ? (
              <div className="grid grid-cols-3 gap-2">
                <StatBox label="Cohort" value={longTail?.cohortSize ?? 0} color="amber" />
                <StatBox label="Activated" value={longTail?.activatedCount ?? 0} color="emerald" />
                <StatBox
                  label="Rate"
                  value={longTail?.activationRatePct != null ? `${longTail.activationRatePct}%` : '—'}
                  color="purple"
                />
              </div>
            ) : (
              <p className="text-xs text-white/50">{longTail?.message ?? 'Baseline not yet captured'}</p>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <StatBox
              label="Session users"
              value={data.engagement.uniqueSessionUsers}
              subValue={`${days}d window`}
              color="blue"
            />
            <StatBox label="Active days" value={data.engagement.activeUserDays} color="emerald" />
            <StatBox label="Active weeks" value={data.engagement.activeUserWeeks} color="purple" />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-emerald-400" aria-hidden />
              <h3 className="text-xs sm:text-sm font-semibold text-white">Target behaviors</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              {(
                [
                  ['Compliance forms', data.targetBehaviors.complianceForms],
                  ['Near-miss reports', data.targetBehaviors.nearMissReports],
                  ['Certifications', data.targetBehaviors.certifications],
                ] as const
              ).map(([label, trend]) => (
                <div key={label} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">
                  <span className="text-white/60">{label}</span>
                  <span className="flex items-center gap-2 tabular-nums text-white font-medium">
                    {trend.count}
                    <TrendBadge current={trend.count} prior={trend.priorPeriodCount} />
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-amber-400" aria-hidden />
                <h3 className="text-xs sm:text-sm font-semibold text-white">Redemption cost</h3>
              </div>
              <p className="text-lg font-bold text-amber-300 tabular-nums">
                {data.redemptionCost.totalPointsRedeemed.toLocaleString()} pts
              </p>
              <p className="text-[10px] text-white/40">
                {data.redemptionCost.redemptionCount} redemptions · prior {data.redemptionCost.priorPeriodPointsRedeemed.toLocaleString()} pts
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center gap-2 mb-2">
                <Flag className="w-4 h-4 text-red-400" aria-hidden />
                <h3 className="text-xs sm:text-sm font-semibold text-white">Anomaly flags</h3>
              </div>
              <p className="text-lg font-bold text-red-300 tabular-nums">{data.anomalyFlag.flaggedUserCount}</p>
              <p className="text-[10px] text-white/40">{data.anomalyFlag.method.replace(/_/g, ' ')}</p>
            </div>
          </div>

          {data.standings.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-emerald-400" aria-hidden />
                <h3 className="text-xs sm:text-sm font-semibold text-white">Top standings (field)</h3>
              </div>
              <ul className="space-y-1 text-[10px] sm:text-xs">
                {data.standings.slice(0, 10).map((s, i) => (
                  <li key={s.userId} className="flex justify-between text-white/70">
                    <span>
                      {i + 1}. {s.tierName} {s.subLevelLabel}
                    </span>
                    <span className="tabular-nums text-amber-300/90">{s.lifetimeEarned.toLocaleString()} pts</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : null}
    </motion.section>
  );
}
