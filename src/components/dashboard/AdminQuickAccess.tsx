/**
 * AdminQuickAccess — platinum "command bar" of the highest-value admin
 * destinations. Three instrument links on a single slab.
 */

import { Link } from 'react-router-dom';
import { Users, ShieldCheck, Activity, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { glass } from '../../lib/glass';

interface QuickLink {
  to: string;
  label: string;
  desc: string;
  icon: LucideIcon;
}

const LINKS: QuickLink[] = [
  { to: '/admin/users', label: 'Users & Activity', desc: 'Accounts & engagement', icon: Users },
  { to: '/admin/safety-compliance', label: 'Safety & Compliance', desc: 'Analytics & audits', icon: ShieldCheck },
  { to: '/admin/telemetry', label: 'Telemetry', desc: 'Metrics & system health', icon: Activity },
];

export default function AdminQuickAccess() {
  return (
    <nav className={`${glass.commandBarGold} grid grid-cols-1 gap-px overflow-hidden sm:grid-cols-3`} aria-label="Quick access">
      {LINKS.map((link, index) => {
        const Icon = link.icon;
        return (
          <Link
            key={link.to}
            to={link.to}
            className={
              'group relative flex items-center gap-3.5 px-5 py-4 transition-colors duration-500 ease-canopy ' +
              'hover:bg-verdant-500/[0.06] active:scale-[0.99] focus:outline-none ' +
              'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-verdant-400/70 ' +
              (index > 0 ? 'border-t border-bone-50/[0.06] sm:border-l sm:border-t-0' : '')
            }
          >
            <span className="type-instrument w-6 text-bone-50/30">{String(index + 1).padStart(2, '0')}</span>
            <Icon className="h-4 w-4 shrink-0 text-verdant-300" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-bone-50">{link.label}</span>
              <span className="block truncate text-[11px] text-bone-400">{link.desc}</span>
            </span>
            <ArrowUpRight
              className="h-4 w-4 shrink-0 text-bone-50/30 transition-all duration-300 ease-canopy group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-verdant-300"
              aria-hidden
            />
            <span className="pointer-events-none absolute inset-x-5 bottom-0 h-px origin-left scale-x-0 bg-[linear-gradient(90deg,#3DDC84,#B8FF7A)] transition-transform duration-500 ease-canopy group-hover:scale-x-100" />
          </Link>
        );
      })}
    </nav>
  );
}
