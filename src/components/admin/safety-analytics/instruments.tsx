import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ClipboardCheck,
  Info,
  Megaphone,
  Target,
  Trophy,
  Truck,
  Wrench,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { Z } from '@/lib/zIndex';
import { ANALYTICS_COPY, chicagoToday, type FormBreakdown, type SafetyAnalyticsStats, type SafetyTrendData } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { analytics, analyticsFocus, fillBar, fillTone } from './tokens';

const FORM_META: Record<string, { name: string; icon: typeof Truck }> = {
  dvir: { name: 'DVIR', icon: Truck },
  equipment: { name: 'Equipment', icon: Wrench },
  jsa: { name: 'JSA', icon: ClipboardCheck },
};

export const MetricHint = memo(function MetricHint({ text }: { text: string }) {
  return (
    <button
      type="button"
      className={cn('group relative inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-md', analyticsFocus)}
      aria-label={text}
    >
      <Info className="h-3.5 w-3.5 text-bone-200/45" aria-hidden />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-60 -translate-x-1/2 rounded-lg border border-bone-50/10 bg-ink-900 px-3 py-2 text-left text-xs leading-relaxed text-bone-100 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        style={{ zIndex: Z.tooltip }}
      >
        {text}
      </span>
    </button>
  );
});

export const PeriodToolbar = memo(function PeriodToolbar({
  value,
  onChange,
}: {
  value: 'week' | 'month' | 'quarter' | 'all';
  onChange: (period: 'week' | 'month' | 'quarter' | 'all') => void;
}) {
  const periods = [
    { key: 'week' as const, label: '7 days' },
    { key: 'month' as const, label: '30 days' },
    { key: 'quarter' as const, label: '90 days' },
    { key: 'all' as const, label: 'All time' },
  ];

  return (
    <div
      className="flex flex-wrap gap-1 rounded-xl border border-bone-50/10 bg-ink-950/70 p-1"
      role="tablist"
      aria-label="Time period"
    >
      {periods.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={cn(
            'min-h-[44px] min-w-[72px] rounded-lg px-3 text-sm font-medium transition-colors duration-150',
            analyticsFocus,
            value === key
              ? 'bg-verdant-500/15 text-verdant-100 border border-verdant-400/30'
              : 'text-bone-200/55 hover:text-bone-50 hover:bg-white/5',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
});

export const HeroRibbon = memo(function HeroRibbon({
  stats,
  trends,
  isLoading,
}: {
  stats?: SafetyAnalyticsStats;
  trends: SafetyTrendData[];
  isLoading: boolean;
}) {
  const reduce = useReducedMotion();
  const fill = stats?.form_fill_rate ?? 0;
  const completed = stats?.completed_form_slots ?? 0;
  const owed = stats?.expected_form_slots ?? 0;

  return (
    <section className={cn(glass.cardGold, 'relative overflow-hidden p-5 sm:p-6')} aria-labelledby="analytics-hero-title">
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-verdant-400/[0.08] blur-[60px]" aria-hidden />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className={analytics.eyebrow}>{ANALYTICS_COPY.heroEyebrow}</p>
            <MetricHint text={ANALYTICS_COPY.heroHint} />
          </div>
          <h3 id="analytics-hero-title" className={cn(analytics.value, 'mt-2 text-6xl font-semibold leading-none sm:text-7xl', fillTone(fill))}>
            {isLoading ? '—' : `${fill}%`}
          </h3>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-bone-200/70">
            {completed.toLocaleString()} of {owed.toLocaleString()} weekday form slots filed
            {stats ? ` · ${stats.field_users} field crew · ${stats.weekday_count} weekdays` : ''}.
            <span className="mt-1 block text-xs text-bone-200/45">
              As of {chicagoToday()} Central · {stats?.period_label ?? 'This window'}
            </span>
          </p>
        </div>
        <TrendSparkline trends={trends} reduce={!!reduce} />
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-bone-50/10" aria-hidden>
        <motion.div
          className={cn('h-full rounded-full', fillBar(fill))}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${Math.min(fill, 100)}%` }}
          transition={{ duration: 0.2 }}
        />
      </div>
    </section>
  );
});

const TrendSparkline = memo(function TrendSparkline({
  trends,
  reduce,
}: {
  trends: SafetyTrendData[];
  reduce: boolean;
}) {
  const points = trends.slice(-14);
  if (points.length < 2) {
    return (
      <p className={cn(analytics.hint, 'max-w-xs')}>{ANALYTICS_COPY.trendTitle}: not enough daily points yet.</p>
    );
  }
  const w = 220;
  const h = 64;
  const max = Math.max(100, ...points.map((p) => p.form_fill_rate));
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - (p.form_fill_rate / max) * (h - 6) - 3;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="w-full max-w-[240px]">
      <p className={analytics.label}>{ANALYTICS_COPY.trendTitle}</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-16 w-full" role="img" aria-label="Daily form fill sparkline">
        <path d={path} fill="none" stroke="rgba(141,245,168,0.85)" strokeWidth="2.5" strokeLinejoin="round" />
        {!reduce && (
          <circle
            cx={w}
            cy={h - (points[points.length - 1].form_fill_rate / max) * (h - 6) - 3}
            r="3.5"
            fill="#8DF5A8"
          />
        )}
      </svg>
    </div>
  );
});

export const InstrumentGrid = memo(function InstrumentGrid({
  stats,
  showTrends = true,
}: {
  stats?: SafetyAnalyticsStats;
  showTrends?: boolean;
}) {
  const items = [
    {
      key: 'fill',
      label: ANALYTICS_COPY.instruments.formFill.label,
      hint: ANALYTICS_COPY.instruments.formFill.hint,
      value: `${stats?.form_fill_rate ?? 0}%`,
      detail: `${stats?.completed_form_slots ?? 0}/${stats?.expected_form_slots ?? 0} slots`,
      trend: stats?.compliance_trend,
      icon: Target,
    },
    {
      key: 'packet',
      label: ANALYTICS_COPY.instruments.fullPacket.label,
      hint: ANALYTICS_COPY.instruments.fullPacket.hint,
      value: `${stats?.full_packet_rate ?? 0}%`,
      detail: `${stats?.days_with_full_packet ?? 0} full days · ${stats?.full_compliance_users ?? 0} people`,
      trend: stats?.packet_trend,
      icon: ClipboardCheck,
    },
    {
      key: 'reach',
      label: ANALYTICS_COPY.instruments.reach.label,
      hint: ANALYTICS_COPY.instruments.reach.hint,
      value: `${stats?.announcement_reach ?? 0}%`,
      detail: `${stats?.total_announcements_claimed ?? 0} claims · ${stats?.announcement_count ?? 0} posted`,
      icon: Megaphone,
    },
    {
      key: 'points',
      label: ANALYTICS_COPY.instruments.points.label,
      hint: ANALYTICS_COPY.instruments.points.hint,
      value: (stats?.total_combined_points ?? 0).toLocaleString(),
      detail: `${stats?.active_users ?? 0} people with activity`,
      trend: stats?.points_trend,
      icon: Trophy,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map((item) => (
        <article key={item.key} className={cn(glass.subtleGold, 'p-4')}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <item.icon className="h-4 w-4 text-verdant-300" aria-hidden />
              <p className={analytics.label}>{item.label}</p>
            </div>
            <MetricHint text={item.hint} />
          </div>
          <p className={cn(analytics.value, 'mt-2 text-2xl font-semibold sm:text-3xl')}>{item.value}</p>
          <p className="mt-1 text-xs text-bone-200/50">{item.detail}</p>
          {showTrends && item.trend !== undefined && item.trend !== 0 && (
            <p className={cn('mt-2 text-xs font-medium', item.trend > 0 ? 'text-verdant-300' : 'text-rose-300')}>
              {item.trend > 0 ? '+' : ''}
              {item.trend}
              {item.key === 'points' ? '% vs prior window' : ' pts vs prior window'}
            </p>
          )}
        </article>
      ))}
    </div>
  );
});

export const FormCoverage = memo(function FormCoverage({
  data,
  isLoading,
}: {
  data: FormBreakdown[];
  isLoading: boolean;
}) {
  return (
    <section className={cn(glass.cardGold, 'p-5')} aria-labelledby="form-coverage-title">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 id="form-coverage-title" className="text-sm font-semibold text-bone-50">
            {ANALYTICS_COPY.coverageTitle}
          </h3>
          <p className={cn(analytics.hint, 'mt-1')}>{ANALYTICS_COPY.coverageHint}</p>
        </div>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-white/5" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((item) => {
            const meta = FORM_META[item.form_type];
            const Icon = meta?.icon ?? ClipboardCheck;
            return (
              <div key={item.form_type}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-verdant-300" aria-hidden />
                    <span className="text-sm text-bone-100">{meta?.name ?? item.form_type}</span>
                  </div>
                  <span className={cn(analytics.value, 'text-sm', fillTone(item.percentage))}>
                    {item.submissions}/{item.expected} · {item.percentage}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-bone-50/10">
                  <div
                    className={cn('h-full rounded-full', fillBar(item.percentage))}
                    style={{ width: `${Math.min(item.percentage, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
});

export const PointsIntegrity = memo(function PointsIntegrity({
  stats,
}: {
  stats?: SafetyAnalyticsStats;
}) {
  const forms = stats?.total_compliance_points ?? 0;
  const announce = stats?.total_announcement_points ?? 0;
  const other = stats?.other_points ?? 0;
  const total = stats?.total_combined_points ?? 0;
  const parts = forms + announce + other;
  const balanced = parts === total;

  return (
    <section className={cn(glass.cardGold, 'p-5')} aria-labelledby="points-integrity-title">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 id="points-integrity-title" className="text-sm font-semibold text-bone-50">
          {ANALYTICS_COPY.pointsTitle}
        </h3>
        <MetricHint text={ANALYTICS_COPY.pointsHint} />
      </div>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-bone-200/60">Forms</dt>
          <dd className={cn(analytics.value, 'text-verdant-200')}>{forms.toLocaleString()}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-bone-200/60">Announcements</dt>
          <dd className={cn(analytics.value, 'text-amber-200')}>{announce.toLocaleString()}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-bone-200/60">Other ledger</dt>
          <dd className={cn(analytics.value, other < 0 ? 'text-rose-200' : 'text-bone-100')}>
            {other.toLocaleString()}
          </dd>
        </div>
        <div className="flex justify-between border-t border-bone-50/10 pt-2">
          <dt className="font-medium text-bone-50">Ledger total</dt>
          <dd className={cn(analytics.value, 'font-semibold')}>{total.toLocaleString()}</dd>
        </div>
      </dl>
      <p className={cn('mt-3 text-xs', balanced ? 'text-verdant-300/80' : 'text-amber-300')}>
        {balanced ? 'Parts equal the ledger.' : `Parts sum to ${parts.toLocaleString()} — check Other.`}
      </p>
    </section>
  );
});

export const DenominatorCard = memo(function DenominatorCard({
  stats,
}: {
  stats?: SafetyAnalyticsStats;
}) {
  return (
    <section className={cn(glass.subtleGold, 'p-5')}>
      <h3 className="text-sm font-semibold text-bone-50">Recorded attendance</h3>
      <p className={cn(analytics.hint, 'mt-2')}>
        The 9 AM cron writes a row for every field worker every weekday, even when nobody filed.
        Those empty rows ({stats?.empty_attendance_rows ?? 0}) used to sit in the compliance
        denominator. Among recorded rows, the full-packet rate is{' '}
        <span className={cn(analytics.value, 'text-bone-100')}>{stats?.full_packet_among_recorded ?? 0}%</span>
        — useful as a footnote, not the headline.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className={analytics.label}>{ANALYTICS_COPY.daysWithForms}</dt>
          <dd className={cn(analytics.value, 'mt-1 text-lg')}>{stats?.days_with_any_form ?? 0}</dd>
        </div>
        <div>
          <dt className={analytics.label}>{ANALYTICS_COPY.fullPacketDays}</dt>
          <dd className={cn(analytics.value, 'mt-1 text-lg')}>{stats?.days_with_full_packet ?? 0}</dd>
        </div>
      </dl>
    </section>
  );
});
