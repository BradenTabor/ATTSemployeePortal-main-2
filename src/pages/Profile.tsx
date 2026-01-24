/**
 * Employee Profile Page
 * 
 * Premium green-themed profile management page featuring:
 * - Cinematic entrance animations with orchestrated staggering
 * - Profile overview with avatar and basic info
 * - License & Certifications tracking with expiration warnings
 * - Notification preferences management
 * - Account security section
 * 
 * Documentation grounded via Context7 MCP for Motion animations.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
  User,
  Mail,
  Shield,
  Award,
  Bell,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  CreditCard,
  Truck,
  Heart,
  RefreshCw,
  Loader2,
  Settings,
} from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';
import { TextEffect } from '../components/ui/TextEffect';
import { getDeviceCapabilities } from '../lib/mobilePerf';
import { EnableNotificationsButton } from '../components/notifications';
// ScrollReveal import removed - not currently used
import AvatarUpload from '../components/profile/AvatarUpload';

// ============================================================================
// TYPES
// ============================================================================

interface UserProfile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
  drivers_license_number: string | null;
  drivers_license_class: string | null;
  drivers_license_expiration: string | null;
  created_at: string;
  updated_at: string | null;
}

interface CertificationStatus {
  label: string;
  value: string | null;
  expirationDate: string | null;
  icon: typeof CreditCard;
  status: 'valid' | 'expiring' | 'expired' | 'missing';
  daysUntilExpiration: number | null;
}

// ============================================================================
// CINEMATIC ANIMATION VARIANTS (Context7 Motion patterns)
// ============================================================================

// Hero entrance - dramatic scale and blur reveal
const heroVariants: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.92,
    y: 30,
    filter: 'blur(20px)',
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1],
      when: 'beforeChildren',
      staggerChildren: 0.12,
    },
  },
};

// Container with orchestrated stagger (Context7: delayChildren + staggerChildren)
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: 'beforeChildren',
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

// Card entrance with spring physics
const cardVariants: Variants = {
  hidden: { 
    opacity: 0, 
    y: 40, 
    scale: 0.95,
    rotateX: -10,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 15,
      mass: 0.8,
    },
  },
};

// Certification card with hover lift
const certCardVariants: Variants = {
  hidden: { 
    opacity: 0, 
    x: -30,
    scale: 0.9,
  },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 120,
      damping: 14,
    },
  },
};

// ProfileAvatar component removed - using AvatarUpload instead

// Floating glow orb animation
const orbVariants: Variants = {
  animate: {
    x: [0, 20, -10, 0],
    y: [0, -15, 10, 0],
    scale: [1, 1.2, 0.9, 1],
    opacity: [0.3, 0.5, 0.3, 0.3],
    transition: {
      duration: 8,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// Shimmer line animation
const shimmerVariants: Variants = {
  animate: {
    x: ['-100%', '200%'],
    transition: {
      duration: 2.5,
      repeat: Infinity,
      ease: 'easeInOut',
      repeatDelay: 3,
    },
  },
};

// Badge entrance with bounce
const badgeVariants: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 15,
      delay: 0.5,
    },
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateDaysUntilExpiration(expirationDate: string | null): number | null {
  if (!expirationDate) return null;
  
  const expDate = new Date(expirationDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expDate.setHours(0, 0, 0, 0);
  
  const diffTime = expDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

function getCertificationStatus(
  expirationDate: string | null,
  value: string | null
): 'valid' | 'expiring' | 'expired' | 'missing' {
  if (!value) return 'missing';
  if (!expirationDate) return 'valid';
  
  const days = calculateDaysUntilExpiration(expirationDate);
  if (days === null) return 'valid';
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'valid';
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Not set';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function getRoleBadgeStyle(role: string): string {
  switch (role) {
    case 'admin':
      return 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-amber-400/40 text-amber-200';
    case 'mechanic':
      return 'bg-gradient-to-r from-orange-500/20 to-red-500/20 border-orange-400/40 text-orange-200';
    case 'foreman':
      return 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-400/40 text-blue-200';
    case 'general_foreman':
      return 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-400/40 text-purple-200';
    case 'safety_officer':
      return 'bg-gradient-to-r from-red-500/20 to-rose-500/20 border-red-400/40 text-red-200';
    default:
      return 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-emerald-400/40 text-emerald-200';
  }
}

function formatRoleName(role: string): string {
  return role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ProfileAvatar component removed - using AvatarUpload instead

// ============================================================================
// CERTIFICATION CARD COMPONENT - Enhanced animations
// ============================================================================

function CertificationCard({ cert }: { cert: CertificationStatus }) {
  const statusConfig = {
    valid: {
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      glow: 'rgba(16, 185, 129, 0.15)',
      label: 'Valid',
    },
    expiring: {
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      glow: 'rgba(245, 158, 11, 0.15)',
      label: 'Expiring Soon',
    },
    expired: {
      icon: AlertTriangle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      glow: 'rgba(239, 68, 68, 0.2)',
      label: 'Expired',
    },
    missing: {
      icon: AlertTriangle,
      color: 'text-white/40',
      bg: 'bg-white/5',
      border: 'border-white/10',
      glow: 'rgba(255, 255, 255, 0.05)',
      label: 'Not Set',
    },
  };

  const config = statusConfig[cert.status];
  const StatusIcon = config.icon;
  const CertIcon = cert.icon;

  return (
    <motion.div
      variants={certCardVariants}
      whileHover={{ 
        scale: 1.02, 
        y: -4,
        transition: { type: 'spring', stiffness: 300, damping: 20 }
      }}
      whileTap={{ scale: 0.98 }}
      className={`relative overflow-hidden rounded-lg sm:rounded-2xl border ${config.border} ${config.bg} p-3 sm:p-4 cursor-pointer group`}
      style={{
        boxShadow: `0 4px 20px ${config.glow}, 0 0 0 1px ${config.glow}`,
      }}
    >
      {/* Animated shimmer line - hidden on mobile for performance */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-[1px] overflow-hidden hidden sm:block"
      >
        <motion.div
          variants={shimmerVariants}
          animate="animate"
          className="h-full w-1/3"
          style={{
            background: `linear-gradient(90deg, transparent, ${cert.status === 'valid' ? 'rgba(16, 185, 129, 0.5)' : cert.status === 'expiring' ? 'rgba(245, 158, 11, 0.5)' : cert.status === 'expired' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.2)'}, transparent)`,
          }}
        />
      </motion.div>

      {/* Background pattern - hidden on mobile */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none hidden sm:block"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, currentColor 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }}
      />
      
      {/* Hover glow effect */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${config.glow} 0%, transparent 70%)`,
        }}
      />
      
      <div className="relative flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
          <motion.div 
            className={`flex-shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl ${config.bg} border ${config.border} flex items-center justify-center`}
            whileHover={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.5 }}
          >
            <CertIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${config.color}`} />
          </motion.div>
          
          <div className="min-w-0 flex-1">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.15em] text-white/50 mb-0.5 font-medium">{cert.label}</p>
            <p className="text-xs sm:text-sm font-semibold text-white truncate">
              {cert.value || 'Not provided'}
            </p>
            {cert.expirationDate && (
              <p className="text-[10px] sm:text-xs text-white/60 mt-1 sm:mt-1.5 flex items-center gap-1 sm:gap-1.5">
                <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <span className="hidden sm:inline">Expires:</span> {formatDate(cert.expirationDate)}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex-shrink-0 flex flex-col items-end gap-1 sm:gap-1.5">
          <motion.div 
            className={`flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full ${config.bg} border ${config.border}`}
            whileHover={{ scale: 1.05 }}
          >
            <StatusIcon className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${config.color}`} />
            <span className={`text-[8px] sm:text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
              {config.label}
            </span>
          </motion.div>
          
          {cert.daysUntilExpiration !== null && cert.status !== 'missing' && (
            <span className={`text-[10px] sm:text-xs font-medium ${config.color}`}>
              {cert.daysUntilExpiration < 0 
                ? `${Math.abs(cert.daysUntilExpiration)}d ago`
                : `${cert.daysUntilExpiration}d left`
              }
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// PROFILE SECTION CARD COMPONENT - Enhanced with premium styling
// ============================================================================

interface ProfileSectionProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  delay?: number;
}

function ProfileSection({ title, subtitle, icon, children, action }: ProfileSectionProps) {
  return (
    <motion.section
      variants={cardVariants}
      className="relative overflow-hidden rounded-xl sm:rounded-2xl md:rounded-3xl border border-emerald-400/20"
      style={{
        background: 'linear-gradient(145deg, rgba(4, 30, 21, 0.95) 0%, rgba(2, 15, 10, 0.98) 50%, rgba(1, 8, 5, 1) 100%)',
        boxShadow: '0 8px 40px -10px rgba(16, 185, 129, 0.2), 0 4px 20px -8px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Top shine line with animation */}
      <div className="absolute top-0 left-0 right-0 h-[1px] overflow-hidden">
        <div className="h-full w-full bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
        <motion.div
          className="absolute top-0 h-full w-1/4"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
          }}
          animate={{ x: ['-100%', '500%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 2 }}
        />
      </div>
      
      {/* Floating orb decorations - hidden on mobile for performance */}
      <motion.div 
        className="absolute -top-16 -right-16 w-40 h-40 rounded-full pointer-events-none hidden sm:block"
        variants={orbVariants}
        animate="animate"
        style={{
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, transparent 70%)',
          filter: 'blur(25px)',
        }}
      />
      <motion.div 
        className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full pointer-events-none hidden sm:block"
        variants={orbVariants}
        animate="animate"
        style={{
          background: 'radial-gradient(circle, rgba(52, 211, 153, 0.2) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />
      
      <div className="relative p-3 sm:p-5 md:p-6">
        {/* Header - more compact on mobile */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-5">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <motion.div 
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center border border-emerald-500/30 flex-shrink-0"
              style={{
                background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.1) 100%)',
              }}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              {icon}
            </motion.div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-bold text-white truncate">{title}</h2>
              {subtitle && (
                <p className="text-[10px] sm:text-xs text-emerald-200/50 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          {action}
        </div>
        
        {/* Content */}
        {children}
      </div>
    </motion.section>
  );
}

// ============================================================================
// QUICK ACTION BUTTON COMPONENT
// ============================================================================

interface QuickActionProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}

function QuickActionButton({ href, icon, title, subtitle }: QuickActionProps) {
  return (
    <motion.a
      href={href}
      variants={cardVariants}
      whileHover={{ 
        scale: 1.03, 
        y: -4,
        transition: { type: 'spring', stiffness: 300, damping: 20 }
      }}
      whileTap={{ scale: 0.97 }}
      className="relative flex items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors group overflow-hidden"
    >
      {/* Hover glow - hidden on mobile */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none hidden sm:block">
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 30% 50%, rgba(16, 185, 129, 0.15) 0%, transparent 60%)',
          }}
        />
      </div>
      
      <div className="relative flex items-center gap-2 sm:gap-3 min-w-0">
        <motion.div 
          className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0"
          whileHover={{ rotate: [0, -10, 10, 0] }}
          transition={{ duration: 0.5 }}
        >
          {icon}
        </motion.div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-semibold text-white truncate">{title}</p>
          <p className="text-[10px] sm:text-xs text-emerald-200/50 truncate">{subtitle}</p>
        </div>
      </div>
      <motion.div
        className="relative flex-shrink-0"
        animate={{ x: [0, 4, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400/50 group-hover:text-emerald-400 transition-colors" />
      </motion.div>
    </motion.a>
  );
}

// ============================================================================
// MAIN PROFILE PAGE COMPONENT
// ============================================================================

export default function Profile() {
  const { user, role, fullName, avatarUrl } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Device capabilities for animation decisions
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isLowEnd;

  // Fetch user profile from database
  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('app_users')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (fetchError) throw fetchError;
      setProfile(data);
    } catch (err) {
      logger.error('[Profile] Failed to fetch profile:', err);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Build certifications list
  const certifications = useMemo((): CertificationStatus[] => {
    if (!profile) return [];
    
    const licenseExpDays = calculateDaysUntilExpiration(profile.drivers_license_expiration);
    
    return [
      {
        label: "Driver's License",
        value: profile.drivers_license_number,
        expirationDate: profile.drivers_license_expiration,
        icon: CreditCard,
        status: getCertificationStatus(profile.drivers_license_expiration, profile.drivers_license_number),
        daysUntilExpiration: licenseExpDays,
      },
      {
        label: 'License Class',
        value: profile.drivers_license_class,
        expirationDate: null,
        icon: Truck,
        status: profile.drivers_license_class ? 'valid' : 'missing',
        daysUntilExpiration: null,
      },
    ];
  }, [profile]);

  // Count expiring/expired certifications
  const certificationAlerts = useMemo(() => {
    const expiring = certifications.filter(c => c.status === 'expiring').length;
    const expired = certifications.filter(c => c.status === 'expired').length;
    return { expiring, expired, total: expiring + expired };
  }, [certifications]);

  // Loading state with premium animation
  if (loading) {
    return (
      <DashboardLayout title="My Profile">
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 pb-4 pt-4 sm:pt-6">
          <div className="flex flex-col items-center justify-center py-24">
            <motion.div
              className="relative"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              {/* Outer glow */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, transparent 70%)',
                  filter: 'blur(20px)',
                }}
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 className="w-12 h-12 text-emerald-400" />
              </motion.div>
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6 text-emerald-200/60 font-medium"
            >
              Loading your profile...
            </motion.p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="My Profile">
      <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 pb-4 pt-3 sm:pt-6">
        {/* ================================================================ */}
        {/* COMPACT HERO HEADER */}
        {/* ================================================================ */}
        <motion.div
          variants={heroVariants}
          initial="hidden"
          animate="visible"
          className="mb-4 sm:mb-8 md:mb-10"
        >
          <div 
            className="relative overflow-hidden rounded-xl sm:rounded-2xl md:rounded-[2rem] border border-white/[0.08]"
            style={{
              background: 'linear-gradient(145deg, rgba(4, 35, 24, 0.7) 0%, rgba(2, 20, 14, 0.6) 50%, rgba(1, 10, 7, 0.5) 100%)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(16, 185, 129, 0.1), inset 0 0 80px rgba(16, 185, 129, 0.05)',
            }}
          >
            {/* Animated background orbs - hidden on mobile for performance */}
            <motion.div
              className="absolute -top-20 -left-20 w-60 h-60 rounded-full pointer-events-none hidden sm:block"
              variants={orbVariants}
              animate="animate"
              style={{
                background: 'radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 60%)',
                filter: 'blur(40px)',
              }}
            />
            <motion.div
              className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full pointer-events-none hidden sm:block"
              variants={orbVariants}
              animate="animate"
              style={{
                background: 'radial-gradient(circle, rgba(52, 211, 153, 0.25) 0%, transparent 60%)',
                filter: 'blur(35px)',
              }}
            />
            
            {/* Glass effects */}
            <div 
              className="absolute inset-0 opacity-70 pointer-events-none" 
              style={{ background: 'linear-gradient(125deg, rgba(255,255,255,0.12) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.05) 100%)' }} 
            />
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            
            {/* Content - compact on mobile: stack avatar above info, tighter spacing */}
            <div className="relative px-4 py-4 sm:px-6 sm:py-6 md:px-10 md:py-8">
              <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-6 md:gap-8">
                {/* Avatar - centered when stacked, smaller on mobile */}
                <div className="flex-shrink-0 scale-75 sm:scale-100 origin-center sm:origin-left">
                  <AvatarUpload 
                    currentAvatarUrl={avatarUrl}
                    name={fullName || profile?.full_name}
                  />
                </div>
                
                {/* Info - full width when stacked, flex-1 when row; truncates properly */}
                <div className="w-full sm:flex-1 min-w-0 overflow-hidden text-center sm:text-left">
                  {enableAnimations ? (
                    <TextEffect
                      as="h1"
                      preset="blurSlide"
                      per="word"
                      delay={0.3}
                      className="text-lg sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight break-words line-clamp-2 sm:line-clamp-1"
                      segmentWrapperClassName="bg-gradient-to-r from-white via-emerald-100 to-white/90 bg-clip-text text-transparent"
                    >
                      {fullName || profile?.full_name || 'Employee'}
                    </TextEffect>
                  ) : (
                    <h1 className="text-lg sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight bg-gradient-to-r from-white via-emerald-100 to-white/90 bg-clip-text text-transparent break-words line-clamp-2 sm:line-clamp-1">
                      {fullName || profile?.full_name || 'Employee'}
                    </h1>
                  )}
                  
                  <motion.div 
                    className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2 mt-1 sm:mt-3"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    {/* Role badge - smaller on mobile */}
                    <motion.span 
                      variants={badgeVariants}
                      initial="hidden"
                      animate="visible"
                      className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-full border text-[10px] sm:text-xs font-bold uppercase tracking-wider ${getRoleBadgeStyle(role || 'employee')}`}
                    >
                      <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      {formatRoleName(role || 'employee')}
                    </motion.span>
                    
                    {/* Alert badge if certifications expiring */}
                    <AnimatePresence>
                      {certificationAlerts.total > 0 && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.7 }}
                          className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold ${
                            certificationAlerts.expired > 0 
                              ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                              : 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                          }`}
                        >
                          <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          {certificationAlerts.expired > 0 
                            ? `${certificationAlerts.expired} Expired`
                            : `${certificationAlerts.expiring} Expiring`
                          }
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                  
                  <motion.p 
                    className="mt-1 sm:mt-3 text-xs sm:text-sm text-emerald-200/50 flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 min-w-0 overflow-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                  >
                    <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate min-w-0">{user?.email || profile?.email}</span>
                  </motion.p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Error state */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
                <motion.button
                  onClick={fetchProfile}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-medium hover:bg-red-500/30 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ================================================================ */}
        {/* MAIN CONTENT - Orchestrated stagger */}
        {/* ================================================================ */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-4 sm:space-y-6 md:space-y-8"
        >
          {/* Two-column grid for sections on larger screens */}
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            {/* Licenses & Certifications */}
            <ProfileSection
              title="Licenses & Certifications"
              subtitle="Keep your credentials up to date"
              icon={<Award className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />}
            >
              <motion.div 
                className="space-y-2 sm:space-y-3"
                variants={containerVariants}
              >
                {certifications.map((cert) => (
                  <CertificationCard key={cert.label} cert={cert} />
                ))}
              </motion.div>
              
              <motion.p 
                className="mt-3 sm:mt-5 text-[10px] sm:text-xs text-emerald-200/40 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                Contact HR to update your license information
              </motion.p>
            </ProfileSection>

            {/* Notification Preferences */}
            <ProfileSection
              title="Notifications"
              subtitle="Manage how you receive updates"
              icon={<Bell className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />}
            >
              <div 
                className="rounded-lg sm:rounded-xl border border-emerald-500/20 p-3 sm:p-5"
                style={{
                  background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.05) 0%, rgba(5, 150, 105, 0.02) 100%)',
                }}
              >
                <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <motion.div 
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0"
                    whileHover={{ scale: 1.1, rotate: 10 }}
                  >
                    <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                  </motion.div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-white">Push Notifications</p>
                    <p className="text-[10px] sm:text-xs text-emerald-200/50 mt-0.5 sm:mt-1">
                      Receive alerts for announcements, job updates, and safety notices
                    </p>
                  </div>
                </div>
                
                <EnableNotificationsButton variant="green" />
              </div>
            </ProfileSection>
          </div>

          {/* Account Info - full width */}
          <ProfileSection
            title="Account Information"
            subtitle="Your account details"
            icon={<User className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />}
          >
            <motion.div 
              className="grid gap-2 sm:gap-3 grid-cols-2"
              variants={containerVariants}
            >
              {[
                { label: 'Email Address', value: user?.email || 'Not set', icon: Mail },
                { label: 'Account Role', value: formatRoleName(role || 'employee'), icon: Shield },
                { label: 'Member Since', value: profile?.created_at ? formatDate(profile.created_at) : 'Unknown', icon: Calendar },
                { label: 'Last Updated', value: profile?.updated_at ? formatDate(profile.updated_at) : 'Never', icon: RefreshCw },
              ].map((item) => (
                <motion.div
                  key={item.label}
                  variants={certCardVariants}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className="rounded-lg sm:rounded-xl border border-white/10 bg-white/5 p-2.5 sm:p-4 group cursor-default"
                >
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                    <item.icon className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400/60" />
                    <p className="text-[8px] sm:text-[10px] uppercase tracking-[0.15em] text-white/40 font-medium truncate">{item.label}</p>
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-white truncate">{item.value}</p>
                </motion.div>
              ))}
            </motion.div>
          </ProfileSection>

          {/* Quick Actions - horizontal scroll on mobile */}
          <motion.div
            variants={containerVariants}
            className="grid gap-2 sm:gap-3 grid-cols-3"
          >
            <QuickActionButton
              href="/settings"
              icon={<Settings className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />}
              title="Settings"
              subtitle="Saved data & preferences"
            />
            <QuickActionButton
              href="/contact"
              icon={<Heart className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />}
              title="Contact HR"
              subtitle="Update personal info"
            />
            <QuickActionButton
              href="/forms"
              icon={<CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />}
              title="Submit Forms"
              subtitle="DVIR, JSA, RTO & more"
            />
          </motion.div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
