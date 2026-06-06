import { useMemo, useState } from 'react';
import { Calendar, CheckCircle, XCircle, AlertTriangle, CalendarOff } from 'lucide-react';
import { getTodayDateString } from '../../../lib/complianceHelpers';
import { startOfMonth, endOfMonth } from 'date-fns';
import {
  getWeekStartString,
  addDays,
  subDays,
  parseISO,
  format,
} from '../../../lib/dateUtils';
import { useAttendanceSummary } from '../../../hooks/queries/useAttendanceSummaryQuery';
import { ScrollReveal } from '../../../motion';
import AttendanceSummaryTable from './AttendanceSummaryTable';
import AiAttendanceSummary from './AiAttendanceSummary';

const PRESETS = [
  { id: 'this_week', label: 'This Week' },
  { id: 'last_week', label: 'Last Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_30', label: 'Last 30 Days' },
] as const;

function getPresetRange(
  preset: (typeof PRESETS)[number]['id'],
  today: string
): { start: string; end: string } {
  const t = parseISO(today);
  switch (preset) {
    case 'this_week': {
      const mon = getWeekStartString(today);
      const fri = format(addDays(parseISO(mon), 4), 'yyyy-MM-dd');
      return { start: mon, end: fri };
    }
    case 'last_week': {
      const lastMon = format(subDays(parseISO(getWeekStartString(today)), 7), 'yyyy-MM-dd');
      const lastFri = format(addDays(parseISO(lastMon), 4), 'yyyy-MM-dd');
      return { start: lastMon, end: lastFri };
    }
    case 'this_month': {
      const start = format(startOfMonth(t), 'yyyy-MM-dd');
      const end = format(endOfMonth(t), 'yyyy-MM-dd');
      return { start, end };
    }
    case 'last_30': {
      const end = today;
      const start = format(subDays(t, 29), 'yyyy-MM-dd');
      return { start, end };
    }
    default:
      return { start: today, end: today };
  }
}

export default function AttendanceSummaryView() {
  const today = useMemo(() => getTodayDateString(), []);
  const defaultRange = useMemo(() => getPresetRange('this_week', today), [today]);

  const [preset, setPreset] = useState<(typeof PRESETS)[number]['id']>('this_week');
  const [customStart, setCustomStart] = useState(defaultRange.start);
  const [customEnd, setCustomEnd] = useState(defaultRange.end);
  const [useCustom, setUseCustom] = useState(false);

  const { start, end } = useMemo(() => {
    if (useCustom) return { start: customStart, end: customEnd };
    return getPresetRange(preset, today);
  }, [useCustom, preset, customStart, customEnd, today]);

  const { data, isLoading } = useAttendanceSummary(start, end);
  const rows = data?.rows ?? [];
  const aggregates = data?.aggregates;

  return (
    <div className="space-y-5">
      <ScrollReveal variant="fadeUp" delay={0}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setUseCustom(false);
                  setPreset(p.id);
                }}
                className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  !useCustom && preset === p.id
                    ? 'bg-[#c084fc]/20 border-[#c084fc]/40 text-[#e9d5ff]'
                    : 'bg-white/[0.03] border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setUseCustom(true)}
              className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors flex items-center gap-1.5 ${
                useCustom
                  ? 'bg-[#c084fc]/20 border-[#c084fc]/40 text-[#e9d5ff]'
                  : 'bg-white/[0.03] border-white/10 text-gray-400 hover:text-white hover:border-white/20'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Custom
            </button>
          </div>
          {useCustom && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                max={customEnd}
                className="px-3 py-2 rounded-xl text-sm bg-white/[0.03] border border-white/10 text-white focus:outline-none focus-visible:border-[#c084fc]/40"
              />
              <span className="text-gray-500">–</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                min={customStart}
                max={today}
                className="px-3 py-2 rounded-xl text-sm bg-white/[0.03] border border-white/10 text-white focus:outline-none focus-visible:border-[#c084fc]/40"
              />
            </div>
          )}
          <p className="text-xs text-gray-500">
            {start} – {end}
          </p>
        </div>
      </ScrollReveal>

      {aggregates && (
        <ScrollReveal variant="fadeUp" delay={0.05}>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2">
              <div className="w-2 h-2 rounded-full bg-[#c084fc]" />
              <span className="text-xs text-gray-400">Overall</span>
              <span className="text-sm font-bold text-white tabular-nums">{aggregates.overallRate}%</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-gray-400">Present</span>
              <span className="text-sm font-bold text-white tabular-nums">{aggregates.totalPresent}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2">
              <XCircle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs text-gray-400">Absent</span>
              <span className="text-sm font-bold text-white tabular-nums">{aggregates.totalAbsent}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-gray-400">NCNS</span>
              <span className="text-sm font-bold text-white tabular-nums">{aggregates.totalNcns}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2">
              <CalendarOff className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs text-gray-400">RTO</span>
              <span className="text-sm font-bold text-white tabular-nums">{aggregates.totalRto}</span>
            </div>
          </div>
        </ScrollReveal>
      )}

      <ScrollReveal variant="fadeUp" delay={0.08}>
        <div className="bg-gray-900 border border-white/[0.06] rounded-2xl p-4 overflow-hidden">
          <h3 className="text-sm font-semibold text-white mb-3">Attendance by employee</h3>
          <AttendanceSummaryTable rows={rows} isLoading={isLoading} />
        </div>
      </ScrollReveal>

      <ScrollReveal variant="fadeUp" delay={0.1}>
        <AiAttendanceSummary startDate={start} endDate={end} />
      </ScrollReveal>
    </div>
  );
}
