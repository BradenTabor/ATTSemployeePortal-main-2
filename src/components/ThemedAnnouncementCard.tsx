import { motion } from "framer-motion";
import { memo } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLatestAnnouncementQuery } from "../hooks/queries/useAnnouncementsQuery";
import { getDeviceCapabilities } from "../lib/mobilePerf";

/**
 * Theme configuration for the announcement card
 */
type AnnouncementTheme = 'emerald' | 'bluewhite' | 'purple' | 'redwhite' | 'ember';

interface ThemeColors {
  // Border and glow colors
  borderColor: string;
  glowColor: string;
  glowRgba: string;
  
  // Background gradients
  bgGradient: string;
  innerBgGradient: string;
  
  // Accent colors
  accentColor: string;
  accentColorLight: string;
  accentColorDark: string;
  
  // Text colors
  textGradient: string;
  subtleText: string;
  
  // Badge colors
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  
  // Conic gradient for rotating ring
  conicGradient: string;
  
  // Grid pattern color
  gridColor: string;
}

const themeColors: Record<AnnouncementTheme, ThemeColors> = {
  emerald: {
    borderColor: 'border-emerald-400/30',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    glowRgba: 'rgba(16, 185, 129, 0.5)',
    bgGradient: 'linear-gradient(145deg, rgba(4, 30, 21, 0.98) 0%, rgba(2, 15, 10, 1) 50%, rgba(1, 8, 5, 1) 100%)',
    innerBgGradient: 'linear-gradient(145deg, rgba(4, 30, 21, 0.99) 0%, rgba(2, 15, 10, 1) 50%, rgba(1, 8, 5, 1) 100%)',
    accentColor: 'rgb(16, 185, 129)',
    accentColorLight: 'rgba(52, 211, 153, 0.3)',
    accentColorDark: 'rgba(16, 185, 129, 0.2)',
    textGradient: 'linear-gradient(135deg, #ffffff 0%, #d1fae5 50%, #a7f3d0 100%)',
    subtleText: 'text-emerald-200/50',
    badgeBg: 'from-emerald-500/25 via-emerald-400/15 to-emerald-500/25',
    badgeBorder: 'border-emerald-300/50',
    badgeText: 'text-emerald-100',
    conicGradient: 'conic-gradient(from 0deg, transparent 0%, rgba(16, 185, 129, 0.5) 10%, transparent 25%, transparent 50%, rgba(52, 211, 153, 0.3) 60%, transparent 75%)',
    gridColor: 'rgba(16, 185, 129, 0.5)',
  },
  bluewhite: {
    borderColor: 'border-blue-400/30',
    glowColor: 'rgba(59, 130, 246, 0.4)',
    glowRgba: 'rgba(59, 130, 246, 0.5)',
    bgGradient: 'linear-gradient(145deg, rgba(10, 22, 40, 0.98) 0%, rgba(2, 4, 8, 1) 50%, rgba(1, 3, 6, 1) 100%)',
    innerBgGradient: 'linear-gradient(145deg, rgba(10, 22, 40, 0.99) 0%, rgba(2, 4, 8, 1) 50%, rgba(1, 3, 6, 1) 100%)',
    accentColor: 'rgb(59, 130, 246)',
    accentColorLight: 'rgba(147, 197, 253, 0.3)',
    accentColorDark: 'rgba(59, 130, 246, 0.2)',
    textGradient: 'linear-gradient(135deg, #ffffff 0%, #bfdbfe 50%, #93c5fd 100%)',
    subtleText: 'text-blue-200/50',
    badgeBg: 'from-blue-500/25 via-blue-400/15 to-blue-500/25',
    badgeBorder: 'border-blue-300/50',
    badgeText: 'text-blue-100',
    conicGradient: 'conic-gradient(from 0deg, transparent 0%, rgba(59, 130, 246, 0.5) 10%, transparent 25%, transparent 50%, rgba(147, 197, 253, 0.3) 60%, transparent 75%)',
    gridColor: 'rgba(59, 130, 246, 0.5)',
  },
  purple: {
    borderColor: 'border-purple-400/30',
    glowColor: 'rgba(192, 132, 252, 0.4)',
    glowRgba: 'rgba(192, 132, 252, 0.5)',
    bgGradient: 'linear-gradient(145deg, rgba(25, 10, 40, 0.98) 0%, rgba(10, 2, 20, 1) 50%, rgba(5, 1, 10, 1) 100%)',
    innerBgGradient: 'linear-gradient(145deg, rgba(25, 10, 40, 0.99) 0%, rgba(10, 2, 20, 1) 50%, rgba(5, 1, 10, 1) 100%)',
    accentColor: 'rgb(192, 132, 252)',
    accentColorLight: 'rgba(216, 180, 254, 0.3)',
    accentColorDark: 'rgba(192, 132, 252, 0.2)',
    textGradient: 'linear-gradient(135deg, #ffffff 0%, #e9d5ff 50%, #d8b4fe 100%)',
    subtleText: 'text-purple-200/50',
    badgeBg: 'from-purple-500/25 via-purple-400/15 to-purple-500/25',
    badgeBorder: 'border-purple-300/50',
    badgeText: 'text-purple-100',
    conicGradient: 'conic-gradient(from 0deg, transparent 0%, rgba(192, 132, 252, 0.5) 10%, transparent 25%, transparent 50%, rgba(216, 180, 254, 0.3) 60%, transparent 75%)',
    gridColor: 'rgba(192, 132, 252, 0.5)',
  },
  redwhite: {
    borderColor: 'border-red-400/30',
    glowColor: 'rgba(239, 68, 68, 0.4)',
    glowRgba: 'rgba(239, 68, 68, 0.5)',
    bgGradient: 'linear-gradient(145deg, rgba(40, 10, 10, 0.98) 0%, rgba(15, 2, 2, 1) 50%, rgba(8, 1, 1, 1) 100%)',
    innerBgGradient: 'linear-gradient(145deg, rgba(40, 10, 10, 0.99) 0%, rgba(15, 2, 2, 1) 50%, rgba(8, 1, 1, 1) 100%)',
    accentColor: 'rgb(239, 68, 68)',
    accentColorLight: 'rgba(254, 202, 202, 0.3)',
    accentColorDark: 'rgba(239, 68, 68, 0.2)',
    textGradient: 'linear-gradient(135deg, #ffffff 0%, #fecaca 50%, #fca5a5 100%)',
    subtleText: 'text-red-200/50',
    badgeBg: 'from-red-500/25 via-red-400/15 to-red-500/25',
    badgeBorder: 'border-red-300/50',
    badgeText: 'text-red-100',
    conicGradient: 'conic-gradient(from 0deg, transparent 0%, rgba(239, 68, 68, 0.5) 10%, transparent 25%, transparent 50%, rgba(254, 202, 202, 0.3) 60%, transparent 75%)',
    gridColor: 'rgba(239, 68, 68, 0.5)',
  },
  ember: {
    borderColor: 'border-orange-400/30',
    glowColor: 'rgba(249, 115, 22, 0.4)',
    glowRgba: 'rgba(249, 115, 22, 0.5)',
    bgGradient: 'linear-gradient(145deg, rgba(40, 20, 5, 0.98) 0%, rgba(15, 8, 2, 1) 50%, rgba(8, 4, 1, 1) 100%)',
    innerBgGradient: 'linear-gradient(145deg, rgba(40, 20, 5, 0.99) 0%, rgba(15, 8, 2, 1) 50%, rgba(8, 4, 1, 1) 100%)',
    accentColor: 'rgb(249, 115, 22)',
    accentColorLight: 'rgba(255, 180, 138, 0.3)',
    accentColorDark: 'rgba(249, 115, 22, 0.2)',
    textGradient: 'linear-gradient(135deg, #ffffff 0%, #fed7aa 50%, #fdba74 100%)',
    subtleText: 'text-orange-200/50',
    badgeBg: 'from-orange-500/25 via-orange-400/15 to-orange-500/25',
    badgeBorder: 'border-orange-300/50',
    badgeText: 'text-orange-100',
    conicGradient: 'conic-gradient(from 0deg, transparent 0%, rgba(249, 115, 22, 0.5) 10%, transparent 25%, transparent 50%, rgba(255, 180, 138, 0.3) 60%, transparent 75%)',
    gridColor: 'rgba(249, 115, 22, 0.5)',
  },
};

