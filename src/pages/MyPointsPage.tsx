import { useMemo, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Flame,
  ChevronRight,
  ShoppingBag,
  Sparkles,
  Ticket,
  History,
  PieChart,
  Gift,
  Clock,
  TreePine,
} from 'lucide-react';
import { WalletHero } from '@/components/points/WalletHero';
import {
  BadgeCase,
  RecognitionFeed,
  StandingsPanel,
  TierProgressBar,
  WeeklyStreakPanel,
} from '@/components/gamification';
import DashboardLayout from '@/layouts/DashboardLayout';
import { useDashboardCardTheme } from '@/contexts/dashboardCardTheme';
import { glass } from '@/lib/glass';
import { useAuth } from '@/contexts/AuthContext';
import { useTotalPoints } from '@/hooks/useAnnouncementRewards';
import { useUserMonthlyEntries, useUserRaffleEntries, useTotalMonthlyEntries } from '@/hooks/safetyRewards';
import { usePointsBySource, usePointTransactions } from '@/hooks/points';
import { useUserRedemptions } from '@/hooks/redemption';
import { useBadgeProgress, useUserLevel, useWeeklyStreak } from '@/hooks/gamification';
import { REDEMPTION_STATUS_LABELS } from '@/lib/redemptionCopy';
import {
  groupPointsByBreakdown,
  sumPointsBySource,
  formatActivityLine,
} from '@/lib/pointLabels';
import { computeRaffleStanding } from '@/lib/raffleStanding';
import { formatTierLabel, getTierTheme, GROWTH_TEXTURE_STYLE } from '@/lib/gamification/tiers';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pageEnter = { duration: 0.2 };

const Phase2ChallengeSection = lazy(
  () => import('@/components/gamification/Phase2ChallengeSection'),
);
const Phase2SeasonStandingsSection = lazy(
  () => import('@/components/gamification/Phase2SeasonStandingsSection'),
);

