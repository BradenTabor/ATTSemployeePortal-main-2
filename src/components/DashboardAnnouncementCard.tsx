import { motion } from "framer-motion";
import { memo } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLatestAnnouncementQuery } from "../hooks/queries/useAnnouncementsQuery";
import { getDeviceCapabilities } from "../lib/mobilePerf";
import { useAnnouncementTracking } from "../hooks/useAnnouncementTracking";

/**
 * DashboardAnnouncementCard - Ultra Premium announcement card for the dashboard
 * 
 * Performance optimizations:
 * - Uses React Query for caching and data fetching (no manual subscription)
 * - Animations are optimized for performance
 * - Respects reduced motion preferences
 * - Wrapped in memo to prevent unnecessary re-renders
 */
function DashboardAnnouncementCardComponent() {
  const { data: latestAnnouncement, isLoading } = useLatestAnnouncementQuery();
  const navigate = useNavigate();
  const caps = getDeviceCapabilities();

  // Telemetry: track when dashboard announcement becomes visible
  // Only create tracking ref if we have an announcement to track
  const trackingRef = useAnnouncementTracking(
    latestAnnouncement?.id || '',
    latestAnnouncement?.author === 'Safety AI',
    { source: 'dashboard' }
  );

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

  // Use date field if available, fall back to created_at
  const displayDate = latestAnnouncement.date || latestAnnouncement.created_at;
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;

  return (
    <motion.article
      ref={trackingRef}
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, type: "spring", stiffness: 100, damping: 18 }}
      whileHover={caps.prefersReducedMotion ? undefined : { y: -4 }}
      onClick={() => navigate("/announcements")}
      className="group relative overflow-hidden rounded-2xl md:rounded-[28px] border border-emerald-400/30 shadow-[0_8px_60px_-15px_rgba(16,185,129,0.4),0_4px_20px_-8px_rgba(0,0,0,0.5)] cursor-pointer"
      style={{
        background: 'linear-gradient(145deg, rgba(4, 30, 21, 0.98) 0%, rgba(2, 15, 10, 1) 50%, rgba(1, 8, 5, 1) 100%)',
      }}
    >
      {/* Outer glow border effect */}
      <div className="absolute -inset-[1px] rounded-[inherit] bg-gradient-to-br from-emerald-400/40 via-emerald-500/20 to-emerald-600/30 opacity-50 blur-[1px] pointer-events-none" />
      
      {/* Animated rotating gradient ring - only with animations */}
      {enableAnimations && (
        <motion.div
          className="absolute -inset-[2px] rounded-[inherit] opacity-40 pointer-events-none"
          style={{
            background: 'conic-gradient(from 0deg, transparent 0%, rgba(16, 185, 129, 0.5) 10%, transparent 25%, transparent 50%, rgba(52, 211, 153, 0.3) 60%, transparent 75%)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />
      )}
      
      {/* Inner container with solid bg */}
      <div 
        className="relative rounded-[inherit] overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(4, 30, 21, 0.99) 0%, rgba(2, 15, 10, 1) 50%, rgba(1, 8, 5, 1) 100%)',
        }}
      >
        {/* Premium top shine line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent" />
        
        {/* Floating orbs - only on desktop */}
        {enableAnimations && (
          <>
            <motion.div
              className="absolute w-48 h-48 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%)',
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
                background: 'radial-gradient(circle, rgba(52, 211, 153, 0.15) 0%, transparent 70%)',
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
              linear-gradient(rgba(16, 185, 129, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(16, 185, 129, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: '35px 35px',
          }}
        />
        
        {/* Corner accent decorations */}
        <div className="absolute top-2.5 right-2.5 w-12 h-12 pointer-events-none opacity-30">
          <div className="absolute top-0 right-0 w-6 h-[1px] bg-gradient-to-l from-emerald-400/70 to-transparent" />
          <div className="absolute top-0 right-0 w-[1px] h-6 bg-gradient-to-b from-emerald-400/70 to-transparent" />
        </div>
        <div className="absolute bottom-2.5 left-2.5 w-12 h-12 pointer-events-none opacity-30">
          <div className="absolute bottom-0 left-0 w-6 h-[1px] bg-gradient-to-r from-emerald-400/70 to-transparent" />
          <div className="absolute bottom-0 left-0 w-[1px] h-6 bg-gradient-to-t from-emerald-400/70 to-transparent" />
        </div>

        {/* Shine effect on hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

        {/* Content container */}
        <div className="relative p-4 sm:p-6">
          {/* Header row with badge */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
            <motion.div 
              className="relative"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
            >
              {/* Badge glow */}
              <div className="absolute -inset-1 rounded-full bg-emerald-400/25 blur-md" />
              <span className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-300/50 text-[10px] sm:text-xs font-bold tracking-[0.25em] text-emerald-100 bg-gradient-to-r from-emerald-500/25 via-emerald-400/15 to-emerald-500/25 shadow-lg shadow-emerald-500/15 backdrop-blur-sm">
                <motion.div
                  animate={enableAnimations ? { rotate: [0, 15, -15, 0] } : undefined}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-200" />
                </motion.div>
                LATEST
              </span>
            </motion.div>
            
            {/* Date with pulsing dot */}
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-emerald-200/50 font-medium">
              <div className="w-1 h-1 rounded-full bg-emerald-400/60 animate-pulse" />
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
              background: 'linear-gradient(135deg, #ffffff 0%, #d1fae5 50%, #a7f3d0 100%)',
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
            className="flex items-center justify-between pt-3 border-t border-emerald-400/15"
          >
            <div className="flex items-center gap-2.5">
              {/* Premium avatar with glow */}
              {latestAnnouncement.author && (
                <div className="relative">
                  <div className="absolute -inset-0.5 rounded-lg bg-gradient-to-br from-emerald-400/30 to-emerald-600/30 blur-sm" />
                  <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-300 via-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-300/25">
                    {latestAnnouncement.author.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium text-white/80 truncate max-w-[120px] sm:max-w-none">
                  {latestAnnouncement.author || "ATTS Leadership"}
                </p>
                <p className="text-[9px] sm:text-[10px] text-emerald-300/40 font-semibold tracking-[0.15em] uppercase">
                  Originator
                </p>
              </div>
            </div>
            
            {/* View more indicator */}
            <motion.div
              whileHover={caps.prefersReducedMotion ? undefined : { x: 3 }}
              className="flex items-center gap-1 text-emerald-300/60 font-medium text-xs opacity-0 group-hover:opacity-100 transition-all"
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

export default memo(DashboardAnnouncementCardComponent);
