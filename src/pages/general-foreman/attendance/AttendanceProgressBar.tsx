import { motion } from 'framer-motion';

interface AttendanceProgressBarProps {
  percentage: number;
  label?: string;
}

export default function AttendanceProgressBar({
  percentage,
  label,
}: AttendanceProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percentage));

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      </div>
      <span className="text-sm font-medium text-[#e9d5ff] tabular-nums min-w-[3ch] text-right">
        {label ?? `${Math.round(clamped)}%`}
      </span>
    </div>
  );
}
