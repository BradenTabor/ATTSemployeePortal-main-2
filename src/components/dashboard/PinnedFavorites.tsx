/**
 * PinnedFavorites Component
 * 
 * Displays user's pinned/favorited navigation items outside of the
 * collapsible "All Tools" section for quick permanent access.
 * 
 * Features:
 * - Persists pinned items to localStorage
 * - Long-press (mobile) or right-click (desktop) to pin/unpin
 * - Drag to reorder pinned items
 * - Empty state encourages pinning
 * 
 * UX Philosophy:
 * - Personalization increases engagement
 * - Reduce friction for frequently used items
 * - Clear visual feedback for pinned status
 */

import { memo, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pin,
  PinOff,
  Star,
  FileText,
  Megaphone,
  Phone,
  FileSearch,
  Briefcase,
  History,
  UserCircle,
  Wrench,
  HardHat,
  Shield,
  ChevronRight,
  Settings,
  Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getDeviceCapabilities } from '../../lib/mobilePerf';
import { usePinnedFavorites, MAX_PINNED } from '../../hooks/usePinnedFavorites';

// ============================================================================
// THEME CONFIGURATION
// ============================================================================

export type PinnedFavoritesTheme = 'emerald' | 'blue';

interface ThemeConfig {
  // Link card styles
  cardBg: string;
  cardHoverBg: string;
  cardBorder: string;
  cardHoverBorder: string;
  cardShadow: string;
  cardHoverShadow: string;
  cardBoxShadow: string;
  // Icon styles
  iconBg: string;
  iconHoverBg: string;
  iconBorder: string;
  iconHoverBorder: string;
  iconColor: string;
  iconHoverColor: string;
  iconInnerGlow: string;
  // Text styles
  descriptionColor: string;
  chevronColor: string;
  chevronHoverColor: string;
  // Counter badge
  counterBg: string;
  counterBorder: string;
  counterText: string;
  // Suggestion styles
  suggestionBg: string;
  suggestionBorder: string;
  suggestionHoverBg: string;
  suggestionHoverBorder: string;
  suggestionIconBg: string;
  suggestionIconBorder: string;
  suggestionIconHoverBg: string;
  suggestionIconColor: string;
  suggestionPinColor: string;
}

const pinnedThemeConfig: Record<PinnedFavoritesTheme, ThemeConfig> = {
  emerald: {
    cardBg: 'from-[#062a1d]/95 via-[#041e15]/90 to-[#03150f]/95',
    cardHoverBg: 'hover:from-[#073d2a]/95 hover:via-[#052619]/90 hover:to-[#041a12]/95',
    cardBorder: 'border-emerald-500/40',
    cardHoverBorder: 'hover:border-emerald-400/60',
    cardShadow: 'shadow-emerald-900/30',
    cardHoverShadow: 'hover:shadow-emerald-500/20',
    cardBoxShadow: '0 4px 20px -4px rgba(16, 185, 129, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    iconBg: 'from-emerald-500/25 to-emerald-600/15',
    iconHoverBg: 'group-hover:from-emerald-500/35 group-hover:to-emerald-600/25',
    iconBorder: 'border-emerald-400/40',
    iconHoverBorder: 'group-hover:border-emerald-400/60',
    iconColor: 'text-emerald-300',
    iconHoverColor: 'group-hover:text-emerald-200',
    iconInnerGlow: 'to-emerald-400/10',
    descriptionColor: 'text-emerald-300/50',
    chevronColor: 'text-emerald-500/50',
    chevronHoverColor: 'group-hover:text-emerald-400',
    counterBg: 'bg-emerald-500/10',
    counterBorder: 'border-emerald-500/30',
    counterText: 'text-emerald-300',
    suggestionBg: 'from-emerald-900/40 via-emerald-950/30 to-transparent',
    suggestionBorder: 'border-emerald-500/25',
    suggestionHoverBg: 'hover:bg-emerald-500/15',
    suggestionHoverBorder: 'hover:border-emerald-400/50',
    suggestionIconBg: 'bg-emerald-500/15',
    suggestionIconBorder: 'border-emerald-500/30',
    suggestionIconHoverBg: 'group-hover:bg-emerald-500/25',
    suggestionIconColor: 'text-emerald-400',
    suggestionPinColor: 'text-emerald-400',
  },
  blue: {
    cardBg: 'from-[#062a3d]/95 via-[#041e30]/90 to-[#030f1f]/95',
    cardHoverBg: 'hover:from-[#073d52]/95 hover:via-[#052640]/90 hover:to-[#041a2e]/95',
    cardBorder: 'border-blue-500/40',
    cardHoverBorder: 'hover:border-blue-400/60',
    cardShadow: 'shadow-blue-900/30',
    cardHoverShadow: 'hover:shadow-blue-500/20',
    cardBoxShadow: '0 4px 20px -4px rgba(59, 130, 246, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    iconBg: 'from-blue-500/25 to-blue-600/15',
    iconHoverBg: 'group-hover:from-blue-500/35 group-hover:to-blue-600/25',
    iconBorder: 'border-blue-400/40',
    iconHoverBorder: 'group-hover:border-blue-400/60',
    iconColor: 'text-blue-300',
    iconHoverColor: 'group-hover:text-blue-200',
    iconInnerGlow: 'to-blue-400/10',
    descriptionColor: 'text-blue-300/50',
    chevronColor: 'text-blue-500/50',
    chevronHoverColor: 'group-hover:text-blue-400',
    counterBg: 'bg-blue-500/10',
    counterBorder: 'border-blue-500/30',
    counterText: 'text-blue-300',
    suggestionBg: 'from-blue-900/40 via-blue-950/30 to-transparent',
    suggestionBorder: 'border-blue-500/25',
    suggestionHoverBg: 'hover:bg-blue-500/15',
    suggestionHoverBorder: 'hover:border-blue-400/50',
    suggestionIconBg: 'bg-blue-500/15',
    suggestionIconBorder: 'border-blue-500/30',
    suggestionIconHoverBg: 'group-hover:bg-blue-500/25',
    suggestionIconColor: 'text-blue-400',
    suggestionPinColor: 'text-blue-400',
  },
};

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: typeof FileText;
  description?: string;
  roles?: string[];
}

