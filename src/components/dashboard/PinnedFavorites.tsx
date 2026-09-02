/**
 * PinnedFavorites — "Quick access" shelf of the user's pinned destinations.
 *
 * Canopy edition: every destination renders as a LeafGlyph tile (Lucide icon
 * in a leaf slab) instead of raster art, so the shelf shares one silhouette
 * with NavCards and the admin tiles.
 *
 * Behaviour retained:
 * - Pins persist via usePinnedFavorites (localStorage)
 * - Long-press (mobile) / right-click (desktop) reveals the unpin overlay
 * - Empty state suggests the highest-value shortcuts
 */

import { memo, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pin,
  PinOff,
  ArrowUpRight,
  Briefcase,
  FileText,
  History,
  Megaphone,
  BookOpen,
  Siren,
  Mail,
  UserRound,
  Settings,
  Wrench,
  HardHat,
  Users,
  ShieldCheck,
  Crown,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getDeviceCapabilities } from '../../lib/mobilePerf';
import { usePinnedFavorites, MAX_PINNED } from '../../hooks/usePinnedFavorites';
import { LeafGlyph, type LeafTone } from '../canopy/LeafGlyph';
import { Eyebrow } from '../canopy/Eyebrow';
import { springSnappy } from '../../motion/presets';

// ============================================================================
// THEME (kept for API compatibility — both render in Canopy tones)
// ============================================================================

export type PinnedFavoritesTheme = 'emerald' | 'blue';

// ============================================================================
// NAV ITEMS
// ============================================================================

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  tone: LeafTone;
  description?: string;
  roles?: string[];
}

const allNavItems: NavItem[] = [
  { id: 'jobs', label: 'My Jobs', path: '/assigned-jobs', icon: Briefcase, tone: 'verdant', description: 'View assigned work' },
  { id: 'forms', label: 'Company Forms', path: '/forms', icon: FileText, tone: 'verdant', description: 'Submit required forms' },
  { id: 'history', label: 'Forms History', path: '/forms-history', icon: History, tone: 'glacier', description: 'Past submissions' },
  { id: 'announcements', label: 'Announcements', path: '/announcements', icon: Megaphone, tone: 'lime', description: 'Company updates' },
  { id: 'resources', label: 'Resources', path: '/resources', icon: BookOpen, tone: 'glacier', description: 'Training materials' },
  { id: 'emergency', label: 'Emergency Action Plan', path: '/emergency-action-plan', icon: Siren, tone: 'safety', description: '911, contacts, evacuation, OSHA' },
  { id: 'contact', label: 'Contact', path: '/contact', icon: Mail, tone: 'platinum', description: 'Reach management' },
  { id: 'profile', label: 'My Profile', path: '/profile', icon: UserRound, tone: 'platinum', description: 'Account settings' },
  { id: 'settings', label: 'Settings', path: '/settings', icon: Settings, tone: 'platinum', description: 'Saved data & preferences' },
  { id: 'mechanic', label: 'Mechanic', path: '/mechanic-dashboard', icon: Wrench, tone: 'sap', description: 'DVIR queue', roles: ['mechanic', 'admin'] },
  { id: 'foreman', label: 'Foreman', path: '/foreman-dashboard', icon: HardHat, tone: 'glacier', description: 'Crew management', roles: ['foreman', 'admin'] },
  { id: 'general-foreman', label: 'General Foreman', path: '/general-foreman-dashboard', icon: Users, tone: 'moss', description: 'Crew oversight', roles: ['general_foreman', 'admin'] },
  { id: 'safety-officer', label: 'Safety Officer', path: '/safety-officer-dashboard', icon: ShieldCheck, tone: 'safety', description: 'Safety compliance', roles: ['safety_officer', 'admin'] },
  { id: 'admin', label: 'Admin', path: '/admin', icon: Crown, tone: 'platinum', description: 'System admin', roles: ['admin'] },
];

// ============================================================================
// PINNED ITEM
// ============================================================================

interface PinnedItemProps {
  item: NavItem;
  onUnpin: () => void;
}

