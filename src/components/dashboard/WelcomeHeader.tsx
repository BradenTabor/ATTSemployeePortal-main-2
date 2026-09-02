/**
 * WelcomeHeader Component
 * 
 * A unified header that combines:
 * - Dynamic, contextual welcome messages
 * - User avatar with profile access
 * - Time-of-day awareness
 * - Compliance/job context awareness
 * 
 * UX Philosophy:
 * - Personalized experience increases engagement
 * - Quick access to profile without scrolling
 * - Context-aware messaging creates relevance
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
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Trophy,
  Shield,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getDeviceCapabilities } from '../../lib/mobilePerf';
import { canopy } from '../../lib/glass';
import { Eyebrow, type EyebrowTone } from '../canopy/Eyebrow';
import { EASE_CANOPY, riseThroughBlur, reducedMotionFade } from '../../motion/presets';
import { CertStatusChip } from './CertStatusChip';

// ============================================================================
// TYPES
// ============================================================================

type WelcomeHeaderTheme = 'emerald' | 'blue' | 'purple' | 'redwhite';

interface WelcomeHeaderProps {
  /** Theme variant - emerald (default), blue, purple, or redwhite */
  theme?: WelcomeHeaderTheme;
  /** Whether all compliance forms are complete */
  allFormsComplete?: boolean;
  /** Number of active jobs */
  activeJobsCount?: number;
  /** Current job name if there's an active one */
  currentJobName?: string;
  /** User's reward points */
  rewardPoints?: number;
  /** Sign out handler */
  onSignOut: () => void;
  /** Optional custom subtitle - overrides dynamic message */
  subtitle?: string;
  /** Optional role badge text - shows role badge with custom text */
  roleBadgeText?: string;
}

// ============================================================================
// THEME CONFIG
// ============================================================================

