import { memo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface QuickActionLink {
  label: string;
  description?: string;
  path: string;
  icon?: LucideIcon;
  /** Custom gradient for the icon background */
  iconBg?: string;
  /** Custom icon color */
  iconColor?: string;
}

interface CompactQuickActionsProps {
  links: QuickActionLink[];
  className?: string;
}

interface QuickActionTileProps {
  link: QuickActionLink;
  index: number;
}

const QuickActionTile = memo(function QuickActionTile({ 
  link, 
  index 
}: QuickActionTileProps) {
  const Icon = link.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
    >
      <Link
        to={link.path}
        className={cn(
          // Base styles
          'group flex items-center gap-3 p-3 md:p-4 rounded-2xl',
          'bg-gradient-to-br from-[#0a1f17]/80 to-[#041510]/90',
          'border border-emerald-500/20 hover:border-emerald-400/40',
          'transition-all duration-200',
          'hover:bg-[#0a2418]/90 hover:shadow-lg hover:shadow-emerald-900/20',
          // Focus styles for accessibility
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04150f]',
          // Touch target - min 44px height
          'min-h-[44px]'
        )}
      >
        {/* Icon */}
        {Icon && (
          <div
            className={cn(
              'flex-shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center',
              link.iconBg || 'bg-emerald-500/15 border border-emerald-500/30'
            )}
          >
            <Icon 
              className={cn(
                'w-4 h-4 md:w-5 md:h-5',
                link.iconColor || 'text-emerald-300'
              )} 
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm md:text-base font-semibold text-white truncate group-hover:text-emerald-100 transition-colors">
            {link.label}
          </p>
          {link.description && (
            <p className="text-xs text-white/50 truncate mt-0.5 hidden md:block">
              {link.description}
            </p>
          )}
        </div>

        {/* Arrow indicator */}
        <ChevronRight 
          className="w-4 h-4 text-white/30 group-hover:text-emerald-300 group-hover:translate-x-0.5 transition-all flex-shrink-0" 
          aria-hidden="true"
        />
      </Link>
    </motion.div>
  );
});

function CompactQuickActionsComponent({ 
  links, 
  className 
}: CompactQuickActionsProps) {
  if (links.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        // Mobile: single column
        'grid grid-cols-1 gap-2',
        // Desktop: 2 columns
        'md:grid-cols-2 md:gap-3',
        className
      )}
    >
      {links.map((link, index) => (
        <QuickActionTile 
          key={link.path} 
          link={link} 
          index={index} 
        />
      ))}
    </div>
  );
}

export const CompactQuickActions = memo(CompactQuickActionsComponent);
export default CompactQuickActions;

