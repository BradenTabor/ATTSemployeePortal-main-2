import { memo, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  ChevronRight,
  ClipboardCheck,
  Flame,
  Megaphone,
  Search,
  Trophy,
  X,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { Z } from '@/lib/zIndex';
import { ANALYTICS_COPY, type Period, type UnifiedLeaderboardEntry } from '@/lib/analytics';
import { useUserSafetyDetail } from '@/hooks/queries/useSafetyAnalytics';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useModalOverlay } from '@/hooks/useModalOverlay';
import { cn } from '@/lib/utils';
import { analytics, analyticsFocus, fillTone, scoreTone } from './tokens';

function FormTicks({ entry }: { entry: UnifiedLeaderboardEntry }) {
  const ticks = [
    { key: 'D', count: entry.dvir_count, label: 'DVIR' },
    { key: 'E', count: entry.equipment_count, label: 'Equipment' },
    { key: 'J', count: entry.jsa_count, label: 'JSA' },
  ];
  return (
    <span className="hidden items-center gap-1 sm:inline-flex" aria-label="Forms filed">
      {ticks.map((tick) => (
        <span
          key={tick.key}
          title={`${tick.label}: ${tick.count}`}
          className={cn(
            'inline-flex h-5 min-w-[20px] items-center justify-center rounded px-1 font-mono text-[10px]',
            tick.count > 0 ? 'bg-verdant-500/15 text-verdant-200' : 'bg-white/5 text-bone-200/30',
          )}
        >
          {tick.key}
        </span>
      ))}
    </span>
  );
}

const LeaderboardRow = memo(function LeaderboardRow({
  entry,
  onClick,
}: {
  entry: UnifiedLeaderboardEntry;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full min-h-[52px] items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors duration-150',
        analyticsFocus,
        entry.is_at_risk
          ? 'border-rose-500/20 bg-rose-500/[0.06] hover:border-rose-400/35'
          : entry.rank <= 3
            ? 'border-verdant-400/20 bg-verdant-500/[0.06] hover:border-verdant-400/35'
            : 'border-bone-50/8 bg-white/[0.02] hover:border-bone-50/16 hover:bg-white/[0.04]',
      )}
    >
      <span className={cn(analytics.value, 'w-6 text-center text-xs text-bone-200/50')}>
        {entry.rank}
      </span>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-bone-50 to-verdant-300 text-sm font-semibold text-ink-950">
        {entry.full_name.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-bone-50">{entry.full_name}</span>
          {entry.current_streak >= 3 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[11px] text-orange-200">
              <Flame className="h-3 w-3" aria-hidden />
              {entry.current_streak}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-bone-200/50">
          Fill {entry.form_fill_rate}% ({entry.forms_completed}/{entry.expected_forms}) · Packet {entry.full_packet_rate}% · {entry.total_points} pts
        </span>
      </span>
      <FormTicks entry={entry} />
      <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', scoreTone(entry.safety_score))}>
        {entry.safety_score}
      </span>
      <ChevronRight className="h-4 w-4 text-bone-200/25" aria-hidden />
    </button>
  );
});