const themeConfig = {
  emerald: {
    bgGradient: 'linear-gradient(145deg, rgba(47,164,90, 0.1) 0%, rgba(11,16,13, 0.65) 40%, rgba(0,0,0, 0.75) 100%)',
    accentGlow: 'radial-gradient(ellipse at 25% 0%, rgba(47,164,90, 0.2) 0%, transparent 45%)',
    lineGradient: 'bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-600',
    lineShadow: '0 0 12px rgba(47,164,90, 0.4), 0 0 24px rgba(47,164,90, 0.2)',
    textGradient: 'bg-gradient-to-r from-white via-emerald-100 to-white/90',
    textShadow: 'drop-shadow-[0_0_30px_rgba(94,232,152,0.35)]',
    iconColor: 'text-emerald-400/50',
    subtitleColor: 'text-emerald-300/40',
    badgeBg: 'bg-emerald-500/20',
    badgeBorder: 'border-emerald-500/30',
    badgeIcon: 'text-emerald-400',
    badgeText: 'text-emerald-300',
    avatarGradient: 'from-emerald-400 via-emerald-500 to-emerald-700',
    avatarShadow: 'shadow-emerald-500/25',
    avatarRing: 'ring-emerald-400/30',
    onlineIndicatorBorder: 'border-[#0B100D]',
    dropdownBorder: 'border-emerald-500/30',
    dropdownBg: 'linear-gradient(145deg, rgba(11,16,13, 0.98) 0%, rgba(4,6,5, 0.99) 100%)',
    dropdownShine: 'via-emerald-400/50',
    menuItemHover: 'hover:bg-emerald-500/10',
    menuItemBg: 'bg-emerald-500/10',
    menuItemBorder: 'border-emerald-500/20',
    menuItemIcon: 'text-emerald-400',
  },
  blue: {
    bgGradient: 'linear-gradient(145deg, rgba(125,205,162, 0.1) 0%, rgba(18,26,21, 0.65) 40%, rgba(4,6,5, 0.75) 100%)',
    accentGlow: 'radial-gradient(ellipse at 25% 0%, rgba(125,205,162, 0.2) 0%, transparent 45%)',
    lineGradient: 'bg-gradient-to-b from-blue-300 via-blue-400 to-blue-600',
    lineShadow: '0 0 12px rgba(125,205,162, 0.4), 0 0 24px rgba(125,205,162, 0.2)',
    textGradient: 'bg-gradient-to-r from-white via-blue-100 to-white/90',
    textShadow: 'drop-shadow-[0_0_30px_rgba(180,230,201,0.35)]',
    iconColor: 'text-blue-400/50',
    subtitleColor: 'text-blue-300/40',
    badgeBg: 'bg-blue-500/20',
    badgeBorder: 'border-blue-500/30',
    badgeIcon: 'text-blue-400',
    badgeText: 'text-blue-300',
    avatarGradient: 'from-blue-400 via-blue-500 to-blue-700',
    avatarShadow: 'shadow-blue-500/25',
    avatarRing: 'ring-blue-400/30',
    onlineIndicatorBorder: 'border-[#0A2A19]',
    dropdownBorder: 'border-blue-500/30',
    dropdownBg: 'linear-gradient(145deg, rgba(18,26,21, 0.98) 0%, rgba(4,6,5, 0.99) 100%)',
    dropdownShine: 'via-blue-400/50',
    menuItemHover: 'hover:bg-blue-500/10',
    menuItemBg: 'bg-blue-500/10',
    menuItemBorder: 'border-blue-500/20',
    menuItemIcon: 'text-blue-400',
  },
  purple: {
    bgGradient: 'linear-gradient(145deg, rgba(127,224,176, 0.1) 0%, rgba(28,59,44, 0.65) 40%, rgba(11,16,13, 0.75) 100%)',
    accentGlow: 'radial-gradient(ellipse at 25% 0%, rgba(127,224,176, 0.2) 0%, transparent 45%)',
    lineGradient: 'bg-gradient-to-b from-purple-300 via-purple-400 to-purple-600',
    lineShadow: '0 0 12px rgba(127,224,176, 0.4), 0 0 24px rgba(127,224,176, 0.2)',
    textGradient: 'bg-gradient-to-r from-white via-purple-100 to-white/90',
    textShadow: 'drop-shadow-[0_0_30px_rgba(127,224,176,0.35)]',
    iconColor: 'text-purple-400/50',
    subtitleColor: 'text-purple-300/40',
    badgeBg: 'bg-purple-500/20',
    badgeBorder: 'border-purple-500/30',
    badgeIcon: 'text-purple-400',
    badgeText: 'text-purple-300',
    avatarGradient: 'from-purple-400 via-purple-500 to-purple-700',
    avatarShadow: 'shadow-purple-500/25',
    avatarRing: 'ring-purple-400/30',
    onlineIndicatorBorder: 'border-[#05170E]',
    dropdownBorder: 'border-purple-500/30',
    dropdownBg: 'linear-gradient(145deg, rgba(28,59,44, 0.98) 0%, rgba(11,16,13, 0.99) 100%)',
    dropdownShine: 'via-purple-400/50',
    menuItemHover: 'hover:bg-purple-500/10',
    menuItemBg: 'bg-purple-500/10',
    menuItemBorder: 'border-purple-500/20',
    menuItemIcon: 'text-purple-400',
  },
  redwhite: {
    bgGradient: 'linear-gradient(145deg, rgba(220,38,38, 0.1) 0%, rgba(30,42,35, 0.65) 40%, rgba(4,6,5, 0.75) 100%)',
    accentGlow: 'radial-gradient(ellipse at 25% 0%, rgba(254,202,202, 0.2) 0%, transparent 45%)',
    lineGradient: 'bg-gradient-to-b from-red-200 via-red-400 to-red-600',
    lineShadow: '0 0 12px rgba(220,38,38, 0.4), 0 0 24px rgba(220,38,38, 0.2)',
    textGradient: 'bg-gradient-to-r from-white via-red-100 to-white/90',
    textShadow: 'drop-shadow-[0_0_30px_rgba(220,38,38,0.35)]',
    iconColor: 'text-red-400/50',
    subtitleColor: 'text-red-300/40',
    badgeBg: 'bg-red-500/20',
    badgeBorder: 'border-red-500/30',
    badgeIcon: 'text-red-400',
    badgeText: 'text-red-300',
    avatarGradient: 'from-red-300 via-red-500 to-red-700',
    avatarShadow: 'shadow-red-500/25',
    avatarRing: 'ring-red-400/30',
    onlineIndicatorBorder: 'border-[#040605]',
    dropdownBorder: 'border-red-500/30',
    dropdownBg: 'linear-gradient(145deg, rgba(30,42,35, 0.98) 0%, rgba(4,6,5, 0.99) 100%)',
    dropdownShine: 'via-red-400/50',
    menuItemHover: 'hover:bg-red-500/10',
    menuItemBg: 'bg-red-500/10',
    menuItemBorder: 'border-red-500/20',
    menuItemIcon: 'text-red-400',
  },
};