const PinnedItem = memo(function PinnedItem({ item, onUnpin }: PinnedItemProps) {
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const [showUnpin, setShowUnpin] = useState(false);
  const [pressTimer, setPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const Icon = item.icon;

  const handleTouchStart = useCallback(() => {
    const timer = setTimeout(() => {
      setShowUnpin(true);
      if ('vibrate' in navigator) navigator.vibrate(10);
    }, 500);
    setPressTimer(timer);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  }, [pressTimer]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowUnpin(true);
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ layout: springSnappy, opacity: { duration: 0.2 }, scale: { duration: 0.2 } }}
      className="group relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
    >
      <Link
        to={item.path}
        className="relative flex items-center gap-3 overflow-hidden rounded-leaf-sm border border-bone-50/[0.1] bg-ink-950/60 px-3 py-2.5 transition-[border-color,background-color] duration-500 ease-canopy hover:border-verdant-400/50 hover:bg-ink-900/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-verdant-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 sm:px-3.5 sm:py-3"
      >
        <LeafGlyph tone={item.tone} size={40} className="transition-transform duration-500 ease-canopy group-hover:-rotate-3">
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </LeafGlyph>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-bone-50">{item.label}</span>
          {item.description && !caps.isMobile && (
            <span className="mt-0.5 block truncate text-[11px] text-bone-400">{item.description}</span>
          )}
        </span>

        <ArrowUpRight
          className="h-4 w-4 shrink-0 text-bone-50/30 transition-all duration-300 ease-canopy group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-verdant-300"
          aria-hidden
        />

        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-3 bottom-0 h-px origin-left scale-x-0 bg-[linear-gradient(90deg,#3DDC84,#B8FF7A)] transition-transform duration-500 ease-canopy group-hover:scale-x-100"
        />
      </Link>

      {/* Pin badge */}
      <span
        aria-hidden
        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-ink-950 bg-[linear-gradient(135deg,#B8FF7A,#3DDC84)] shadow-[0_4px_10px_-2px_rgba(61,220,132,0.6)]"
      >
        <Pin className="h-2.5 w-2.5 text-ink-950" strokeWidth={2.6} />
      </span>

      {/* Unpin overlay */}
      <AnimatePresence>
        {showUnpin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex items-center justify-center rounded-leaf-sm bg-ink-950/90 backdrop-blur-sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onUnpin();
                setShowUnpin(false);
              }}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-red-400/40 bg-red-500/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-red-200 transition-colors hover:bg-red-500/25"
            >
              <PinOff className="h-3 w-3" aria-hidden />
              Unpin
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowUnpin(false);
              }}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-bone-50/10 text-bone-300 transition-colors hover:bg-bone-50/20"
            >
              <span className="sr-only">Cancel</span>
              <X className="h-3 w-3" aria-hidden />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

// ============================================================================
// SUGGESTED PIN
// ============================================================================

interface SuggestedPinItemProps {
  item: NavItem;
  onPin: () => void;
}

const SuggestedPinItem = memo(function SuggestedPinItem({ item, onPin }: SuggestedPinItemProps) {
  const Icon = item.icon;
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={{ scale: 0.97 }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPin();
        if ('vibrate' in navigator) navigator.vibrate(5);
      }}
      className="group flex min-w-[148px] items-center gap-2.5 rounded-leaf-xs border border-bone-50/[0.1] bg-ink-950/60 px-3 py-2.5 text-left transition-[border-color,background-color] duration-500 ease-canopy hover:border-lime-400/50 hover:bg-ink-900/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-verdant-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950"
      aria-label={`Pin ${item.label} to quick access`}
    >
      <LeafGlyph tone={item.tone} size={30}>
        <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
      </LeafGlyph>
      <span className="truncate text-xs font-medium text-bone-100">{item.label}</span>
      <Pin className="ml-auto h-3 w-3 shrink-0 text-bone-50/30 transition-colors group-hover:text-lime-300" aria-hidden />
    </motion.button>
  );
});

// ============================================================================
// EMPTY STATE
// ============================================================================

interface EmptyPinnedStateProps {
  suggestedItems: NavItem[];
  onPinItem: (itemId: string) => void;
}

const EmptyPinnedState = memo(function EmptyPinnedState({ suggestedItems, onPinItem }: EmptyPinnedStateProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-leaf-xs border border-lime-400/25 bg-lime-500/[0.06] px-3.5 py-2.5">
        <Pin className="h-3.5 w-3.5 shrink-0 text-lime-300" aria-hidden />
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] leading-relaxed text-lime-200/80">
          <span className="text-lime-100">Add shortcuts</span> · tap below to pin, or long-press in All Tools
        </p>
      </div>

      {suggestedItems.length > 0 && (
        <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {suggestedItems.slice(0, 4).map((item) => (
            <SuggestedPinItem key={item.id} item={item} onPin={() => onPinItem(item.id)} />
          ))}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// MAIN
// ============================================================================

interface PinnedFavoritesProps {
  /** Whether to show the section title */
  showTitle?: boolean;
  /** Color theme — retained for API compatibility */
  theme?: PinnedFavoritesTheme;
}

function PinnedFavoritesComponent({ showTitle = true }: PinnedFavoritesProps) {
  const { role, isAdmin, hasMechanicAccess } = useAuth();
  const { pinned, togglePin } = usePinnedFavorites();

  const availableItems = useMemo(() => {
    return allNavItems.filter((item) => {
      if (!item.roles) return true;
      if (item.roles.includes('admin') && isAdmin) return true;
      if (item.roles.includes('mechanic') && hasMechanicAccess) return true;
      return item.roles.includes(role || '');
    });
  }, [role, isAdmin, hasMechanicAccess]);

  const pinnedItems = useMemo(() => {
    return pinned
      .map((id) => availableItems.find((item) => item.id === id))
      .filter((item): item is NavItem => item !== undefined);
  }, [pinned, availableItems]);

  const suggestedItems = useMemo(() => {
    const priorityOrder = ['jobs', 'forms', 'announcements', 'history', 'profile'];
    return availableItems
      .filter((item) => !pinned.includes(item.id))
      .sort((a, b) => {
        const aIndex = priorityOrder.indexOf(a.id);
        const bIndex = priorityOrder.indexOf(b.id);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
  }, [availableItems, pinned]);

  if (pinnedItems.length === 0 && !showTitle) return null;

  return (
    <div className="space-y-3 sm:space-y-4">
      {showTitle && (
        <div className="flex items-center justify-between gap-3 px-1">
          <Eyebrow tone="lime" rule={false}>
            <span className="inline-flex items-center gap-2">
              <Pin className="h-3 w-3" aria-hidden />
              Quick access
            </span>
          </Eyebrow>
          {pinnedItems.length > 0 && (
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-bone-400">
              {pinnedItems.length}/{MAX_PINNED}
            </span>
          )}
        </div>
      )}

      {pinnedItems.length > 0 ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
          <AnimatePresence mode="sync">
            {pinnedItems.map((item) => (
              <PinnedItem key={item.id} item={item} onUnpin={() => togglePin(item.id)} />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <EmptyPinnedState suggestedItems={suggestedItems} onPinItem={togglePin} />
      )}
    </div>
  );
}

export const PinnedFavorites = memo(PinnedFavoritesComponent);
export default PinnedFavorites;
