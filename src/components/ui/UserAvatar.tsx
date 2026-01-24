/**
 * UserAvatar Component
 * 
 * A unified, accessible avatar component that displays:
 * - User's uploaded photo when available
 * - Initials fallback with premium green gradient styling
 * - Loading skeleton state while images load
 * 
 * Supports multiple size variants for different UI contexts.
 */

import { memo, useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { getInitials } from '../../lib/getInitials';

// ============================================================================
// TYPES
// ============================================================================

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface UserAvatarProps {
  /** Public URL to the user's avatar image */
  avatarUrl?: string | null;
  /** User's full name (used for initials and alt text) */
  name?: string | null;
  /** User's email (fallback for initials) */
  email?: string | null;
  /** Size variant */
  size?: AvatarSize;
  /** Additional CSS classes */
  className?: string;
  /** Show loading skeleton while image loads */
  showLoadingState?: boolean;
  /** Optional click handler */
  onClick?: () => void;
}

// ============================================================================
// SIZE CONFIGURATION
// ============================================================================

const sizeConfig: Record<AvatarSize, {
  container: string;
  text: string;
  dimensions: number;
}> = {
  xs: {
    container: 'w-6 h-6',
    text: 'text-[10px]',
    dimensions: 24,
  },
  sm: {
    container: 'w-8 h-8',
    text: 'text-xs',
    dimensions: 32,
  },
  md: {
    container: 'w-10 h-10',
    text: 'text-sm',
    dimensions: 40,
  },
  lg: {
    container: 'w-16 h-16',
    text: 'text-xl',
    dimensions: 64,
  },
  xl: {
    container: 'w-28 h-28',
    text: 'text-4xl',
    dimensions: 112,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// ============================================================================
// LOADING SKELETON COMPONENT
// ============================================================================

const AvatarSkeleton = memo(function AvatarSkeleton({ 
  size 
}: { 
  size: AvatarSize 
}) {
  const config = sizeConfig[size];
  
  return (
    <div 
      className={`${config.container} rounded-full animate-pulse`}
      style={{
        background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.2) 0%, rgba(4, 40, 28, 0.4) 100%)',
      }}
    />
  );
});

// ============================================================================
// INITIALS AVATAR COMPONENT
// ============================================================================

const InitialsAvatar = memo(function InitialsAvatar({ 
  initials, 
  size,
  onClick,
}: { 
  initials: string;
  size: AvatarSize;
  onClick?: () => void;
}) {
  const config = sizeConfig[size];
  
  const Component = onClick ? motion.button : motion.div;
  
  return (
    <Component
      onClick={onClick}
      className={`
        relative ${config.container} rounded-full flex items-center justify-center
        border-2 border-emerald-400/40 overflow-hidden
        ${onClick ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:ring-offset-2 focus:ring-offset-transparent' : ''}
      `}
      style={{
        background: 'linear-gradient(145deg, rgba(4, 40, 28, 0.95) 0%, rgba(2, 25, 18, 0.98) 100%)',
        boxShadow: '0 0 20px rgba(16, 185, 129, 0.2), inset 0 0 10px rgba(16, 185, 129, 0.08)',
      }}
      whileHover={onClick ? { scale: 1.05 } : undefined}
      whileTap={onClick ? { scale: 0.95 } : undefined}
      role="img"
      aria-label={`User avatar showing initials ${initials}`}
      {...(onClick && { type: 'button' })}
    >
      {/* Inner gradient overlay */}
      <div 
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.2) 0%, transparent 50%, rgba(5, 150, 105, 0.1) 100%)',
        }}
      />
      
      {/* Initials text */}
      <span 
        className={`
          relative ${config.text} font-bold
          bg-gradient-to-br from-emerald-200 via-emerald-300 to-emerald-400 
          bg-clip-text text-transparent
        `}
      >
        {initials}
      </span>
    </Component>
  );
});

// ============================================================================
// IMAGE AVATAR COMPONENT
// ============================================================================

const ImageAvatar = memo(function ImageAvatar({ 
  src, 
  alt, 
  size,
  onError,
  onClick,
}: { 
  src: string;
  alt: string;
  size: AvatarSize;
  onError: () => void;
  onClick?: () => void;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const config = sizeConfig[size];
  
  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);
  
  const Component = onClick ? 'button' : 'div';
  
  return (
    <Component
      onClick={onClick}
      className={`
        relative ${config.container} rounded-full overflow-hidden
        border-2 border-emerald-400/40
        ${onClick ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:ring-offset-2 focus:ring-offset-transparent' : ''}
      `}
      style={{
        boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)',
      }}
      {...(onClick && { type: 'button' as const })}
    >
      {/* Loading skeleton (shown until image loads) */}
      {!isLoaded && (
        <div 
          className="absolute inset-0 animate-pulse"
          style={{
            background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.2) 0%, rgba(4, 40, 28, 0.4) 100%)',
          }}
        />
      )}
      
      {/* Actual image */}
      <img
        src={src}
        alt={alt}
        onLoad={handleLoad}
        onError={onError}
        loading="lazy"
        className={`
          w-full h-full object-cover transition-opacity duration-300
          ${isLoaded ? 'opacity-100' : 'opacity-0'}
        `}
      />
      
      {/* Subtle inner shadow overlay for depth */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 15px rgba(0, 0, 0, 0.2)',
        }}
      />
    </Component>
  );
});

// ============================================================================
// MAIN USER AVATAR COMPONENT
// ============================================================================

function UserAvatarComponent({
  avatarUrl,
  name,
  email,
  size = 'md',
  className = '',
  showLoadingState = true,
  onClick,
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);
  
  const initials = useMemo(() => getInitials(name, email), [name, email]);
  const altText = name || email || 'User avatar';
  
  // Reset error state if avatarUrl changes
  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);
  
  // Determine what to render
  const hasValidImage = avatarUrl && !imageError;
  
  return (
    <div className={`relative ${className}`}>
      {hasValidImage ? (
        <ImageAvatar
          src={avatarUrl}
          alt={altText}
          size={size}
          onError={handleImageError}
          onClick={onClick}
        />
      ) : showLoadingState && avatarUrl && !imageError ? (
        <AvatarSkeleton size={size} />
      ) : (
        <InitialsAvatar
          initials={initials}
          size={size}
          onClick={onClick}
        />
      )}
    </div>
  );
}

// Export memoized component
export const UserAvatar = memo(UserAvatarComponent);
export default UserAvatar;