/** Canopy hero accents per role theme (bloom colour + italic accent word). */
const HERO_ACCENT: Record<WelcomeHeaderTheme, { bloom: string; text: string; eyebrow: EyebrowTone }> = {
  emerald: { bloom: 'rgba(61,220,132, 0.28)', text: 'text-verdant-300', eyebrow: 'verdant' },
  blue: { bloom: 'rgba(94,232,152, 0.28)', text: 'text-glacier-300', eyebrow: 'glacier' },
  purple: { bloom: 'rgba(94,232,152, 0.28)', text: 'text-moss-300', eyebrow: 'moss' },
  redwhite: { bloom: 'rgba(248,113,113, 0.26)', text: 'text-red-300', eyebrow: 'red' },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function getGreeting(timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'): string {
  switch (timeOfDay) {
    case 'morning':
      return 'Good morning';
    case 'afternoon':
      return 'Good afternoon';
    case 'evening':
      return 'Good evening';
    case 'night':
      return 'Hey there';
  }
}

function getDynamicMessage(
  firstName: string,
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night',
  allFormsComplete: boolean,
  activeJobsCount: number,
  currentJobName?: string
): { greeting: string; subtitle: string } {
  const baseGreeting = getGreeting(timeOfDay);
  
  // Context-aware messaging
  if (allFormsComplete && activeJobsCount === 0) {
    return {
      greeting: `All caught up, ${firstName}!`,
      subtitle: 'You\'re fully compliant. Great job! 🎉',
    };
  }
  
  if (allFormsComplete && activeJobsCount > 0) {
    return {
      greeting: `${baseGreeting}, ${firstName}`,
      subtitle: currentJobName 
        ? `Let's finish ${currentJobName} strong.`
        : `You have ${activeJobsCount} active job${activeJobsCount > 1 ? 's' : ''} waiting.`,
    };
  }
  
  if (timeOfDay === 'morning' && !allFormsComplete) {
    return {
      greeting: `Rise and grind, ${firstName}!`,
      subtitle: 'Your daily forms await. Let\'s get compliant.',
    };
  }
  
  if (timeOfDay === 'afternoon' && !allFormsComplete) {
    return {
      greeting: `${baseGreeting}, ${firstName}`,
      subtitle: 'Don\'t forget your daily forms before 9 AM tomorrow.',
    };
  }
  
  return {
    greeting: `${baseGreeting}, ${firstName}`,
    subtitle: 'Your command center awaits.',
  };
}

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
// AVATAR DROPDOWN COMPONENT
// ============================================================================

interface AvatarDropdownProps {
  email?: string;
  role: string | null;
  fullName: string;
  avatarUrl?: string | null;
  rewardPoints?: number;
  onSignOut: () => void;
  themeStyles: typeof themeConfig.emerald;
}

const AvatarDropdown = memo(function AvatarDropdown({
  email,
  role,
  fullName,
  avatarUrl,
  rewardPoints = 0,
  onSignOut,
  themeStyles,
}: AvatarDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right?: number; left?: number }>({ top: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const initials = getInitials(fullName, email);
  const hasAvatar = avatarUrl && !imageError;

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
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isOpen]);

  return (
    <div className="relative">
      <motion.button
        ref={buttonRef}
        whileHover={caps.prefersReducedMotion ? undefined : { scale: 1.05 }}
        whileTap={caps.prefersReducedMotion ? undefined : { scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 sm:gap-2 p-0.5 sm:p-1 rounded-lg sm:rounded-xl hover:bg-white/5 transition-colors"
      >
        {/* Avatar */}
        <div className="relative">
          <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl overflow-hidden bg-gradient-to-br ${themeStyles.avatarGradient} flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-md sm:shadow-lg ${themeStyles.avatarShadow} ring-1.5 sm:ring-2 ${themeStyles.avatarRing}`}>
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
          <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-400 border-[1.5px] sm:border-2 ${themeStyles.onlineIndicatorBorder}`} />
        </div>
        
        {/* Dropdown indicator - hidden on mobile */}
        <ChevronDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/50 hidden sm:block transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </motion.button>

      {/* Dropdown menu - Rendered via Portal to escape all overflow constraints */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop - fixed to viewport */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 z-[9998]"
                style={{ background: 'rgba(0,0,0,0.3)' }}
              />
              
              {/* Menu - fixed position calculated from button */}
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className={`fixed w-64 max-w-[calc(100vw-2rem)] rounded-leaf-sm border ${themeStyles.dropdownBorder} shadow-2xl shadow-black/50 z-[9999] overflow-hidden`}
                style={{
                  top: menuPosition.top,
                  ...(menuPosition.left !== undefined 
                    ? { left: menuPosition.left, right: 'auto' } 
                    : { right: menuPosition.right, left: 'auto' }
                  ),
                  background: themeStyles.dropdownBg,
                  backdropFilter: 'blur(20px)',
                }}
              >
                {/* Top shine */}
                <div className={`absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent ${themeStyles.dropdownShine} to-transparent`} />
                
                {/* User info header */}
                <div className="p-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br ${themeStyles.avatarGradient} flex items-center justify-center text-white font-bold text-lg shadow-lg ${themeStyles.avatarShadow} ring-1 ${themeStyles.avatarRing}`}>
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
                      <p className={`text-xs capitalize ${themeStyles.subtitleColor}`}>{role?.replace(/_/g, ' ')}</p>
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
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${themeStyles.menuItemHover} transition-colors group`}
                  >
                    <div className={`w-8 h-8 rounded-lg ${themeStyles.menuItemBg} border ${themeStyles.menuItemBorder} flex items-center justify-center group-hover:opacity-80 transition-colors`}>
                      <User className={`w-4 h-4 ${themeStyles.menuItemIcon}`} />
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
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function WelcomeHeaderComponent({
  theme = 'emerald',
  allFormsComplete = false,
  activeJobsCount = 0,
  currentJobName,
  rewardPoints = 0,
  onSignOut,
  subtitle,
  roleBadgeText,
}: WelcomeHeaderProps) {
  const { user, fullName, role, avatarUrl } = useAuth();
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;
  const themeStyles = themeConfig[theme];
  
  // Get dynamic content - timeOfDay is stable since it's based on the current hour
  const timeOfDay = useMemo(() => getTimeOfDay(), []);
  
  // Extract first name - using user object for simplicity
  const firstName = useMemo(() => {
    if (fullName) {
      return fullName.split(' ')[0];
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'there';
  }, [fullName, user]);
  
  // Get contextual message - use subtitle prop override if provided
  const message = useMemo(() => {
    const dynamicMsg = getDynamicMessage(firstName, timeOfDay, allFormsComplete, activeJobsCount, currentJobName);
    if (subtitle) {
      return { greeting: dynamicMsg.greeting, subtitle };
    }
    return dynamicMsg;
  }, [firstName, timeOfDay, allFormsComplete, activeJobsCount, currentJobName, subtitle]);

  const words = message.greeting.replace(/[!.]$/, '').split(' ');
  const TimeIcon = timeOfDay === 'morning' ? Sunrise : timeOfDay === 'afternoon' ? Sun : timeOfDay === 'evening' ? Sunset : Moon;
  const accent = HERO_ACCENT[theme];

  return (
    <motion.div
      initial={caps.prefersReducedMotion ? false : { opacity: 0, y: 24, filter: 'blur(12px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 1, ease: EASE_CANOPY }}
      className="relative"
    >
      <div className={`${canopy.hero} px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10`}>
        {/* Role-tinted bloom in the top-left corner */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-32 h-72 w-72 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, ${accent.bloom} 0%, transparent 70%)` }}
        />

        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Eyebrow tone={accent.eyebrow} rule={false}>
              <span className="inline-flex items-center gap-2">
                <TimeIcon className="h-3 w-3" aria-hidden />
                {timeOfDay} · {roleBadgeText ?? 'Employee Hub'}
              </span>
            </Eyebrow>

            <h1 className="type-display mt-4 max-w-3xl text-balance text-[clamp(2rem,5.5vw,4.25rem)] font-light text-bone-50">
              {words.map((w, i) => (
                <motion.span
                  key={`${w}-${i}`}
                  className={`inline-block ${i === words.length - 1 ? `italic ${accent.text} text-glow` : ''}`}
                  variants={enableAnimations ? riseThroughBlur : reducedMotionFade}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: enableAnimations ? 0.15 + i * 0.08 : 0 }}
                >
                  {w}
                  {i < words.length - 1 && '\u00A0'}
                </motion.span>
              ))}
            </h1>

            <motion.p
              initial={enableAnimations ? { opacity: 0, y: 10 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE_CANOPY, delay: 0.5 }}
              className="mt-3 max-w-xl text-pretty text-sm text-bone-300 sm:text-base"
            >
              {message.subtitle}
            </motion.p>

            <motion.div
              initial={enableAnimations ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="mt-5 flex flex-wrap items-center gap-2"
            >
              {allFormsComplete && (
                <span className={canopy.pillLive}>
                  <Shield className="h-3 w-3" aria-hidden />
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em]">Compliant</span>
                </span>
              )}
              {activeJobsCount > 0 && (
                <span className={canopy.pill}>
                  <Zap className="h-3 w-3" aria-hidden />
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em]">
                    {activeJobsCount} job{activeJobsCount > 1 ? 's' : ''}
                  </span>
                </span>
              )}
              <CertStatusChip />
            </motion.div>
          </div>

          <div className="relative z-10 shrink-0">
            <AvatarDropdown
              email={user?.email}
              role={role}
              fullName={fullName || user?.email || ''}
              avatarUrl={avatarUrl}
              rewardPoints={rewardPoints}
              onSignOut={onSignOut}
              themeStyles={themeStyles}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export type { WelcomeHeaderTheme };
export const WelcomeHeader = memo(WelcomeHeaderComponent);
export default WelcomeHeader;
