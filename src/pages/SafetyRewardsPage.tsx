import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Flame, PartyPopper, Users, Gift, ChevronRight, ShoppingBag, Wallet } from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { isFieldRole } from '../config/safetyBriefing';
import {
  useMonthlyReward,
  useMonthlyDrawing,
  useUserMonthlyEntries,
  useTotalMonthlyEntries,
} from '../hooks/safetyRewards';
import MonthlyCalendarGrid from '../components/safety-rewards/MonthlyCalendarGrid';
import WaysToEarn from '../components/safety-rewards/WaysToEarn';
import { useDashboardCardTheme } from '../contexts/dashboardCardTheme';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function SafetyRewardsPage() {
  const { user, role } = useAuth();
  const { cardClass, subtleClass } = useDashboardCardTheme();

  const now = useMemo(() => {
    const d = new Date();
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      date: d,
    };
  }, []);

  const isField = isFieldRole(role);

  const { data: reward, isLoading: rewardLoading } = useMonthlyReward(now.year, now.month);
  const { data: drawing } = useMonthlyDrawing(now.year, now.month);
  const { data: entries, isLoading: entriesLoading } = useUserMonthlyEntries(
    user?.id,
    now.year,
    now.month,
  );
  const { data: stats } = useTotalMonthlyEntries(now.year, now.month);

  // Past winners: previous 3 months
  const pastMonths = useMemo(() => {
    const result: { year: number; month: number }[] = [];
    for (let i = 1; i <= 3; i++) {
      let m = now.month - i;
      let y = now.year;
      if (m < 1) {
        m += 12;
        y -= 1;
      }
      result.push({ year: y, month: m });
    }
    return result;
  }, [now]);

  // Calendar data
  const calendarData = useMemo(() => {
    if (!entries) return { claimed: new Set<number>(), announcements: new Set<number>() };

    const claimed = new Set(
      entries.claimedDays.map((d) => new Date(d + 'T12:00:00').getDate()),
    );
    const announcements = new Set(
      entries.announcementDays.map((d) => new Date(d + 'T12:00:00').getDate()),
    );
    return { claimed, announcements };
  }, [entries]);

  return (
    <DashboardLayout title="Safety Rewards" pageHeading>
      <div className="space-y-5 pb-8 max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-2xl font-bold text-white">Safety Rewards</h1>
          <p className="text-sm text-white/50 mt-1">
            {MONTHS[now.month - 1]} {now.year}
          </p>
        </motion.div>

        {/* My Points + Rewards Store links */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="space-y-3"
        >
          <Link
            to="/my-points"
            className={`${cardClass} flex items-center justify-between gap-3 p-4 hover:border-emerald-500/30 transition-colors`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-emerald-400" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">My Points</p>
                <p className="text-xs text-white/50">Wallet, breakdown, and activity</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-emerald-400/60" aria-hidden />
          </Link>
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
        </motion.div>

        {/* Prize Display Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {rewardLoading ? (
            <div className={`${cardClass} p-5 animate-pulse`}>
              <div className="h-40 bg-white/[0.03] rounded-xl mb-4" />
              <div className="h-5 w-48 bg-white/5 rounded mx-auto" />
            </div>
          ) : reward ? (
            <div className={`${cardClass} overflow-hidden`}>
              {reward.grand_prize_image_url ? (
                <div className="w-full h-48 sm:h-56">
                  <img
                    src={reward.grand_prize_image_url}
                    alt={reward.grand_prize_name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-40 bg-gradient-to-br from-[#f6dcb2]/10 via-transparent to-emerald-500/10 flex items-center justify-center">
                  <Trophy className="w-16 h-16 text-[#f6dcb2]/20" />
                </div>
              )}
              <div className="p-4 text-center">
                <p className="text-xs text-[#f6dcb2]/60 font-medium uppercase tracking-wider mb-1">
                  Grand Prize
                </p>
                <h2 className="text-lg font-bold text-white">
                  {reward.grand_prize_name}
                </h2>
                {reward.grand_prize_description && (
                  <p className="text-sm text-white/50 mt-1">
                    {reward.grand_prize_description}
                  </p>
                )}
              </div>

              {/* Runner-up prizes */}
              {(reward.runner_up_1_name || reward.runner_up_2_name) && (
                <div className="border-t border-white/[0.06] px-4 py-3 flex gap-3">
                  {reward.runner_up_1_name && (
                    <div className="flex-1 text-center">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider">
                        Runner-up
                      </p>
                      <p className="text-sm text-white/70 font-medium mt-0.5">
                        {reward.runner_up_1_name}
                      </p>
                    </div>
                  )}
                  {reward.runner_up_2_name && (
                    <div className="flex-1 text-center">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider">
                        Runner-up
                      </p>
                      <p className="text-sm text-white/70 font-medium mt-0.5">
                        {reward.runner_up_2_name}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className={`${cardClass} p-8 text-center`}>
              <Gift className="w-10 h-10 text-white/10 mx-auto mb-3" />
              <p className="text-sm text-white/40">
                Reward coming soon — check back!
              </p>
            </div>
          )}
        </motion.div>

        {/* Entries Summary (field roles only) */}
        {isField ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cardClass}
          >
            {entriesLoading ? (
              <div className="p-4 animate-pulse">
                <div className="h-12 w-20 bg-white/5 rounded mx-auto mb-2" />
                <div className="h-4 w-40 bg-white/5 rounded mx-auto" />
              </div>
            ) : entries ? (
              <div className="p-4">
                <div className="text-center mb-3">
                  <p className="text-xs text-white/40 mb-1">Your entries this month</p>
                  <p className="text-4xl font-bold text-emerald-400">
                    {entries.totalEntries}
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    {entries.baseEntries} daily claim{entries.baseEntries !== 1 ? 's' : ''}
                    {entries.totalBonus > 0 && (
                      <span className="text-emerald-400">
                        {' '}+ {entries.totalBonus} streak bonus
                      </span>
                    )}
                  </p>
                </div>

                {/* Streak indicator */}
                {entries.currentStreak > 0 && (
                  <div className={`${subtleClass} p-3 rounded-lg mt-3`}>
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-400" />
                      <span className="text-sm text-white/80 font-medium">
                        {entries.currentStreak}-day streak
                      </span>
                    </div>
                    {entries.nextMilestone && (
                      <p className="text-xs text-white/40 mt-1 ml-6">
                        {entries.nextMilestone.daysNeeded} more day{entries.nextMilestone.daysNeeded !== 1 ? 's' : ''} to earn +{entries.nextMilestone.bonusEntries} bonus entries!
                      </p>
                    )}
                  </div>
                )}

                {/* Participant count */}
                {stats && stats.totalParticipants > 0 && (
                  <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-white/30">
                    <Users className="w-3 h-3" />
                    {stats.totalParticipants} participant{stats.totalParticipants !== 1 ? 's' : ''} this month
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 text-center">
                <p className="text-sm text-white/40">
                  Claim your daily safety briefing to start earning raffle entries!
                </p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`${cardClass} p-4 text-center`}
          >
            <Trophy className="w-6 h-6 text-[#f6dcb2]/30 mx-auto mb-2" />
            <p className="text-sm text-white/50">
              Watch the drawing at month end!
            </p>
            {stats && stats.totalParticipants > 0 && (
              <p className="text-xs text-white/30 mt-1">
                {stats.totalParticipants} participant{stats.totalParticipants !== 1 ? 's' : ''} entered so far
              </p>
            )}
          </motion.div>
        )}

        {/* Ways to Earn — static reference (no live point_rules fetch) */}
        <WaysToEarn />

        {/* Calendar Grid */}
        {isField && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`${cardClass} p-4`}
          >
            <h3 className="text-sm font-semibold text-white mb-3">
              {MONTHS[now.month - 1]} Progress
            </h3>
            <MonthlyCalendarGrid
              year={now.year}
              month={now.month}
              claimedDays={calendarData.claimed}
              announcementDays={calendarData.announcements}
              today={now.day}
            />

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-5 justify-center">
              <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
                Claimed
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                <div className="w-2.5 h-2.5 rounded-full border border-red-500/40" />
                Missed
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                No briefing
              </div>
            </div>
          </motion.div>
        )}

        {/* Drawing Result */}
        {drawing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35 }}
            className={`${cardClass} p-5 text-center border-emerald-500/20`}
          >
            <PartyPopper className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-xs text-emerald-400/60 font-medium uppercase tracking-wider mb-1">
              Winner
            </p>
            <p className="text-lg font-bold text-white">
              {drawing.grand_prize_winner?.full_name ?? 'No winner'}
            </p>
            {reward && (
              <p className="text-sm text-white/50 mt-0.5">
                won {reward.grand_prize_name}
              </p>
            )}

            {(drawing.runner_up_1_winner || drawing.runner_up_2_winner) && (
              <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-1">
                {drawing.runner_up_1_winner && (
                  <p className="text-xs text-white/50">
                    Runner-up: <span className="text-white/70">{drawing.runner_up_1_winner.full_name}</span>
                  </p>
                )}
                {drawing.runner_up_2_winner && (
                  <p className="text-xs text-white/50">
                    Runner-up: <span className="text-white/70">{drawing.runner_up_2_winner.full_name}</span>
                  </p>
                )}
              </div>
            )}

            {isField && entries && (
              <p className="text-xs text-white/30 mt-3">
                You had {entries.totalEntries} of {drawing.total_entries} total entries
              </p>
            )}
          </motion.div>
        )}

        {/* Drawing not yet run message */}
        {!drawing && !rewardLoading && reward && (
          <div className={`${subtleClass} p-3 rounded-xl text-center`}>
            <p className="text-xs text-white/30">
              Drawing at month end — keep claiming daily!
            </p>
          </div>
        )}

        {/* Past Winners */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="text-sm font-semibold text-white mb-3">Past Winners</h3>
          <div className="space-y-2">
            {pastMonths.map(({ year, month }) => (
              <PastWinnerCard
                key={`${year}-${month}`}
                year={year}
                month={month}
                cardClass={cardClass}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

function PastWinnerCard({
  year,
  month,
  cardClass,
}: {
  year: number;
  month: number;
  cardClass: string;
}) {
  const { data: reward } = useMonthlyReward(year, month);
  const { data: drawing } = useMonthlyDrawing(year, month);

  if (!reward && !drawing) {
    return null;
  }

  return (
    <div className={`${cardClass} p-3 flex items-center gap-3`}>
      {reward?.grand_prize_image_url ? (
        <img
          src={reward.grand_prize_image_url}
          alt={reward?.grand_prize_name ?? ''}
          className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-white/[0.03] border border-white/[0.04] flex items-center justify-center shrink-0">
          <Trophy className="w-4 h-4 text-white/10" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/40">
          {MONTHS[month - 1]} {year}
        </p>
        <p className="text-sm text-white font-medium truncate">
          {reward?.grand_prize_name ?? 'Reward'}
        </p>
        {drawing?.grand_prize_winner ? (
          <p className="text-xs text-emerald-400/70 truncate">
            Winner: {drawing.grand_prize_winner.full_name}
          </p>
        ) : (
          <p className="text-xs text-white/30">No drawing</p>
        )}
      </div>
      {drawing && (
        <div className="text-right shrink-0">
          <p className="text-xs text-white/30">
            {drawing.total_participants} entered
          </p>
        </div>
      )}
    </div>
  );
}

export default SafetyRewardsPage;
