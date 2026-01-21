/**
 * AvatarDropdownPortal Component
 * 
 * A themed, portal-based avatar dropdown that escapes all parent overflow constraints.
 * Supports multiple theme variants for different dashboard contexts.
 * 
 * UX Philosophy:
 * - Profile access should be instantly available
 * - Dropdown should never be clipped by parent containers
 * - Theme-consistent with the current dashboard
 */

import { memo, useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  Trophy,
} from 'lucide-react';
import { getDeviceCapabilities } from '../../lib/mobilePerf';

// ============================================================================
// TYPES
// ============================================================================

export type AvatarTheme = 'emerald' | 'gold' | 'ember' | 'purple' | 'blue' | 'redwhite';

interface AvatarDropdownPortalProps {
  email?: string;
  role: string | null;
  fullName: string;
  avatarUrl?: string | null;
  rewardPoints?: number;
  theme?: AvatarTheme;
  onSignOut: () => void;
}

// ============================================================================
// THEME CONFIG
// ============================================================================

const themeConfig: Record<AvatarTheme, {
  gradient: string;
  ring: string;
  online: string;
  menuBg: string;
  menuBorder: string;
  shine: string;
  accent: string;
  accentBg: string;
  accentBorder: string;
}> = {
  emerald: {
    gradient: 'from-emerald-400 via-emerald-500 to-emerald-700',
    ring: 'ring-emerald-400/30',
    online: 'bg-emerald-400',
    menuBg: 'linear-gradient(145deg, rgba(4, 30, 21, 0.98) 0%, rgba(2, 15, 10, 0.99) 100%)',
    menuBorder: 'border-emerald-500/30',
    shine: 'via-emerald-400/50',
    accent: 'text-emerald-400',
    accentBg: 'bg-emerald-500/10',
    accentBorder: 'border-emerald-500/20',
  },
  gold: {
    gradient: 'from-amber-300 via-yellow-400 to-amber-600',
    ring: 'ring-amber-400/30',
    online: 'bg-amber-400',
    menuBg: 'linear-gradient(145deg, rgba(20, 17, 13, 0.98) 0%, rgba(10, 8, 6, 0.99) 100%)',
    menuBorder: 'border-amber-500/30',
    shine: 'via-amber-400/50',
    accent: 'text-amber-400',
    accentBg: 'bg-amber-500/10',
    accentBorder: 'border-amber-500/20',
  },
  ember: {
    gradient: 'from-orange-400 via-orange-500 to-orange-700',
    ring: 'ring-orange-400/30',
    online: 'bg-orange-400',
    menuBg: 'linear-gradient(145deg, rgba(20, 8, 4, 0.98) 0%, rgba(10, 4, 2, 0.99) 100%)',
    menuBorder: 'border-orange-500/30',
    shine: 'via-orange-400/50',
    accent: 'text-orange-400',
    accentBg: 'bg-orange-500/10',
    accentBorder: 'border-orange-500/20',
  },
  purple: {
    gradient: 'from-purple-400 via-purple-500 to-purple-700',
    ring: 'ring-purple-400/30',
    online: 'bg-purple-400',
    menuBg: 'linear-gradient(145deg, rgba(45, 27, 78, 0.98) 0%, rgba(20, 12, 35, 0.99) 100%)',
    menuBorder: 'border-purple-500/30',
    shine: 'via-purple-400/50',
    accent: 'text-purple-400',
    accentBg: 'bg-purple-500/10',
    accentBorder: 'border-purple-500/20',
  },
  blue: {
    gradient: 'from-blue-400 via-blue-500 to-blue-700',
    ring: 'ring-blue-400/30',
    online: 'bg-blue-400',
    menuBg: 'linear-gradient(145deg, rgba(10, 22, 40, 0.98) 0%, rgba(5, 11, 20, 0.99) 100%)',
    menuBorder: 'border-blue-500/30',
    shine: 'via-blue-400/50',
    accent: 'text-blue-400',
    accentBg: 'bg-blue-500/10',
    accentBorder: 'border-blue-500/20',
  },
  redwhite: {
    gradient: 'from-red-400 via-red-500 to-red-700',
    ring: 'ring-red-400/30',
    online: 'bg-red-400',
    menuBg: 'linear-gradient(145deg, rgba(69, 10, 10, 0.98) 0%, rgba(30, 5, 5, 0.99) 100%)',
    menuBorder: 'border-red-400/30',
    shine: 'via-red-400/50',
    accent: 'text-red-400',
    accentBg: 'bg-red-500/10',
    accentBorder: 'border-red-500/20',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getInitials(name: string, email?: string): string {
  if (name && name !== email) {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return 'U';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function AvatarDropdownPortalComponent({
  email,
  role,
  fullName,
  avatarUrl,
  rewardPoints = 0,
  theme = 'emerald',
  onSignOut,
}: AvatarDropdownPortalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right?: number; left?: number }>({ top: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const caps = useMemo(() => getDeviceCapabilities(), []);
  
  const initials = getInitials(fullName, email);
  const hasAvatar = avatarUrl && !imageError;
  const colors = themeConfig[theme];

  // Calculate menu position when opening - handles all screen sizes
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 256; // w-64 = 16rem = 256px
      const padding = 16; // Minimum padding from edges
      const viewportWidth = window.innerWidth;
      
      // On small screens (mobile), center the menu
      if (viewportWidth < 400) {
        setMenuPosition({
          top: rect.bottom + 8,
          left: Math.max(padding, (viewportWidth - menuWidth) / 2),
          right: undefined,
        });
        return;
      }
      
      // Calculate ideal right position (align right edge of menu with right edge of button)
      let rightPos = viewportWidth - rect.right;
      
      // Check if menu would overflow left side of viewport
      const leftEdge = viewportWidth - rightPos - menuWidth;
      if (leftEdge < padding) {
        // Shift menu right to prevent left overflow
        rightPos = viewportWidth - menuWidth - padding;
      }
      
      // Ensure minimum padding from right edge
      rightPos = Math.max(padding, rightPos);
      
      // Final check: ensure menu stays within viewport
      // If viewport is too narrow, limit rightPos so menu doesn't overflow left
      const maxRight = viewportWidth - menuWidth - padding;
      rightPos = Math.min(rightPos, Math.max(padding, maxRight));
      
      setMenuPosition({
        top: rect.bottom + 8,
        right: rightPos,
        left: undefined,
      });
    }
  }, [isOpen]);

  // Close on scroll
  useEffect(() => {
    if (!isOpen) return;
    
    const handleScroll = () => setIsOpen(false);
    const handleResize = () => setIsOpen(false);
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      <motion.button
        ref={buttonRef}
        whileHover={caps.prefersReducedMotion ? undefined : { scale: 1.02 }}
        whileTap={caps.prefersReducedMotion ? undefined : { scale: 0.97 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-2 -m-1 rounded-2xl hover:bg-white/5 active:bg-white/10 transition-colors touch-manipulation min-w-[48px] min-h-[48px]"
        aria-label="Open profile menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {/* Avatar with tap hint ring */}
        <div className="relative">
          {/* Tap hint - subtle pulsing ring on mobile */}
          <div className={`absolute inset-0 rounded-xl ${colors.ring} scale-110 opacity-0 sm:hidden ${!isOpen ? 'animate-pulse opacity-30' : ''}`} />
          
          <div className={`w-11 h-11 sm:w-11 sm:h-11 rounded-xl overflow-hidden bg-gradient-to-br ${colors.gradient} flex items-center justify-center text-white font-bold text-sm shadow-lg ring-2 ${colors.ring}`}>
            {hasAvatar ? (
              <img
                src={avatarUrl}
                alt={fullName || 'Profile'}
                onError={() => setImageError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          {/* Online indicator */}
          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${colors.online} border-2 border-black/50`} />
        </div>
        
        {/* Dropdown indicator - always visible on mobile for clarity */}
        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </motion.button>

      {/* Portal-rendered dropdown */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 z-[9998]"
                style={{ background: 'rgba(0,0,0,0.4)' }}
              />
              
              {/* Menu */}
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className={`fixed w-64 max-w-[calc(100vw-2rem)] rounded-2xl border ${colors.menuBorder} shadow-2xl shadow-black/50 z-[9999] overflow-hidden`}
                style={{
                  top: menuPosition.top,
                  ...(menuPosition.left !== undefined 
                    ? { left: menuPosition.left, right: 'auto' } 
                    : { right: menuPosition.right, left: 'auto' }
                  ),
                  background: colors.menuBg,
                  backdropFilter: 'blur(20px)',
                }}
              >
                {/* Top shine */}
                <div className={`absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent ${colors.shine} to-transparent`} />
                
                {/* User info header */}
                <div className="p-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br ${colors.gradient} flex items-center justify-center text-white font-bold text-lg shadow-lg ring-1 ${colors.ring}`}>
                      {hasAvatar ? (
                        <img
                          src={avatarUrl}
                          alt={fullName || 'Profile'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{fullName || email}</p>
                      <p className={`text-xs ${colors.accent}/60 capitalize`}>{role?.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                  
                  {/* Reward points badge */}
                  {rewardPoints > 0 && (
                    <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-medium text-amber-300">{rewardPoints} reward points</span>
                    </div>
                  )}
                </div>
                
                {/* Menu items */}
                <div className="p-2">
                  <Link
                    to="/profile"
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl hover:${colors.accentBg} transition-colors group`}
                  >
                    <div className={`w-8 h-8 rounded-lg ${colors.accentBg} border ${colors.accentBorder} flex items-center justify-center group-hover:bg-opacity-30 transition-colors`}>
                      <User className={`w-4 h-4 ${colors.accent}`} />
                    </div>
                    <span className="text-sm text-white/80 group-hover:text-white">View Profile</span>
                  </Link>
                  
                  <Link
                    to="/settings"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-blue-500/10 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                      <Settings className="w-4 h-4 text-blue-400" />
                    </div>
                    <span className="text-sm text-white/80 group-hover:text-white">Settings</span>
                  </Link>
                  
                  <div className="my-1 mx-3 h-px bg-white/5" />
                  
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onSignOut();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/10 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                      <LogOut className="w-4 h-4 text-red-400" />
                    </div>
                    <span className="text-sm text-red-400 group-hover:text-red-300">Sign Out</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

export const AvatarDropdownPortal = memo(AvatarDropdownPortalComponent);
export default AvatarDropdownPortal;