export const LeaderboardPanel = memo(function LeaderboardPanel({
  entries,
  isLoading,
  onSelect,
}: {
  entries: UnifiedLeaderboardEntry[];
  isLoading: boolean;
  onSelect: (userId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<'all' | 'field' | 'risk'>('all');
  const [sort, setSort] = useState<'score' | 'fill' | 'packet' | 'name'>('score');
  const debounced = useDebouncedValue(query, 300);

  const filtered = useMemo(() => {
    const next = entries.filter((entry) => {
      if (role === 'field' && !entry.is_field) return false;
      if (role === 'risk' && !entry.is_at_risk) return false;
      if (!debounced) return true;
      const q = debounced.toLowerCase();
      return entry.full_name.toLowerCase().includes(q) || (entry.email?.toLowerCase().includes(q) ?? false);
    });
    return [...next].sort((a, b) => {
      if (sort === 'fill') return b.form_fill_rate - a.form_fill_rate || a.full_name.localeCompare(b.full_name);
      if (sort === 'packet') return b.full_packet_rate - a.full_packet_rate || a.full_name.localeCompare(b.full_name);
      if (sort === 'name') return a.full_name.localeCompare(b.full_name);
      return a.rank - b.rank;
    });
  }, [entries, debounced, role, sort]);

  return (
    <section className={cn(glass.cardGold, 'overflow-hidden')} aria-labelledby="crew-board-title">
      <div className="flex flex-col gap-3 border-b border-bone-50/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-verdant-300" aria-hidden />
          <h3 id="crew-board-title" className="text-sm font-semibold text-bone-50">
            {ANALYTICS_COPY.leaderboardTitle}
          </h3>
          <span className="text-xs text-bone-200/45">({filtered.length})</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'field', 'risk'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRole(key)}
              className={cn(
                'min-h-[40px] rounded-lg px-3 text-xs font-medium',
                analyticsFocus,
                role === key
                  ? 'bg-verdant-500/15 text-verdant-100'
                  : 'text-bone-200/50 hover:bg-white/5',
              )}
            >
              {key === 'all' ? 'Everyone' : key === 'field' ? 'Field only' : 'At risk'}
            </button>
          ))}
          <label className="sr-only" htmlFor="crew-sort">
            Sort crew board
          </label>
          <select
            id="crew-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="min-h-[40px] rounded-lg border border-bone-50/10 bg-ink-950/80 px-3 text-xs text-bone-100"
          >
            <option value="score">Sort: score</option>
            <option value="fill">Sort: form fill</option>
            <option value="packet">Sort: full packet</option>
            <option value="name">Sort: name</option>
          </select>
        </div>
      </div>
      <div className="relative border-b border-bone-50/8 px-4 py-3">
        <Search className="absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-bone-200/35" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search crew…"
          className="w-full rounded-xl border border-bone-50/10 bg-ink-950/70 py-3 pl-10 pr-3 text-base text-bone-50 placeholder:text-bone-200/30"
        />
      </div>
      <div className="max-h-[520px] space-y-2 overflow-y-auto p-3">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />
          ))
        ) : filtered.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-bone-200/50">
            {query ? ANALYTICS_COPY.emptyFilter : ANALYTICS_COPY.emptyLeaderboard}
          </p>
        ) : (
          filtered.map((entry) => (
            <LeaderboardRow key={entry.user_id} entry={entry} onClick={() => onSelect(entry.user_id)} />
          ))
        )}
      </div>
    </section>
  );
});

