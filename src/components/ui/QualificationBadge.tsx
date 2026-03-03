import type { ElectricalQualificationLevel } from '../../types/electricalQualification';
import { QUALIFICATION_LABELS } from '../../types/electricalQualification';

interface QualificationBadgeProps {
  level: ElectricalQualificationLevel;
  className?: string;
}

const BADGE_CLASSES: Record<ElectricalQualificationLevel, string> = {
  unqualified: 'bg-red-900/40 text-red-300 border-red-500/50',
  line_clearance_tree_trimmer: 'bg-amber-900/40 text-amber-300 border-amber-500/50',
  qualified_269: 'bg-emerald-900/40 text-emerald-300 border-emerald-500/50',
};

export function QualificationBadge({ level, className = '' }: QualificationBadgeProps) {
  const label = QUALIFICATION_LABELS[level];
  const colorClass = BADGE_CLASSES[level];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colorClass} ${className}`}
      role="status"
    >
      {label}
    </span>
  );
}