export default function MyPointsPage() {
  const { user } = useAuth();
  const { cardClass, subtleClass } = useDashboardCardTheme();

  const now = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, []);

  const { data: balance = 0, isLoading: balanceLoading } = useTotalPoints();
  const { data: level, isLoading: levelLoading } = useUserLevel(user?.id);
  const { data: weeklyStreak, isLoading: weeklyStreakLoading } = useWeeklyStreak(user?.id);
  const { data: badgeProgress = [], isLoading: badgeProgressLoading } = useBadgeProgress(user?.id);
  const { data: bySource = [], isLoading: breakdownLoading } = usePointsBySource();
  const { data: transactions = [], isLoading: activityLoading } = usePointTransactions();
  const { data: redemptions = [], isLoading: redemptionsLoading } = useUserRedemptions();

  const pendingRedemptions = useMemo(
    () => redemptions.filter((r) => r.status === 'pending'),
    [redemptions],
  );
  const { data: entries } = useUserMonthlyEntries(
    user?.id,
    now.year,
    now.month,
  );
  const { data: raffleEntries = 0, isLoading: raffleEntriesLoading } = useUserRaffleEntries(
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
        userEntries: raffleEntries,
        totalPoolEntries: stats?.totalClaims ?? 0,
        totalParticipants: stats?.totalParticipants ?? 0,
      }),
    [raffleEntries, stats?.totalClaims, stats?.totalParticipants],
  );

  const tierTheme = level ? getTierTheme(level.tierKey) : getTierTheme('sapling');

  return (
    <DashboardLayout title="My Progress" pageHeading>
      <div className="space-y-6 pb-8 max-w-2xl mx-auto" data-testid="my-progress-page">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={pageEnter}
        >
          <h1 className="text-2xl font-bold text-white">My Progress</h1>
          <p className="text-sm text-white/60 mt-1">
            Wallet, tier ladder, badges, and crew recognition — one hub.
          </p>
        </motion.header>

        {/* Wallet anchor */}
        <div className="space-y-4">
          <WalletHero
            balance={balance}
            isLoading={balanceLoading}
            headingId="wallet-heading"
            testId="my-points-balance"
            subtitle="Spendable points from your safety ledger."
          />

          {(redemptionsLoading || pendingRedemptions.length > 0) && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...pageEnter, delay: 0.08 }}
              aria-labelledby="pending-redemptions-heading"
              className={cardClass}
              data-testid="my-points-pending-redemptions"
            >
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-amber-400" aria-hidden />
                  <h2 id="pending-redemptions-heading" className="text-sm font-semibold text-white">
                    Pending redemptions
                  </h2>
                </div>
                {redemptionsLoading ? (
                  <div className="space-y-2" aria-busy="true" aria-label="Loading pending redemptions">
                    {[1, 2].map((i) => (
                      <div key={i} className={`h-14 rounded-xl animate-pulse ${glass.subtle}`} />
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-2" data-testid="my-points-pending-list">
                    {pendingRedemptions.map((row) => (
                      <li
                        key={row.id}
                        className={`${subtleClass} p-3 flex items-start gap-3`}
                        data-testid={`pending-redemption-${row.id}`}
                      >
                        <div className="w-9 h-9 rounded-lg bg-amber-400/10 flex items-center justify-center shrink-0">
                          <Gift className="w-4 h-4 text-amber-300" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-white truncate">{row.item_name}</p>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border text-amber-300 bg-amber-500/10 border-amber-500/25">
                              {REDEMPTION_STATUS_LABELS[row.status]}
                            </span>
                          </div>
                          <p className="text-xs text-white/50 mt-1 tabular-nums">
                            {row.point_cost} pts · Requested{' '}
                            {new Date(row.requested_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              timeZone: 'America/Chicago',
                            })}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.section>
          )}
        </div>

        {/* Progression — lifetime tier ladder */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...pageEnter, delay: 0.09 }}
          aria-labelledby="progression-heading"
          className={cardClass}
          data-testid="my-progress-progression"
          style={{
            ...GROWTH_TEXTURE_STYLE,
            backgroundColor: 'rgba(8, 12, 10, 0.85)',
          }}
        >
          <div className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <TreePine className={`h-4 w-4 ${tierTheme.accentClass}`} aria-hidden />
              <h2 id="progression-heading" className="text-sm font-semibold text-white">
                Tier progression
              </h2>
            </div>
            {levelLoading || !level ? (
              <div className={`h-20 animate-pulse rounded-xl ${glass.subtle}`} aria-busy="true" />
            ) : (
              <>
                <p className={`text-lg font-bold ${tierTheme.accentClass}`}>
                  {formatTierLabel(level.tierName, level.subLevelLabel)}
                </p>
                <p className="mt-0.5 text-xs text-white/50">
                  {level.lifetimeEarned} lifetime earned · ladder runs on points you keep, not wallet spend
                </p>
                <TierProgressBar level={level} className="mt-3" />
              </>
            )}
          </div>
        </motion.section>

        {/* Badge case + weekly streak */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...pageEnter, delay: 0.1 }}
          className="space-y-4"
          aria-labelledby="badges-heading"
        >
          <div>
            <h2 id="badges-heading" className="text-lg font-semibold text-white">
              Badge case
            </h2>
            <p className="text-xs text-white/50 mt-0.5">Progress toward the next prestige tier</p>
          </div>
          <BadgeCase items={badgeProgress} isLoading={badgeProgressLoading} />
          <WeeklyStreakPanel streak={weeklyStreak} isLoading={weeklyStreakLoading} />
          <Suspense fallback={null}>
            <Phase2ChallengeSection />
          </Suspense>
        </motion.section>

        {/* Recognition + standings */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...pageEnter, delay: 0.12 }}
          className={`${cardClass} p-4 space-y-6`}
        >
          <RecognitionFeed limit={15} />
          <Suspense fallback={null}>
            <Phase2SeasonStandingsSection />
          </Suspense>
          <StandingsPanel limit={10} />
        </motion.section>

        {/* Monthly rewards — raffle + briefing streak grouped */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...pageEnter, delay: 0.14 }}
          aria-labelledby="monthly-heading"
          className="space-y-3"
        >
          <div>
            <h2 id="monthly-heading" className="text-lg font-semibold text-white">
              This month
            </h2>
            <p className="text-xs text-white/50 mt-0.5">Raffle entries and briefing streak</p>
          </div>
          <div
            className={`grid gap-4 ${
              entries && entries.currentStreak > 0 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
            }`}
          >
            <section
              aria-labelledby="raffle-heading"
              className={cardClass}
              data-testid="my-points-raffle"
            >
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Ticket className="w-4 h-4 text-emerald-400" aria-hidden />
                  <h3 id="raffle-heading" className="text-sm font-semibold text-white">
                    {MONTHS[now.month - 1]} raffle
                  </h3>
                </div>
                {raffleEntriesLoading ? (
                  <div
                    className={`h-16 rounded-xl animate-pulse ${glass.subtle}`}
                    aria-busy="true"
                    aria-label="Loading raffle entries"
                  />
                ) : (
                  <>
                    <p className="text-3xl font-bold text-emerald-400 tabular-nums">
                      {raffleEntries}
                    </p>
                    <p className="text-xs text-white/50 mt-1">{raffleStanding.entriesLabel}</p>
                    {entries && entries.totalBonus > 0 && (
                      <p className="text-xs text-emerald-400/80 mt-1">
                        {entries.baseEntries} daily claim{entries.baseEntries !== 1 ? 's' : ''}
                        {' '}+ {entries.totalBonus} streak bonus
                      </p>
                    )}
                    {raffleStanding.oddsLabel && (
                      <p className="text-xs text-white/60 mt-2">{raffleStanding.oddsLabel}</p>
                    )}
                    {raffleStanding.participantsLabel && (
                      <p className="text-xs text-white/40 mt-1">{raffleStanding.participantsLabel}</p>
                    )}
                  </>
                )}
              </div>
            </section>

            {entries && entries.currentStreak > 0 && (
              <section className={cardClass} data-testid="my-points-briefing-streak">
                <div className={`${subtleClass} p-4 h-full flex flex-col justify-center`}>
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-400" aria-hidden />
                    <span className="text-sm text-white/80 font-medium">
                      {entries.currentStreak}-day briefing streak
                    </span>
                  </div>
                  {entries.nextMilestone && (
                    <p className="text-xs text-white/50 mt-1 ml-6">
                      {entries.nextMilestone.daysNeeded} more day
                      {entries.nextMilestone.daysNeeded !== 1 ? 's' : ''} for +{entries.nextMilestone.bonusEntries} bonus entries
                    </p>
                  )}
                </div>
              </section>
            )}
          </div>
        </motion.section>

        {/* Ledger — breakdown + activity grouped */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...pageEnter, delay: 0.15 }}
          aria-labelledby="ledger-heading"
          className="space-y-4"
        >
          <div>
            <h2 id="ledger-heading" className="text-lg font-semibold text-white">
              Your ledger
            </h2>
            <p className="text-xs text-white/50 mt-0.5">How you earned and recent activity</p>
          </div>

          <section
            aria-labelledby="breakdown-heading"
            className={cardClass}
            data-testid="my-points-breakdown"
          >
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <PieChart className="w-4 h-4 text-amber-400" aria-hidden />
                <h3 id="breakdown-heading" className="text-sm font-semibold text-white">
                  How you earned
                </h3>
              </div>
              {breakdownLoading ? (
                <div className="space-y-2" aria-busy="true" aria-label="Loading breakdown">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={`h-10 rounded-xl animate-pulse ${glass.subtle}`} />
                  ))}
                </div>
              ) : breakdown.length === 0 ? (
                <div className={`${glass.subtle} p-8 text-center`}>
                  <PieChart className="w-10 h-10 text-amber-400/40 mx-auto mb-3" aria-hidden />
                  <p className="text-white/70 text-sm font-medium">No earnings yet</p>
                  <p className="text-white/50 text-xs mt-1 leading-relaxed">
                    Complete safety briefings and daily forms to start earning points.
                  </p>
                </div>
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
          </section>

          <section
            aria-labelledby="activity-heading"
            className={cardClass}
            data-testid="my-points-activity"
          >
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-white/60" aria-hidden />
                <h3 id="activity-heading" className="text-sm font-semibold text-white">
                  Recent activity
                </h3>
              </div>
              {activityLoading ? (
                <div className="space-y-2" aria-busy="true" aria-label="Loading activity">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={`h-12 rounded-xl animate-pulse ${glass.subtle}`} />
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <div className={`${glass.subtle} p-8 text-center`}>
                  <History className="w-10 h-10 text-amber-400/40 mx-auto mb-3" aria-hidden />
                  <p className="text-white/70 text-sm font-medium">No point activity yet</p>
                  <p className="text-white/50 text-xs mt-1 leading-relaxed">
                    Transactions from briefings, forms, and redemptions will show up here.
                  </p>
                </div>
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
                        className="text-[10px] text-white/40 shrink-0 tabular-nums"
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
          </section>
        </motion.section>

        {/* Hub links */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...pageEnter, delay: 0.2 }}
          className="space-y-3"
          aria-labelledby="hub-heading"
          data-testid="my-points-hub-links"
        >
          <h2 id="hub-heading" className="text-lg font-semibold text-white">
            Go further
          </h2>
          <Link
            to="/rewards-store"
            className={`${cardClass} flex items-center justify-between gap-3 p-4 hover:border-amber-400/30 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 rounded-2xl`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400/15 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-amber-300" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Rewards Store</p>
                <p className="text-xs text-white/50">Spend points on gear and gift cards</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-amber-400/60" aria-hidden />
          </Link>
          <Link
            to="/safety-rewards#ways-to-earn-heading"
            className={`${cardClass} flex items-center justify-between gap-3 p-4 hover:border-amber-500/30 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 rounded-2xl`}
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
