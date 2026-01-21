/**
 * ProfileQuickAccess Component
 * 
 * A minimal, non-intrusive profile access button that appears in the header.
 * Shows user's avatar photo or initials fallback.
 */

import { memo, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getDeviceCapabilities } from '../lib/mobilePerf';

interface ProfileQuickAccessProps {
  /** Theme variant for different dashboard contexts */
  theme?: 'emerald' | 'amber' | 'blue' | 'ember';
}

const themeConfig = {
  emerald: {
    border: 'border-emerald-400/40',
    hoverBorder: 'hover:border-emerald-400/70',
    text: 'text-emerald-200',
    glow: 'rgba(16, 185, 129, 0.25)',
    hoverGlow: 'rgba(16, 185, 129, 0.5)',
    bg: 'from-emerald-500/20 to-emerald-600/30',
    gradient: 'linear-gradient(145deg, rgba(4, 40, 28, 0.95) 0%, rgba(2, 25, 18, 0.98) 100%)',
  },
  amber: {
    border: 'border-amber-400/40',
    hoverBorder: 'hover:border-amber-400/70',
    text: 'text-amber-200',
    glow: 'rgba(245, 158, 11, 0.25)',
    hoverGlow: 'rgba(245, 158, 11, 0.5)',
    bg: 'from-amber-500/20 to-amber-600/30',
    gradient: 'linear-gradient(145deg, rgba(40, 28, 4, 0.95) 0%, rgba(25, 18, 2, 0.98) 100%)',
  },
  blue: {
    border: 'border-blue-400/40',
    hoverBorder: 'hover:border-blue-400/70',
    text: 'text-blue-200',
    glow: 'rgba(59, 130, 246, 0.25)',
    hoverGlow: 'rgba(59, 130, 246, 0.5)',
    bg: 'from-blue-500/20 to-blue-600/30',
    gradient: 'linear-gradient(145deg, rgba(4, 28, 40, 0.95) 0%, rgba(2, 18, 25, 0.98) 100%)',
  },
  ember: {
    border: 'border-orange-400/40',
    hoverBorder: 'hover:border-orange-400/70',
    text: 'text-orange-200',
    glow: 'rgba(249, 115, 22, 0.25)',
    hoverGlow: 'rgba(249, 115, 22, 0.5)',
    bg: 'from-orange-500/20 to-red-600/30',
    gradient: 'linear-gradient(145deg, rgba(40, 20, 4, 0.95) 0%, rgba(25, 12, 2, 0.98) 100%)',
  },
};

/**
 * Get initials from name or email
 */
function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name && name.trim()) {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  
  if (email) {
    return email.slice(0, 1).toUpperCase();
  }
  
  return '?';
}

function ProfileQuickAccessComponent({ theme = 'emerald' }: ProfileQuickAccessProps) {
  const { fullName, user, avatarUrl } = useAuth();
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const config = themeConfig[theme];
  const [imageError, setImageError] = useState(false);

  const initials = useMemo(() => getInitials(fullName, user?.email), [fullName, user?.email]);
  const hasAvatar = avatarUrl && !imageError;

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  return (
    <motion.div
      whileHover={caps.prefersReducedMotion ? undefined : { scale: 1.08 }}
      whileTap={caps.prefersReducedMotion ? undefined : { scale: 0.95 }}
    >
      <Link
        to="/profile"
        className={`
          relative flex items-center justify-center
          w-9 h-9 rounded-full overflow-hidden
          border ${config.border} ${config.hoverBorder}
          transition-all duration-200
          group
        `}
        style={{
          boxShadow: `0 2px 8px ${config.glow}`,
          background: hasAvatar ? 'transparent' : config.gradient,
        }}
        aria-label="Go to profile"
        title="My Profile"
      >
        {/* Hover glow ring */}
        <div 
          className="absolute -inset-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${config.hoverGlow} 0%, transparent 70%)`,
            filter: 'blur(4px)',
          }}
        />

        {/* Avatar Image or Initials */}
        {hasAvatar ? (
          <img
            src={avatarUrl}
            alt={fullName || 'Profile'}
            onError={handleImageError}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className={`relative text-xs font-bold ${config.text}`}>
            {initials}
          </span>
        )}
      </Link>
    </motion.div>
  );
}

export const ProfileQuickAccess = memo(ProfileQuickAccessComponent);
export default ProfileQuickAccess;
