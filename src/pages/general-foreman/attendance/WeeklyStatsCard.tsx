import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { CheckCircle, XCircle, AlertTriangle, Calendar, Minus } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { getWeekdayDates } from '../../../lib/dateUtils';
import AttendanceProgressBar from './AttendanceProgressBar';
import type { AttendanceRecord, AttendanceStatus, WeeklyStats } from './types';
import { STATUS_CONFIG } from './types';

const STATUS_ICON_MAP: Record<AttendanceStatus, typeof CheckCircle> = {
  present: CheckCircle,
  absent: XCircle,
  ncns: AlertTriangle,
  rto: Calendar,
};

interface WeeklyStatsCardProps {
  isOpen: boolean;
  userId: string;
  weekRecords: AttendanceRecord[];
  dateForWeek: string;
}

export default function WeeklyStatsCard({
  isOpen,
  userId,
  weekRecords,
  dateForWeek,
}: WeeklyStatsCardProps) {
  const weekdays = useMemo(() => getWeekdayDates(dateForWeek), [dateForWeek]);

  const recordsByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of weekRecords) {
      if (r.user_id === userId) {
        map.set(r.date, r);
      }
    }
    return map;
  }, [weekRecords, userId]);

  const stats: WeeklyStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let ncns = 0;
    let rto = 0;
    let total = 0;

    const today = new Date();
    for (const day of weekdays) {
      if (day > today) continue;
      total++;
      const key = format(day, 'yyyy-MM-dd');
      const record = recordsByDate.get(key);
      if (record) {
        switch (record.status) {
          case 'present': present++; break;
          case 'absent': absent++; break;
          case 'ncns': ncns++; break;
          case 'rto': rto++; break;
        }
      }
    }

    return {
      present,
      absent,
      ncns,
      rto,
      total,
      percentage: total > 0 ? (present / total) * 100 : 0,
    };
  }, [weekdays, recordsByDate]);

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          key={`weekly-${userId}`}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          className="overflow-hidden"
        >
          <div className="px-4 pb-4 pt-2 space-y-4">
            {/* Day-by-day grid */}
            <div className="grid grid-cols-5 gap-2">
              {weekdays.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const record = recordsByDate.get(key);
                const isFuture = day > new Date();
                const StatusIcon = record
                  ? STATUS_ICON_MAP[record.status as AttendanceStatus]
                  : Minus;
                const statusCfg = record
                  ? STATUS_CONFIG[record.status as AttendanceStatus]
                  : null;

                return (
                  <div
                    key={key}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl p-2.5 border transition-colors',
                      isFuture
                        ? 'border-dashed border-white/[0.06] bg-transparent opacity-40'
                        : record
                          ? cn('border-transparent', statusCfg!.bgClass)
                          : 'border-dashed border-white/10 bg-white/[0.02]'
                    )}
                  >
                    <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                      {format(day, 'EEE')}
                    </span>
                    <StatusIcon
                      className={cn(
                        'w-5 h-5',
                        record ? '' : 'text-gray-600'
                      )}
                    />
                    <span className="text-[10px] text-gray-500">
                      {format(day, 'M/d')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                Weekly Attendance
              </p>
              {stats.total > 0 ? (
                <AttendanceProgressBar percentage={stats.percentage} />
              ) : (
                <div className="h-3 rounded-full border border-dashed border-white/10 flex items-center justify-center">
                  <span className="text-[9px] text-gray-600">No records this week</span>
                </div>
              )}
            </div>

            {/* Stat counters */}
            <div className="grid grid-cols-4 gap-2">
              {([
                { key: 'present' as const, label: 'Present', value: stats.present },
                { key: 'absent' as const, label: 'Absent', value: stats.absent },
                { key: 'ncns' as const, label: 'NCNS', value: stats.ncns },
                { key: 'rto' as const, label: 'RTO', value: stats.rto },
              ]).map((stat) => (
                <div
                  key={stat.key}
                  className="flex flex-col items-center gap-0.5 rounded-lg bg-white/[0.03] border border-white/[0.06] p-2"
                >
                  <div className={cn('w-2 h-2 rounded-full', STATUS_CONFIG[stat.key].dotClass)} />
                  <span className="text-base font-bold text-white tabular-nums">
                    {stat.value}
                  </span>
                  <span className="text-[9px] text-gray-500 uppercase tracking-wider">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