// All available nav items
const allNavItems: NavItem[] = [
  { id: 'jobs', label: 'My Jobs', path: '/assigned-jobs', icon: Briefcase, description: 'View assigned work' },
  { id: 'forms', label: 'Company Forms', path: '/forms', icon: FileText, description: 'Submit required forms' },
  { id: 'history', label: 'Forms History', path: '/forms-history', icon: History, description: 'Past submissions' },
  { id: 'announcements', label: 'Announcements', path: '/announcements', icon: Megaphone, description: 'Company updates' },
  { id: 'resources', label: 'Resources', path: '/resources', icon: FileSearch, description: 'Training materials' },
  { id: 'contact', label: 'Contact', path: '/contact', icon: Phone, description: 'Reach management' },
  { id: 'profile', label: 'My Profile', path: '/profile', icon: UserCircle, description: 'Account settings' },
  { id: 'settings', label: 'Settings', path: '/settings', icon: Settings, description: 'Saved data & preferences' },
  { id: 'mechanic', label: 'Mechanic', path: '/mechanic-dashboard', icon: Wrench, description: 'DVIR queue', roles: ['mechanic', 'admin'] },
  { id: 'foreman', label: 'Foreman', path: '/foreman-dashboard', icon: Users, description: 'Crew management', roles: ['foreman', 'admin'] },
  { id: 'general-foreman', label: 'General Foreman', path: '/general-foreman-dashboard', icon: HardHat, description: 'Crew oversight', roles: ['general_foreman', 'admin'] },
  { id: 'safety-officer', label: 'Safety Officer', path: '/safety-officer-dashboard', icon: Shield, description: 'Safety compliance', roles: ['safety_officer', 'admin'] },
  { id: 'admin', label: 'Admin', path: '/admin', icon: Shield, description: 'System admin', roles: ['admin'] },
];

// ============================================================================
// PINNED ITEM COMPONENT
// ============================================================================

interface PinnedItemProps {
  item: NavItem;
  onUnpin: () => void;
  themeStyles: ThemeConfig;
}

