import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Trophy } from 'lucide-react';

export interface MonthlyCalendarGridProps {
  year: number;
  /** 1-indexed month (1 = January) */
  month: number;
  /** Day-of-month numbers the user claimed */
  claimedDays: Set<number>;
  /** Day-of-month numbers that had announcements */
  announcementDays: Set<number>;
  /** Day-of-month if viewing the current month, null otherwise */
  today: number | null;
}

type DayState = 'claimed' | 'missed' | 'no-announcement' | 'today' | 'future' | 'empty';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MonthlyCalendarGrid({
  year,
  month,
  claimedDays,
  announcementDays,
  today,
}: MonthlyCalendarGridProps) {
  const { leadingBlanks, totalDays } = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const total = new Date(year, month, 0).getDate();
    return { leadingBlanks: firstDay, totalDays: total };
  }, [year, month]);

  const cells = useMemo(() => {
    const result: { day: number; state: DayState }[] = [];

    for (let i = 0; i < leadingBlanks; i++) {
      result.push({ day: 0, state: 'empty' });
    }

    for (let d = 1; d <= totalDays; d++) {
      if (today !== null && d === today) {
        result.push({ day: d, state: 'today' });
      } else if (today !== null && d > today) {
        result.push({ day: d, state: 'future' });
      } else if (today === null) {
        // Viewing a past month entirely, or future month
        const now = new Date();
        if (now < new Date(year, month - 1, d + 1)) {
          result.push({ day: d, state: 'future' });
        } else if (claimedDays.has(d)) {
          result.push({ day: d, state: 'claimed' });
        } else if (announcementDays.has(d)) {
          result.push({ day: d, state: 'missed' });
        } else {
          result.push({ day: d, state: 'no-announcement' });
        }
      } else if (claimedDays.has(d)) {
        result.push({ day: d, state: 'claimed' });
      } else if (announcementDays.has(d)) {
        result.push({ day: d, state: 'missed' });
      } else {
        result.push({ day: d, state: 'no-announcement' });
      }
    }

    return result;
  }, [leadingBlanks, totalDays, today, claimedDays, announcementDays, year, month]);

  // Compute streak segments for visual highlighting
  const streakRanges = useMemo(() => {
    const ranges: { start: number; end: number }[] = [];
    let streakStart: number | null = null;

    for (let d = 1; d <= totalDays; d++) {
      if (claimedDays.has(d)) {
        if (streakStart === null) streakStart = d;
      } else {
        if (streakStart !== null && d - streakStart >= 2) {
          ranges.push({ start: streakStart, end: d - 1 });
        }
        streakStart = null;
      }
    }
    if (streakStart !== null && totalDays - streakStart + 1 >= 2) {
      ranges.push({ start: streakStart, end: totalDays });
    }
    return ranges;
  }, [claimedDays, totalDays]);

  const isInStreak = useMemo(() => {
    const set = new Set<number>();
    for (const range of streakRanges) {
      for (let d = range.start; d <= range.end; d++) {
        set.add(d);
      }
    }
    return set;
  }, [streakRanges]);

  return (
    <div className="w-full">
      {/* Day name headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="text-center text-[10px] sm:text-xs font-medium text-white/30 py-1"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (cell.state === 'empty') {
            return <div key={`blank-${i}`} />;
          }

          const inStreak = isInStreak.has(cell.day);

          return (
            <div
              key={cell.day}
              className="flex flex-col items-center justify-center"
            >
              <DayCell
                day={cell.day}
                state={cell.state}
                inStreak={inStreak}
              />
            </div>
          );
        })}

        {/* Trophy cell after last day */}
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#f6dcb2]/10 border border-[#f6dcb2]/20 flex items-center justify-center">
            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#f6dcb2]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function DayCell({
  day,
  state,
  inStreak,
}: {
  day: number;
  state: DayState;
  inStreak: boolean;
}) {
  const base = 'w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm relative';

  switch (state) {
    case 'claimed':
      return (
        <div
          className={`${base} ${
            inStreak
              ? 'bg-emerald-500/25 border-2 border-emerald-400/50 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
              : 'bg-emerald-500/20 border border-emerald-500/40'
          } text-emerald-300`}
        >
          <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="absolute -bottom-3.5 text-[9px] text-white/30">
            {day}
          </span>
        </div>
      );

    case 'missed':
      return (
        <div
          className={`${base} border border-red-500/30 text-red-400/60`}
        >
          <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="absolute -bottom-3.5 text-[9px] text-white/30">
            {day}
          </span>
        </div>
      );

    case 'no-announcement':
      return (
        <div className={`${base}`}>
          <div className="w-2 h-2 rounded-full bg-white/10" />
          <span className="absolute -bottom-3.5 text-[9px] text-white/20">
            {day}
          </span>
        </div>
      );

    case 'today':
      return (
        <motion.div
          animate={{ boxShadow: ['0 0 0 0 rgba(16,185,129,0.3)', '0 0 0 6px rgba(16,185,129,0)', '0 0 0 0 rgba(16,185,129,0.3)'] }}
          transition={{ duration: 2, repeat: Infinity }}
          className={`${base} border-2 border-emerald-400 text-white font-bold`}
        >
          {day}
        </motion.div>
      );

    case 'future':
      return (
        <div className={`${base} text-white/20`}>
          <div className="w-2 h-2 rounded-full bg-white/5" />
          <span className="absolute -bottom-3.5 text-[9px] text-white/10">
            {day}
          </span>
        </div>
      );

    default:
      return null;
  }
}