export const AtRiskPanel = memo(function AtRiskPanel({
  entries,
  onSelect,
}: {
  entries: UnifiedLeaderboardEntry[];
  onSelect: (userId: string) => void;
}) {
  return (
    <section className={cn(glass.cardGold, 'p-5')} aria-labelledby="at-risk-title">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-rose-300" aria-hidden />
        <h3 id="at-risk-title" className="text-sm font-semibold text-bone-50">
          {ANALYTICS_COPY.atRiskTitle}
        </h3>
      </div>
      <p className={cn(analytics.hint, 'mb-4')}>{ANALYTICS_COPY.atRiskHint}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-verdant-200/80">{ANALYTICS_COPY.emptyAtRisk}</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.user_id}>
              <button
                type="button"
                onClick={() => onSelect(entry.user_id)}
                className={cn(
                  'flex w-full min-h-[44px] items-center justify-between rounded-xl border border-rose-500/15 bg-rose-500/[0.05] px-3 py-2 text-left',
                  analyticsFocus,
                )}
              >
                <span>
                  <span className="block text-sm font-medium text-bone-50">{entry.full_name}</span>
                  <span className={cn('text-xs', fillTone(entry.form_fill_rate))}>
                    {entry.form_fill_rate}% fill · {entry.full_compliance_days === 0 ? 'no full packet' : `${entry.full_packet_rate}% packet`}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-rose-200/50" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
});

export const UserCaseDrawer = memo(function UserCaseDrawer({
  userId,
  isOpen,
  onClose,
  period,
}: {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  period: Period;
}) {
  const { data, isLoading } = useUserSafetyDetail(userId || '', period);
  const { modalRef } = useModalOverlay({ isOpen, onClose, zIndex: Z.modal });
  const reduce = useReducedMotion();

  const content = (
    <AnimatePresence>
      {isOpen && (
      <motion.div
        initial={reduce ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
        style={{ zIndex: Z.modal }}
        onClick={onClose}
      >
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-case-title"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={(e) => e.stopPropagation()}
          className={cn(glass.elevated, 'max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl p-0 sm:rounded-2xl')}
        >
          {isLoading || !data ? (
            <div className="p-8 text-center text-sm text-bone-200/50">Loading case file…</div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-bone-50/10 px-5 py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-bone-50 to-verdant-300 text-lg font-semibold text-ink-950">
                  {data.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id="user-case-title" className="truncate text-lg font-semibold text-bone-50">
                    {data.full_name}
                  </h2>
                  <p className="text-xs capitalize text-bone-200/50">{data.role.replace('_', ' ')}</p>
                </div>
                <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', scoreTone(data.safety_score))}>
                  {data.safety_score}
                </span>
                <button type="button" onClick={onClose} className={cn('rounded-lg p-2 hover:bg-white/5', analyticsFocus)} aria-label="Close">
                  <X className="h-4 w-4 text-bone-200/50" />
                </button>
              </div>
              <div className="space-y-4 p-5">
                <div className="grid grid-cols-3 gap-2">
                  <div className={cn(glass.subtle, 'p-3 text-center')}>
                    <ClipboardCheck className="mx-auto mb-1 h-4 w-4 text-verdant-300" aria-hidden />
                    <p className={cn(analytics.value, 'text-lg')}>{data.compliance_points}</p>
                    <p className={analytics.label}>Forms</p>
                  </div>
                  <div className={cn(glass.subtle, 'p-3 text-center')}>
                    <Megaphone className="mx-auto mb-1 h-4 w-4 text-amber-300" aria-hidden />
                    <p className={cn(analytics.value, 'text-lg')}>{data.announcement_points}</p>
                    <p className={analytics.label}>Announce</p>
                  </div>
                  <div className={cn(glass.subtle, 'p-3 text-center')}>
                    <Trophy className="mx-auto mb-1 h-4 w-4 text-bone-100" aria-hidden />
                    <p className={cn(analytics.value, 'text-lg')}>{data.total_points}</p>
                    <p className={analytics.label}>
                      Ledger
                      {data.total_points - data.compliance_points - data.announcement_points !== 0
                        ? ` · ${data.total_points - data.compliance_points - data.announcement_points} other`
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-bone-50/10 bg-white/[0.02] p-4">
                  <div>
                    <p className={cn(analytics.value, 'text-3xl', fillTone(data.form_fill_rate))}>{data.form_fill_rate}%</p>
                    <p className={analytics.label}>Form fill · {data.expected_forms} owed</p>
                  </div>
                  <div>
                    <p className={cn(analytics.value, 'text-3xl')}>{data.full_packet_rate}%</p>
                    <p className={analytics.label}>
                      Full packet · {data.full_compliance_days}/{data.compliance_days} days with forms
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {data.forms_breakdown.map((row) => (
                    <div key={row.form_type} className={cn(glass.subtle, 'p-3 text-center')}>
                      <p className={cn(analytics.value, 'text-lg', fillTone(row.percentage))}>{row.submissions}</p>
                      <p className={analytics.label}>{row.form_type.toUpperCase()}</p>
                      <p className="text-[11px] text-bone-200/40">{row.percentage}% of owed days</p>
                    </div>
                  ))}
                </div>
                {data.current_streak > 0 && (
                  <div className="flex items-center gap-3 rounded-xl border border-orange-500/20 bg-orange-500/10 p-3">
                    <Flame className="h-5 w-5 text-orange-300" aria-hidden />
                    <div>
                      <p className="text-sm font-semibold text-orange-100">{data.current_streak} weekday streak</p>
                      <p className="text-xs text-orange-200/60">Longest: {data.longest_streak} weekdays</p>
                    </div>
                  </div>
                )}
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-bone-50">Recent activity</h3>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {data.activity_timeline.length === 0 ? (
                      <p className="text-sm text-bone-200/45">No form or claim activity in this window.</p>
                    ) : (
                      data.activity_timeline.map((activity, idx) => (
                        <div key={`${activity.date}-${idx}`} className="flex items-center gap-2 border-b border-white/5 py-2 last:border-0">
                          {activity.type === 'compliance' ? (
                            <ClipboardCheck className="h-4 w-4 text-verdant-300" aria-hidden />
                          ) : (
                            <Megaphone className="h-4 w-4 text-amber-300" aria-hidden />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-bone-100">{activity.details}</p>
                            <p className="text-xs text-bone-200/40">{activity.date}</p>
                          </div>
                          <span className={cn(analytics.value, 'text-xs text-verdant-200')}>+{activity.points}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
});
