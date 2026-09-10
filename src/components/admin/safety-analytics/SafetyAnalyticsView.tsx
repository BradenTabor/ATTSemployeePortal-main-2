import { useCallback, useState } from 'react';
import { Download, FileText, RefreshCw, Shield } from 'lucide-react';
import { glass } from '@/lib/glass';
import { ANALYTICS_COPY, type Period } from '@/lib/analytics';
import { useSafetyAnalytics } from '@/hooks/queries/useSafetyAnalytics';
import { toast } from '@/lib/toast';
import { exportOsha300Csv } from '@/lib/osha300Export';
import { exportAnalyticsPdf } from '@/lib/analyticsPdfExport';
import { cn } from '@/lib/utils';
import {
  DenominatorCard,
  FormCoverage,
  HeroRibbon,
  InstrumentGrid,
  PeriodToolbar,
  PointsIntegrity,
} from './instruments';
import { AtRiskPanel, LeaderboardPanel, UserCaseDrawer } from './roster';
import { analytics, analyticsFocus } from './tokens';

interface SafetyAnalyticsViewProps {
  period: Period;
  onPeriodChange: (period: Period) => void;
}

export default function SafetyAnalyticsView({ period, onPeriodChange }: SafetyAnalyticsViewProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const { data, isLoading, isError, refetch } = useSafetyAnalytics(period, 80);

  const handleExportOsha300 = useCallback(async () => {
    setExporting('csv');
    try {
      await exportOsha300Csv();
      toast.success('OSHA 300 log downloaded');
    } catch (e) {
      toast.error('Export failed', (e as Error)?.message ?? 'Could not download OSHA 300 log');
    } finally {
      setExporting(null);
    }
  }, []);

  const handleExportPdf = useCallback(async () => {
    if (!data?.stats || !data?.leaderboard) return;
    setExporting('pdf');
    try {
      await exportAnalyticsPdf({
        stats: data.stats,
        leaderboard: data.leaderboard,
        period: data.stats.period_label,
        generatedAt: new Date().toLocaleString(),
      });
    } catch (e) {
      toast.error('Export failed', (e as Error)?.message ?? 'Could not generate PDF');
    } finally {
      setExporting(null);
    }
  }, [data?.stats, data?.leaderboard]);

  return (
    <div className={analytics.page}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-verdant-400/25 bg-verdant-500/10">
            <Shield className="h-5 w-5 text-verdant-300" aria-hidden />
          </div>
          <div>
            <h2 className={analytics.title}>{ANALYTICS_COPY.title}</h2>
            <p className={analytics.subtitle}>{ANALYTICS_COPY.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodToolbar value={period} onChange={onPeriodChange} />
          <button
            type="button"
            onClick={handleExportOsha300}
            disabled={!!exporting}
            aria-label="Export OSHA 300 log (CSV)"
            className={cn(
              'inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-bone-50/10 bg-white/5 px-3 text-sm text-bone-100 hover:bg-white/10 disabled:opacity-50',
              analyticsFocus,
            )}
          >
            <Download className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">OSHA 300</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={!!exporting || !data}
            aria-label="Export analytics report (PDF)"
            className={cn(
              'inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-bone-50/10 bg-white/5 px-3 text-sm text-bone-100 hover:bg-white/10 disabled:opacity-50',
              analyticsFocus,
            )}
          >
            <FileText className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Report</span>
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            aria-label={isLoading ? 'Refreshing analytics' : 'Refresh safety analytics'}
            className={cn(
              'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-bone-50/10 bg-white/5 hover:bg-white/10',
              analyticsFocus,
            )}
          >
            <RefreshCw className={cn('h-4 w-4 text-bone-200/60', isLoading && 'animate-spin')} aria-hidden />
          </button>
        </div>
      </div>

      {isError ? (
        <div className={cn(glass.danger, 'p-8 text-center')}>
          <Shield className="mx-auto mb-3 h-8 w-8 text-rose-300" aria-hidden />
          <h3 className="text-base font-semibold text-bone-50">Analytics did not load</h3>
          <button
            type="button"
            onClick={() => refetch()}
            className={cn('mt-4 min-h-[44px] rounded-xl bg-rose-500/20 px-4 text-sm text-rose-100', analyticsFocus)}
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <HeroRibbon stats={data?.stats} trends={data?.trends ?? []} isLoading={isLoading} />
          {data?.stats && (
            <p className="text-sm text-bone-200/60">
              {data.leaderboard.filter((row) => row.is_field && row.forms_completed > 0).length} of{' '}
              {data.stats.field_users} field crew filed at least one form · {data.atRisk.length} need a
              nudge
            </p>
          )}
          <InstrumentGrid stats={data?.stats} showTrends={period !== 'all'} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="space-y-4 xl:col-span-2">
              <LeaderboardPanel
                entries={data?.leaderboard ?? []}
                isLoading={isLoading}
                onSelect={setSelectedUserId}
              />
            </div>
            <div className="space-y-4">
              <AtRiskPanel entries={data?.atRisk ?? []} onSelect={setSelectedUserId} />
              <FormCoverage data={data?.formBreakdown ?? []} isLoading={isLoading} />
              <PointsIntegrity stats={data?.stats} />
              <DenominatorCard stats={data?.stats} />
            </div>
          </div>
        </>
      )}

      <UserCaseDrawer
        userId={selectedUserId}
        isOpen={!!selectedUserId}
        onClose={() => setSelectedUserId(null)}
        period={period}
      />
    </div>
  );
}
