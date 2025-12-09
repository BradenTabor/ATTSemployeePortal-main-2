import { memo } from 'react';
import { motion } from 'framer-motion';
import { MapPin, AlertTriangle, Briefcase } from 'lucide-react';
import { cn } from '../../lib/utils';
import { calculateJobProgress } from '../../lib/jobProgressUtils';
import { JobProgressBar } from './JobProgressBar';
import type { JobProgressTracker } from '../../types/jobs';

interface CompactJobCardProps {
  job: JobProgressTracker;
  className?: string;
}

function CompactJobCardComponent({ 
  job, 
  className 
}: CompactJobCardProps) {
  const progress = calculateJobProgress(job.start_date, job.end_date);
  const isExceeded = progress.status === 'exceeded';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      aria-label={`${job.job_name}, ${progress.percentage}% complete${isExceeded ? ', timeline exceeded' : ''}`}
      className={cn(
        // Base card styles
        'rounded-2xl border overflow-hidden transition-all cursor-pointer',
        'bg-gradient-to-br',
        // Conditional styling based on exceeded status
        isExceeded
          ? 'border-red-500/30 from-[#1a0808]/80 via-[#0d0505]/90 to-[#050302] hover:border-red-500/50'
          : 'border-emerald-500/20 from-[#041510]/80 via-[#020d09]/90 to-[#010604] hover:border-emerald-400/40',
        // Hover styles
        'hover:shadow-lg',
        isExceeded ? 'hover:shadow-red-900/20' : 'hover:shadow-emerald-900/20',
        className
      )}
    >
      <div className="w-full p-3 md:p-4 text-left min-h-[44px]">
        {/* Top row: Job info and progress percentage */}
        <div className="flex items-start justify-between gap-3 mb-2">
          {/* Left: Job name and location */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Briefcase 
                className={cn(
                  'w-3.5 h-3.5 flex-shrink-0',
                  isExceeded ? 'text-red-400' : 'text-emerald-400'
                )} 
              />
              <h4 className="font-semibold text-sm md:text-base text-white truncate">
                {job.job_name}
              </h4>
            </div>
            
            {job.job_location && (
              <p className="flex items-center gap-1.5 text-xs text-white/50 mt-1 ml-5">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{job.job_location}</span>
              </p>
            )}
          </div>

          {/* Right: Progress percentage */}
          <div 
            className={cn(
              'flex-shrink-0 text-right',
              'px-2 py-1 rounded-lg',
              isExceeded
                ? 'bg-red-500/15 border border-red-500/30'
                : 'bg-emerald-500/15 border border-emerald-500/30'
            )}
          >
            <span 
              className={cn(
                'text-sm md:text-base font-bold tabular-nums',
                isExceeded ? 'text-red-400' : 'text-emerald-400'
              )}
            >
              {progress.percentage}%
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="ml-5">
          <JobProgressBar
            startDate={job.start_date}
            endDate={job.end_date}
            size="sm"
            showLabel={false}
            showExceededBadge={false}
          />
        </div>

        {/* Timeline exceeded badge */}
        {isExceeded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-2 ml-5"
          >
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] md:text-xs font-semibold">
              <AlertTriangle className="w-3 h-3" />
              Timeline Exceeded
            </span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export const CompactJobCard = memo(CompactJobCardComponent);
export default CompactJobCard;