interface ThemedAnnouncementCardProps {
  theme?: AnnouncementTheme;
}

/**
 * ThemedAnnouncementCard - Premium announcement card with theme support
 * 
 * Supports themes: emerald, bluewhite, purple, redwhite, ember
 */
function ThemedAnnouncementCardComponent({ theme = 'emerald' }: ThemedAnnouncementCardProps) {
  const { data: latestAnnouncement, isLoading } = useLatestAnnouncementQuery();
  const navigate = useNavigate();
  const caps = getDeviceCapabilities();
  const colors = themeColors[theme];

  if (isLoading || !latestAnnouncement) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();

    if (date.toDateString() === today.toDateString()) {
      return `Today, ${date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const displayDate = latestAnnouncement.date || latestAnnouncement.created_at;
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, type: "spring", stiffness: 100, damping: 18 }}
      whileHover={caps.prefersReducedMotion ? undefined : { y: -4 }}
      onClick={() => navigate("/announcements")}
      className={`group relative overflow-hidden rounded-2xl md:rounded-[28px] border ${colors.borderColor} cursor-pointer`}
      style={{
        background: colors.bgGradient,
        boxShadow: `0 8px 60px -15px ${colors.glowColor}, 0 4px 20px -8px rgba(0,0,0,0.5)`,
      }}
    >
      {/* Outer glow border effect */}
      <div 
        className="absolute -inset-[1px] rounded-[inherit] opacity-50 blur-[1px] pointer-events-none"
        style={{
          background: `linear-gradient(to bottom right, ${colors.glowRgba}, ${colors.accentColorDark}, ${colors.accentColorLight})`,
        }}
      />
      
      {/* Animated rotating gradient ring */}
      {enableAnimations && (
        <motion.div
          className="absolute -inset-[2px] rounded-[inherit] opacity-40 pointer-events-none"
          style={{ background: colors.conicGradient }}
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />
      )}
      
      {/* Inner container */}
      <div 
        className="relative rounded-[inherit] overflow-hidden"
        style={{ background: colors.innerBgGradient }}
      >
        {/* Premium top shine line */}
        <div 
          className="absolute top-0 left-0 right-0 h-[1px]"
          style={{
            background: `linear-gradient(to right, transparent, ${colors.accentColorLight}, transparent)`,
          }}
        />
        
        {/* Floating orbs - only on desktop */}
        {enableAnimations && (
          <>
            <motion.div
              className="absolute w-48 h-48 rounded-full pointer-events-none"
              style={{
                background: `radial-gradient(circle, ${colors.accentColorDark} 0%, transparent 70%)`,
                top: '-15%',
                left: '-10%',
                filter: 'blur(30px)',
              }}
              animate={{ 
                x: [0, 15, 0],
                y: [0, 10, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute w-36 h-36 rounded-full pointer-events-none"
              style={{
                background: `radial-gradient(circle, ${colors.accentColorLight} 0%, transparent 70%)`,
                bottom: '-10%',
                right: '-5%',
                filter: 'blur(25px)',
              }}
              animate={{ 
                x: [0, -10, 0],
                y: [0, -8, 0],
                scale: [1, 1.12, 1],
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            />
          </>
        )}
        
        {/* Grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(${colors.gridColor} 1px, transparent 1px),
              linear-gradient(90deg, ${colors.gridColor} 1px, transparent 1px)
            `,
            backgroundSize: '35px 35px',
          }}
        />
        
        {/* Corner accent decorations */}
        <div className="absolute top-2.5 right-2.5 w-12 h-12 pointer-events-none opacity-30">
          <div 
            className="absolute top-0 right-0 w-6 h-[1px]"
            style={{ background: `linear-gradient(to left, ${colors.accentColorLight}, transparent)` }}
          />
          <div 
            className="absolute top-0 right-0 w-[1px] h-6"
            style={{ background: `linear-gradient(to bottom, ${colors.accentColorLight}, transparent)` }}
          />
        </div>
        <div className="absolute bottom-2.5 left-2.5 w-12 h-12 pointer-events-none opacity-30">
          <div 
            className="absolute bottom-0 left-0 w-6 h-[1px]"
            style={{ background: `linear-gradient(to right, ${colors.accentColorLight}, transparent)` }}
          />
          <div 
            className="absolute bottom-0 left-0 w-[1px] h-6"
            style={{ background: `linear-gradient(to top, ${colors.accentColorLight}, transparent)` }}
          />
        </div>

        {/* Shine effect on hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

        {/* Announcement card overlay - in front of background, behind text, shifted down and scaled larger */}
        <img
          src="/assets/announcement-card-overlay.png"
          alt=""
          aria-hidden
          className="absolute -top-40 left-0 right-0 bottom-0 w-full h-full object-cover object-center object-top pointer-events-none opacity-90 scale-[1.8]"
        />

        {/* Content container */}
        <div className="relative p-4 sm:p-6 z-10">
          {/* Header row with badge */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
            <motion.div 
              className="relative"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
            >
              {/* Badge glow */}
              <div 
                className="absolute -inset-1 rounded-full blur-md"
                style={{ background: colors.accentColorDark }}
              />
              <span className={`relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${colors.badgeBorder} text-[10px] sm:text-xs font-bold tracking-[0.25em] ${colors.badgeText} bg-gradient-to-r ${colors.badgeBg} shadow-lg backdrop-blur-sm`}>
                <motion.div
                  animate={enableAnimations ? { rotate: [0, 15, -15, 0] } : undefined}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </motion.div>
                LATEST
              </span>
            </motion.div>
            
            {/* Date with pulsing dot */}
            <div className={`flex items-center gap-1.5 text-[10px] sm:text-xs ${colors.subtleText} font-medium`}>
              <div 
                className="w-1 h-1 rounded-full animate-pulse"
                style={{ background: colors.accentColor }}
              />
              {formatDate(displayDate)}
            </div>
          </div>

          {/* Title with gradient text */}
          <motion.h3
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg sm:text-xl md:text-2xl font-black leading-tight mb-2 line-clamp-2 group-hover:brightness-110 transition-all"
            style={{
              background: colors.textGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {latestAnnouncement.title}
          </motion.h3>
          
          {/* Preview with elegant typography */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-xs sm:text-sm text-white/60 leading-relaxed line-clamp-2 mb-4 font-light group-hover:text-white/70 transition-colors"
          >
            {latestAnnouncement.message}
          </motion.p>

          {/* Premium footer */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-between pt-3"
            style={{ borderTop: `1px solid ${colors.accentColorDark}` }}
          >
            <div className="flex items-center gap-2.5">
              {/* Premium avatar with glow */}
              {latestAnnouncement.author && (
                <div className="relative">
                  <div 
                    className="absolute -inset-0.5 rounded-lg blur-sm"
                    style={{ background: `linear-gradient(to bottom right, ${colors.accentColorLight}, ${colors.accentColorDark})` }}
                  />
                  <div 
                    className="relative w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-lg ring-1"
                    style={{
                      background: `linear-gradient(to bottom right, ${colors.accentColorLight}, ${colors.accentColor}, ${colors.accentColorDark})`,
                      boxShadow: `0 4px 14px ${colors.accentColorDark}`,
                    }}
                  >
                    {latestAnnouncement.author.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium text-white/80 truncate max-w-[120px] sm:max-w-none">
                  {latestAnnouncement.author || "ATTS Leadership"}
                </p>
                <p 
                  className="text-[9px] sm:text-[10px] font-semibold tracking-[0.15em] uppercase"
                  style={{ color: colors.accentColorLight }}
                >
                  Originator
                </p>
              </div>
            </div>
            
            {/* View more indicator */}
            <motion.div
              whileHover={caps.prefersReducedMotion ? undefined : { x: 3 }}
              className="flex items-center gap-1 font-medium text-xs opacity-0 group-hover:opacity-100 transition-all"
              style={{ color: colors.accentColorLight }}
            >
              <span className="hidden sm:inline">View</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.article>
  );
}

export const ThemedAnnouncementCard = memo(ThemedAnnouncementCardComponent);
export default ThemedAnnouncementCard;

