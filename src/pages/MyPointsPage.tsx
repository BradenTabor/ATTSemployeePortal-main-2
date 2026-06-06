import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Trophy,
  Flame,
  ChevronRight,
  ShoppingBag,
  Sparkles,
  Wallet,
  Ticket,
  History,
  PieChart,
} from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { useDashboardCardTheme } from '@/contexts/dashboardCardTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useTotalPoints } from '@/hooks/useAnnouncementRewards';
import { useUserMonthlyEntries, useTotalMonthlyEntries } from '@/hooks/safetyRewards';
import { usePointsBySource, usePointTransactions } from '@/hooks/points';
import {
  groupPointsByBreakdown,
  sumPointsBySource,
  formatActivityLine,
} from '@/lib/pointLabels';
import { computeRaffleStanding } from '@/lib/raffleStanding';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function MyPointsPage() {
  const { user } = useAuth();
  const { cardClass, subtleClass } = useDashboardCardTheme();

  const now = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, []);

  const { data: balance = 0, isLoading: balanceLoading } = useTotalPoints();
  const { data: bySource = [], isLoading: breakdownLoading } = usePointsBySource();
  const { data: transactions = [], isLoading: activityLoading } = usePointTransactions();
  const { data: entries, isLoading: entriesLoading } = useUserMonthlyEntries(
    user?.id,
    now.year,
    now.month,
  );
  const { data: stats } = useTotalMonthlyEntries(now.year, now.month);

  const breakdown = useMemo(() => groupPointsByBreakdown(bySource), [bySource]);
  const breakdownSum = useMemo(() => sumPointsBySource(bySource), [bySource]);
  const breakdownMismatch = !breakdownLoading && breakdownSum !== balance;

  const raffleStanding = useMemo(
    () =>
      computeRaffleStanding({
        userEntries: entries?.totalEntries ?? 0,
        totalPoolEntries: stats?.totalClaims ?? 0,
        totalParticipants: stats?.totalParticipants ?? 0,
      }),
    [entries?.totalEntries, stats?.totalClaims, stats?.totalParticipants],
  );

  return (
    <DashboardLayout title="My Points">
      <div className="space-y-5 pb-8 max-w-2xl mx-auto" data-testid="my-points-page">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-white">My Points</h1>
          <p className="text-sm text-white/50 mt-1">
            Your wallet, earning breakdown, and recent activity.
          </p>
        </motion.div>

        {/* 1. Balance */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          aria-labelledby="wallet-heading"
          className={`${cardClass} p-5 border-[#f4c979]/20 bg-gradient-to-br from-[#14110d]/80 via-[#0b0906] to-[#050403]`}
          data-testid="my-points-balance"
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#f4c979]/15 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-[#f4c979]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="wallet-heading" className="text-xs text-white/50 uppercase tracking-wider">
                Your balance
              </h2>
              {balanceLoading ? (
                <div className="h-10 w-28 bg-white/5 rounded animate-pulse mt-1" />
              ) : (
                <p className="text-4xl font-bold text-[#f4c979] flex items-center gap-2 mt-0.5 tabular-nums">
                  <Trophy className="w-8 h-8 text-amber-400" aria-hidden />
                  {balance}
                  <span className="text-lg font-semibold text-amber-400/70">pts</span>
                </p>
              )}
              <p className="text-xs text-white/40 mt-1">Spendable points from your safety ledger.</p>
            </div>
          </div>
        </motion.section>

        {/* 2. Raffle entries + odds */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          aria-labelledby="raffle-heading"
          className={cardClass}
          data-testid="my-points-raffle"
        >
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Ticket className="w-4 h-4 text-emerald-400" aria-hidden />
              <h2 id="raffle-heading" className="text-sm font-semibold text-white">
                {MONTHS[now.month - 1]} raffle
              </h2>
            </div>
            {entriesLoading ? (
              <div className="h-16 bg-white/[0.03] rounded animate-pulse" />
            ) : (
              <>
                <p className="text-3xl font-bold text-emerald-400 tabular-nums">
                  {entries?.totalEntries ?? 0}
                </p>
                <p className="text-xs text-white/40 mt-1">{raffleStanding.entriesLabel}</p>
                {entries && entries.totalBonus > 0 && (
                  <p className="text-xs text-emerald-400/80 mt-1">
                    {entries.baseEntries} daily claim{entries.baseEntries !== 1 ? 's' : ''}
                    {' '}+ {entries.totalBonus} streak bonus
                  </p>
                )}
                {raffleStanding.oddsLabel && (
                  <p className="text-xs text-white/50 mt-2">{raffleStanding.oddsLabel}</p>
                )}
                {raffleStanding.participantsLabel && (
                  <p className="text-xs text-white/30 mt-1">{raffleStanding.participantsLabel}</p>
                )}
              </>
            )}
          </div>
        </motion.section>

        {/* 4. Current streak (from entries hook — same as Safety Rewards) */}
        {entries && entries.currentStreak > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className={cardClass}
            data-testid="my-points-streak"
          >
            <div className={`${subtleClass} p-4 m-4`}>
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" aria-hidden />
                <span className="text-sm text-white/80 font-medium">
                  {entries.currentStreak}-day briefing streak
                </span>
              </div>
              {entries.nextMilestone && (
                <p className="text-xs text-white/40 mt-1 ml-6">
                  {entries.nextMilestone.daysNeeded} more day
                  {entries.nextMilestone.daysNeeded !== 1 ? 's' : ''} for +{entries.nextMilestone.bonusEntries} bonus entries
                </p>
              )}
            </div>
          </motion.section>
        )}

        {/* 3. Breakdown by source */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          aria-labelledby="breakdown-heading"
          className={cardClass}
          data-testid="my-points-breakdown"
        >
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <PieChart className="w-4 h-4 text-amber-400" aria-hidden />
              <h2 id="breakdown-heading" className="text-sm font-semibold text-white">
                How you earned
              </h2>
            </div>
            {breakdownLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-white/[0.03] rounded animate-pulse" />
                ))}
              </div>
            ) : breakdown.length === 0 ? (
              <p className="text-sm text-white/40">
                Complete safety briefings and daily forms to start earning points.
              </p>
            ) : (
              <ul className="space-y-2" data-testid="my-points-breakdown-list">
                {breakdown.map((bucket) => (
                  <li
                    key={bucket.key}
                    className={`${subtleClass} flex items-center justify-between gap-3 p-3`}
                  >
                    <span className="text-sm text-white/80">{bucket.label}</span>
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        bucket.total < 0 ? 'text-red-300' : 'text-emerald-300'
                      }`}
                    >
                      {bucket.total >= 0 ? '+' : ''}
                      {bucket.total} pts
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {breakdownMismatch && (
              <p className="text-xs text-amber-300/80 mt-3" role="status" data-testid="breakdown-reconcile-warning">
                Breakdown total ({breakdownSum}) differs from wallet ({balance}). Contact support if this persists.
              </p>
            )}
          </div>
        </motion.section>

        {/* 5. Activity feed */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          aria-labelledby="activity-heading"
          className={cardClass}
          data-testid="my-points-activity"
        >
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-white/60" aria-hidden />
              <h2 id="activity-heading" className="text-sm font-semibold text-white">
                Recent activity
              </h2>
            </div>
            {activityLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-white/[0.03] rounded animate-pulse" />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-white/40">No point activity yet.</p>
            ) : (
              <ul className="space-y-2" data-testid="my-points-activity-list">
                {transactions.map((tx) => (
                  <li
                    key={tx.id}
                    className={`${subtleClass} p-3 flex items-start justify-between gap-3`}
                    data-testid={`activity-row-${tx.id}`}
                  >
                    <p className="text-sm text-white/80">
                      {formatActivityLine(tx, { itemName: tx.item_name })}
                    </p>
                    <time
                      className="text-[10px] text-white/30 shrink-0 tabular-nums"
                      dateTime={tx.created_at}
                    >
                      {new Date(tx.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'America/Chicago',
                      })}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.section>

        {/* 6. Hub links */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="space-y-3"
          aria-label="Points hub links"
          data-testid="my-points-hub-links"
        >
          <Link
            to="/rewards-store"
            className={`${cardClass} flex items-center justify-between gap-3 p-4 hover:border-[#f4c979]/30 transition-colors`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#f4c979]/15 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-[#f4c979]" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Rewards Store</p>
                <p className="text-xs text-white/50">Spend points on gear and gift cards</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#f4c979]/60" aria-hidden />
          </Link>
          <Link
            to="/safety-rewards#ways-to-earn-heading"
            className={`${cardClass} flex items-center justify-between gap-3 p-4 hover:border-amber-500/30 transition-colors`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-400" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Ways to Earn</p>
                <p className="text-xs text-white/50">See all the ways to grow your balance</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-amber-400/60" aria-hidden />
          </Link>
        </motion.section>
      </div>
    </DashboardLayout>
  );
}