const PinnedItem = memo(function PinnedItem({ item, onUnpin, themeStyles }: PinnedItemProps) {
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const [showUnpin, setShowUnpin] = useState(false);
  const Icon = item.icon;
  
  // Long press detection for mobile
  const [pressTimer, setPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  
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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ 
        layout: { type: 'spring', stiffness: 500, damping: 30 },
        opacity: { duration: 0.15 },
        scale: { duration: 0.15 }
      }}
      className="relative group"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
    >
      <Link
        to={item.path}
        className={`
          flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-3 sm:py-3.5 
          rounded-xl sm:rounded-2xl 
          bg-gradient-to-br ${themeStyles.cardBg}
          border ${themeStyles.cardBorder}
          shadow-lg ${themeStyles.cardShadow}
          ${themeStyles.cardHoverBorder} ${themeStyles.cardHoverShadow}
          ${themeStyles.cardHoverBg}
          transition-all duration-200
          group
        `}
        style={{
          boxShadow: themeStyles.cardBoxShadow,
        }}
      >
        {/* Icon container with glow */}
        <div className={`
          relative w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl 
          bg-gradient-to-br ${themeStyles.iconBg}
          border ${themeStyles.iconBorder}
          flex items-center justify-center 
          ${themeStyles.iconHoverBg}
          ${themeStyles.iconHoverBorder}
          transition-all duration-200 
          flex-shrink-0
          shadow-inner
        `}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${themeStyles.iconColor} ${themeStyles.iconHoverColor} transition-colors`} />
          {/* Inner glow */}
          <div className={`absolute inset-0 rounded-lg sm:rounded-xl bg-gradient-to-t from-transparent via-transparent ${themeStyles.iconInnerGlow} pointer-events-none`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm sm:text-base font-semibold text-white truncate">{item.label}</p>
          {item.description && !caps.isMobile && (
            <p className={`text-[10px] sm:text-xs ${themeStyles.descriptionColor} truncate mt-0.5`}>{item.description}</p>
          )}
        </div>
        
        <ChevronRight className={`w-4 h-4 sm:w-5 sm:h-5 ${themeStyles.chevronColor} ${themeStyles.chevronHoverColor} group-hover:translate-x-0.5 transition-all flex-shrink-0`} />
      </Link>
      
      {/* Pin indicator - premium gold badge */}
      <div className="
        absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 
        w-5 h-5 sm:w-6 sm:h-6 
        rounded-full 
        bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600
        border-2 border-[#041e15] 
        flex items-center justify-center 
        shadow-lg shadow-amber-500/40
      ">
        <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white fill-white drop-shadow-sm" />
      </div>
      
      {/* Unpin overlay */}
      <AnimatePresence>
        {showUnpin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-lg sm:rounded-xl bg-black/80 backdrop-blur-sm flex items-center justify-center z-10"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onUnpin();
                setShowUnpin(false);
              }}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] sm:text-xs font-medium hover:bg-red-500/30 transition-colors min-h-[36px] sm:min-h-[40px]"
            >
              <PinOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              Remove
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowUnpin(false);
              }}
              className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center"
            >
              <span className="sr-only">Cancel</span>
              <span className="text-white/60 text-[10px] sm:text-xs">✕</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

// ============================================================================
// SUGGESTED QUICK PIN ITEM
// ============================================================================

interface SuggestedPinItemProps {
  item: NavItem;
  onPin: () => void;
  themeStyles: ThemeConfig;
}

const SuggestedPinItem = memo(function SuggestedPinItem({ item, onPin, themeStyles }: SuggestedPinItemProps) {
  const Icon = item.icon;
  
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPin();
        if ('vibrate' in navigator) navigator.vibrate(5);
      }}
      className={`
        flex items-center gap-2.5 px-3 py-2.5 
        rounded-xl 
        bg-gradient-to-br ${themeStyles.suggestionBg}
        border ${themeStyles.suggestionBorder}
        ${themeStyles.suggestionHoverBg} ${themeStyles.suggestionHoverBorder}
        transition-all duration-200 
        group
        min-w-[140px]
      `}
    >
      <div className={`w-7 h-7 rounded-lg ${themeStyles.suggestionIconBg} border ${themeStyles.suggestionIconBorder} flex items-center justify-center flex-shrink-0 ${themeStyles.suggestionIconHoverBg} transition-colors`}>
        <Icon className={`w-3.5 h-3.5 ${themeStyles.suggestionIconColor}`} />
      </div>
      <span className="text-xs font-medium text-white/80 group-hover:text-white truncate">{item.label}</span>
      <div className="ml-auto flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
        <Pin className={`w-3 h-3 ${themeStyles.suggestionPinColor}`} />
      </div>
    </motion.button>
  );
});

// ============================================================================
// EMPTY STATE COMPONENT - Enhanced with quick suggestions
// ============================================================================

interface EmptyPinnedStateProps {
  suggestedItems: NavItem[];
  onPinItem: (itemId: string) => void;
  themeStyles: ThemeConfig;
}

const EmptyPinnedState = memo(function EmptyPinnedState({ suggestedItems, onPinItem, themeStyles }: EmptyPinnedStateProps) {
  return (
    <div className="space-y-3">
      {/* Compact hint message */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-br from-amber-900/30 to-amber-950/20 border border-amber-500/25">
        <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center justify-center flex-shrink-0">
          <Pin className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <p className="text-xs text-amber-200/80 leading-relaxed">
          <span className="font-semibold text-amber-300">Add shortcuts:</span> Tap below to pin, or long-press items in All Tools
        </p>
      </div>
      
      {/* Quick pin suggestions - horizontal scroll on mobile */}
      {suggestedItems.length > 0 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
          {suggestedItems.slice(0, 4).map((item) => (
            <SuggestedPinItem
              key={item.id}
              item={item}
              onPin={() => onPinItem(item.id)}
              themeStyles={themeStyles}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface PinnedFavoritesProps {
  /** Whether to show the section title */
  showTitle?: boolean;
  /** Color theme - defaults to emerald */
  theme?: PinnedFavoritesTheme;
}

function PinnedFavoritesComponent({ showTitle = true, theme = 'emerald' }: PinnedFavoritesProps) {
  const { role, isAdmin, hasMechanicAccess } = useAuth();
  const { pinned, togglePin } = usePinnedFavorites();
  
  // Get theme styles
  const themeStyles = pinnedThemeConfig[theme];
  
  // Filter available items by role
  const availableItems = useMemo(() => {
    return allNavItems.filter(item => {
      if (!item.roles) return true;
      if (item.roles.includes('admin') && isAdmin) return true;
      if (item.roles.includes('mechanic') && hasMechanicAccess) return true;
      return item.roles.includes(role || '');
    });
  }, [role, isAdmin, hasMechanicAccess]);
  
  // Get pinned items in order
  const pinnedItems = useMemo(() => {
    return pinned
      .map(id => availableItems.find(item => item.id === id))
      .filter((item): item is NavItem => item !== undefined);
  }, [pinned, availableItems]);

  // Get suggested items (most commonly useful, not already pinned)
  const suggestedItems = useMemo(() => {
    const priorityOrder = ['jobs', 'forms', 'announcements', 'history', 'profile'];
    return availableItems
      .filter(item => !pinned.includes(item.id))
      .sort((a, b) => {
        const aIndex = priorityOrder.indexOf(a.id);
        const bIndex = priorityOrder.indexOf(b.id);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
  }, [availableItems, pinned]);

  // Don't render if no pinned items and hiding title
  if (pinnedItems.length === 0 && !showTitle) {
    return null;
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {showTitle && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-400/30 flex items-center justify-center">
              <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-bold text-white">
                Quick Access
              </span>
              <p className="text-[9px] sm:text-[10px] text-amber-400/50">Your pinned shortcuts</p>
            </div>
          </div>
          {pinnedItems.length > 0 && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${themeStyles.counterBg} border ${themeStyles.counterBorder}`}>
              <span className={`text-[10px] sm:text-xs font-medium ${themeStyles.counterText}`}>{pinnedItems.length}/{MAX_PINNED}</span>
            </div>
          )}
        </div>
      )}
      
      {pinnedItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
          <AnimatePresence mode="sync">
            {pinnedItems.map((item) => (
              <PinnedItem
                key={item.id}
                item={item}
                onUnpin={() => togglePin(item.id)}
                themeStyles={themeStyles}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <EmptyPinnedState 
          suggestedItems={suggestedItems}
          onPinItem={togglePin}
          themeStyles={themeStyles}
        />
      )}
    </div>
  );
}

export const PinnedFavorites = memo(PinnedFavoritesComponent);
export default PinnedFavorites;
