/**
 * AdminKpiBand — "At a glance" instrument rail for the admin Command Canopy.
 *
 * Four instrument cells: numbers count up once on mount inside an unfurl
 * cascade (reduced-motion safe). Each cell is a full-size tap target that
 * routes to the relevant admin surface.
 */

import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Users, ClipboardCheck, AlertTriangle, Inbox, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { useMotionConfig, useCountUp } from '../../motion';
import { useAdminOverviewStats } from '../../hooks/queries/useAdminOverviewStats';

interface AdminKpiBandProps {
  /** Pending contact requests — already loaded by the page. */
  pendingRequests: number;
  /** Jump to the Contact Requests section. */
  onShowRequests?: () => void;
}

interface KpiCell {
  key: string;
  label: string;
  display: number;
  loading: boolean;
  icon: LucideIcon;
  to?: string;
  onClick?: () => void;
  /** Cell reads as "attention" when non-zero */
  alert?: boolean;
  /** Short time-window qualifier shown beside the index (e.g. "YTD"). */
  qualifier?: string;
}

const CELL_CLASS =
  'group relative flex min-h-[112px] w-full flex-col justify-between overflow-hidden rounded-leaf-sm border border-bone-50/[0.1] ' +
  'bg-ink-950/60 p-4 text-left transition-[border-color,background-color] duration-500 ease-canopy ' +
  'hover:border-verdant-400/50 hover:bg-ink-900/80 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-verdant-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 active:scale-[0.99]';

function CellInner({ cell, index }: { cell: KpiCell; index: number }) {
  const Icon = cell.icon;
  const hot = cell.alert && cell.display > 0;
  return (
    <>
      <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(244,247,242,0.18),transparent)]" />
      <div className="flex items-start justify-between">
        <span className="type-instrument text-bone-50/35">
          {String(index + 1).padStart(2, '0')}
          {cell.qualifier && <span className="text-bone-50/60"> · {cell.qualifier}</span>}
        </span>
        <span className={`rounded-leaf-xs border p-1.5 ${hot ? 'border-lime-400/40 bg-lime-400/10 text-lime-300' : 'border-verdant-400/25 bg-verdant-500/10 text-verdant-300'}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
      <div className="mt-3">
        {cell.loading ? (
          <div className="h-9 w-14 animate-pulse rounded-md bg-bone-50/10" />
        ) : (
          <p className={`type-display text-[2.25rem] leading-none tabular-nums sm:text-[2.6rem] ${hot ? 'text-lime-300 text-glow' : 'text-bone-50'}`}>
            {cell.display.toLocaleString()}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between">
          <p className="type-instrument truncate whitespace-nowrap text-bone-300 [letter-spacing:0.14em] sm:[letter-spacing:0.22em]">{cell.label}</p>
          <ArrowUpRight
            className="h-3.5 w-3.5 text-bone-50/30 transition-all duration-300 ease-canopy group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-verdant-300"
            aria-hidden
          />
        </div>
      </div>
    </>
  );
}

export default function AdminKpiBand({ pendingRequests, onShowRequests }: AdminKpiBandProps) {
  const { variants } = useMotionConfig();
  const { data: stats, isLoading } = useAdminOverviewStats();

  const usersCount = useCountUp(isLoading ? null : stats?.totalUsers ?? 0, { durationMs: 1400 });
  const capaCount = useCountUp(isLoading ? null : stats?.openCorrectiveActions ?? 0, { durationMs: 1400 });
  const incidentsCount = useCountUp(isLoading ? null : stats?.incidentsYtd ?? 0, { durationMs: 1400 });
  const requestsCount = useCountUp(pendingRequests, { durationMs: 1400 });

  const cells: KpiCell[] = [
    { key: 'users', label: 'Team', display: usersCount, loading: isLoading, icon: Users, to: '/admin/users' },
    { key: 'capa', label: 'Open actions', display: capaCount, loading: isLoading, icon: ClipboardCheck, to: '/admin/safety-compliance', alert: true },
    { key: 'incidents', label: 'Incidents', qualifier: 'YTD', display: incidentsCount, loading: isLoading, icon: AlertTriangle, to: '/admin/safety-compliance' },
    { key: 'requests', label: 'Requests', display: requestsCount, loading: false, icon: Inbox, onClick: onShowRequests, alert: true },
  ];

  return (
    <motion.div
      className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4"
      variants={variants.staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {cells.map((cell, i) => (
        <motion.div key={cell.key} variants={variants.staggerItem}>
          {cell.to ? (
            <Link to={cell.to} className={CELL_CLASS} aria-label={`${cell.label}${cell.qualifier ? ` ${cell.qualifier}` : ''}: ${cell.display}`}>
              <CellInner cell={cell} index={i} />
            </Link>
          ) : (
            <button type="button" onClick={cell.onClick} className={CELL_CLASS} aria-label={`${cell.label}${cell.qualifier ? ` ${cell.qualifier}` : ''}: ${cell.display}`}>
              <CellInner cell={cell} index={i} />
            </button>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
