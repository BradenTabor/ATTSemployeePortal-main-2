import { motion, AnimatePresence } from "framer-motion";
import { memo, useState, useCallback } from "react";
import { 
  Megaphone, 
  ArrowRight, 
  Sparkles, 
  ChevronDown,
  Bell,
  Clock,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLatestAnnouncementQuery } from "../../hooks/queries/useAnnouncementsQuery";
import { getDeviceCapabilities } from "../../lib/mobilePerf";
import { useAnnouncementTracking } from "../../hooks/useAnnouncementTracking";
import { AnnouncementDetailModal } from "../AnnouncementDetailModal";
import { CollectPointsButton } from "../CollectPointsButton";
import { isRewardEligible } from "../../hooks/useAnnouncementRewards";

/**
 * FeaturedAnnouncementSection - Ultra Premium announcement section for dashboard hero area
 * 
 * Features:
 * - Prominent placement directly below header
 * - Luxurious glass-morphism design with emerald theme
 * - Animated entrance and micro-interactions
 * - Quick-view modal for full announcement
 * - Optimized for both mobile and desktop
 */
function FeaturedAnnouncementSectionComponent() {
  const { data: latestAnnouncement, isLoading } = useLatestAnnouncementQuery();
  const navigate = useNavigate();
  const caps = getDeviceCapabilities();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Telemetry tracking
  const trackingRef = useAnnouncementTracking(
    latestAnnouncement?.id || '',
    latestAnnouncement?.author === 'Safety AI',
    { source: 'featured_section' }
  );

  const handleViewAll = useCallback(() => {
    navigate("/announcements");
  }, [navigate]);

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today at ${date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })}`;
    }

    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })}`;
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
  }, []);

  const enableAnimations = !caps.prefersReducedMotion;

  // Loading state with elegant skeleton
  if (isLoading) {
    return (
      <div className="relative">
        {/* Section header skeleton */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 animate-pulse" />
            <div className="h-4 w-32 bg-white/10 rounded-full animate-pulse" />
          </div>
          <div className="h-3 w-16 bg-white/5 rounded-full animate-pulse" />
        </div>
        
        {/* Card skeleton */}
        <div className="rounded-2xl border border-emerald-400/20 bg-[#041b14]/80 p-5 space-y-4 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="h-5 w-16 bg-emerald-500/20 rounded-full" />
            <div className="h-3 w-24 bg-white/10 rounded-full" />
          </div>
          <div className="space-y-2">
            <div className="h-5 w-3/4 bg-white/10 rounded-lg" />
            <div className="h-3 w-full bg-white/5 rounded-full" />
            <div className="h-3 w-2/3 bg-white/5 rounded-full" />
          </div>
          <div className="flex justify-between items-center pt-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20" />
              <div className="h-3 w-20 bg-white/10 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No announcement state
  if (!latestAnnouncement) {
    return (
      <div className="relative">
        {/* Section header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-400/30 flex items-center justify-center">
              <Megaphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-white">Latest Update</span>
          </div>
        </div>

        {/* Empty state */}
        <div className="rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-[#041b14]/60 to-[#020f0a]/80 p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center">
            <Bell className="w-5 h-5 text-emerald-400/50" />
          </div>
          <p className="text-sm text-white/50">No announcements yet</p>
          <p className="text-xs text-emerald-400/40 mt-1">Check back later for updates</p>
        </div>
      </div>
    );
  }

  const displayDate = latestAnnouncement.date || latestAnnouncement.created_at;
  const messagePreview = latestAnnouncement.message.length > 120 
    ? `${latestAnnouncement.message.slice(0, 120)}...`
    : latestAnnouncement.message;

  return (
    <>
      <div className="relative">
        {/* Section Header - Premium Styling */}
        <motion.div 
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-between mb-3 px-1"
        >
          <div className="flex items-center gap-2.5">
            {/* Icon container with glow */}
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-emerald-400/25 blur-md" />
              <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-emerald-500/25 to-emerald-600/15 border border-emerald-400/40 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <Megaphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-300" />
              </div>
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white">Latest Update</h3>
              <p className="text-xs sm:text-[10px] text-emerald-400/50 font-medium">
                Stay informed
              </p>
            </div>
          </div>
          
          {/* View all link */}
          <motion.button
            onClick={handleViewAll}
            whileHover={enableAnimations ? { x: 2 } : undefined}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-1 text-xs font-medium text-emerald-400/70 hover:text-emerald-300 transition-colors group"
          >
            <span>View all</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </motion.button>
        </motion.div>

        {/* Main Announcement Card - Ultra Premium */}
        <motion.article
          ref={trackingRef}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ 
            duration: 0.5, 
            ease: [0.22, 1, 0.36, 1],
            delay: 0.05
          }}
          whileHover={enableAnimations ? { y: -3, scale: 1.005 } : undefined}
          onClick={handleOpenModal}
          className="group relative overflow-hidden rounded-2xl md:rounded-3xl cursor-pointer"
        >
          {/* Multi-layer glow system */}
          <div className="absolute -inset-[2px] rounded-[inherit] bg-gradient-to-br from-emerald-400/50 via-emerald-500/25 to-emerald-600/40 opacity-60 blur-sm pointer-events-none" />
          <div className="absolute -inset-[1px] rounded-[inherit] bg-gradient-to-br from-emerald-400/30 via-transparent to-emerald-500/30 pointer-events-none" />
          
          {/* Animated border glow on hover */}
          <motion.div
            className="absolute -inset-[2px] rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{
              background: 'conic-gradient(from 180deg, transparent 0%, rgba(16, 185, 129, 0.6) 10%, transparent 25%, transparent 50%, rgba(52, 211, 153, 0.4) 60%, transparent 75%)',
            }}
            animate={enableAnimations ? { rotate: 360 } : undefined}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          />

          {/* Inner card */}
          <div 
            className="relative rounded-[inherit] border border-emerald-400/30 overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, rgba(4, 32, 22, 0.98) 0%, rgba(2, 18, 12, 1) 50%, rgba(1, 10, 6, 1) 100%)',
              boxShadow: '0 8px 50px -12px rgba(16, 185, 129, 0.35), 0 4px 25px -8px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255,255,255,0.03)',
            }}
          >
            {/* Top shine line */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent" />
            
            {/* Ambient lighting orbs */}
            {enableAnimations && (
              <>
                <motion.div
                  className="absolute w-40 h-40 rounded-full pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, transparent 70%)',
                    top: '-20%',
                    left: '-8%',
                    filter: 'blur(25px)',
                  }}
                  animate={{ 
                    x: [0, 12, 0],
                    y: [0, 8, 0],
                    scale: [1, 1.08, 1],
                  }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                  className="absolute w-32 h-32 rounded-full pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle, rgba(52, 211, 153, 0.12) 0%, transparent 70%)',
                    bottom: '-12%',
                    right: '-5%',
                    filter: 'blur(20px)',
                  }}
                  animate={{ 
                    x: [0, -8, 0],
                    y: [0, -6, 0],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                />
              </>
            )}
            
            {/* Subtle grid pattern */}
            <div 
              className="absolute inset-0 opacity-[0.015] pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(16, 185, 129, 0.6) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(16, 185, 129, 0.6) 1px, transparent 1px)
                `,
                backgroundSize: '32px 32px',
              }}
            />
            
            {/* Corner accents */}
            <div className="absolute top-3 right-3 w-10 h-10 pointer-events-none opacity-35">
              <div className="absolute top-0 right-0 w-5 h-[1px] bg-gradient-to-l from-emerald-400/80 to-transparent" />
              <div className="absolute top-0 right-0 w-[1px] h-5 bg-gradient-to-b from-emerald-400/80 to-transparent" />
            </div>
            <div className="absolute bottom-3 left-3 w-10 h-10 pointer-events-none opacity-35">
              <div className="absolute bottom-0 left-0 w-5 h-[1px] bg-gradient-to-r from-emerald-400/80 to-transparent" />
              <div className="absolute bottom-0 left-0 w-[1px] h-5 bg-gradient-to-t from-emerald-400/80 to-transparent" />
            </div>

            {/* Hover shine sweep */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />

            {/* Content */}
            <div className="relative p-4 sm:p-5">
              {/* Header row */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
                {/* Badge */}
                <motion.div 
                  className="relative"
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 15 }}
                >
                  <div className="absolute -inset-1 rounded-full bg-emerald-400/30 blur-md" />
                  <span className="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-300/50 text-[9px] sm:text-[10px] font-bold tracking-[0.2em] text-emerald-100 bg-gradient-to-r from-emerald-500/30 via-emerald-400/20 to-emerald-500/30 shadow-lg shadow-emerald-500/20 backdrop-blur-sm">
                    <motion.div
                      animate={enableAnimations ? { rotate: [0, 12, -12, 0] } : undefined}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-200" />
                    </motion.div>
                    NEW
                  </span>
                </motion.div>
                
                {/* Time indicator */}
                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-emerald-300/50 font-medium">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(displayDate)}</span>
                </div>
              </div>

              {/* Title */}
              <motion.h4
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="text-base sm:text-lg md:text-xl font-black leading-tight mb-2 line-clamp-2 group-hover:brightness-110 transition-all"
                style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #d1fae5 40%, #a7f3d0 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {latestAnnouncement.title}
              </motion.h4>
              
              {/* Preview text */}
              <AnimatePresence mode="wait">
                <motion.p
                  key={isExpanded ? 'expanded' : 'collapsed'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`text-xs sm:text-sm text-white/55 leading-relaxed font-light group-hover:text-white/65 transition-colors ${
                    isExpanded ? '' : 'line-clamp-2'
                  }`}
                >
                  {isExpanded ? latestAnnouncement.message : messagePreview}
                </motion.p>
              </AnimatePresence>

              {/* Expand toggle for long messages */}
              {latestAnnouncement.message.length > 120 && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                  className="flex items-center gap-1 mt-2 text-[10px] sm:text-xs font-medium text-emerald-400/60 hover:text-emerald-300 transition-colors"
                >
                  <span>{isExpanded ? 'Show less' : 'Read more'}</span>
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-3 h-3" />
                  </motion.div>
                </motion.button>
              )}

              {/* Footer */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="flex items-center justify-between pt-3 mt-3 border-t border-emerald-500/15"
              >
                {/* Author */}
                <div className="flex items-center gap-2.5">
                  {latestAnnouncement.author && (
                    <div className="relative">
                      <div className="absolute -inset-0.5 rounded-lg bg-gradient-to-br from-emerald-400/35 to-emerald-600/35 blur-sm" />
                      <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-emerald-300 via-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-[10px] sm:text-xs shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-300/25">
                        {latestAnnouncement.author.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] sm:text-xs font-medium text-white/75 truncate max-w-[100px] sm:max-w-[140px]">
                      {latestAnnouncement.author || "ATTS Leadership"}
                    </p>
                    <div className="flex items-center gap-1 text-[8px] sm:text-[9px] text-emerald-400/40 font-semibold tracking-wider uppercase">
                      <User className="w-2.5 h-2.5" />
                      <span>Originator</span>
                    </div>
                  </div>
                </div>
                
                {/* Action area - Collect Points for Safety AI, or Tap to read */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {isRewardEligible(latestAnnouncement.author) ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.35, type: "spring", stiffness: 200, damping: 18 }}
                    >
                      <CollectPointsButton
                        announcementId={latestAnnouncement.id}
                        author={latestAnnouncement.author}
                        compact
                        isClaimable={true}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      whileHover={enableAnimations ? { x: 3 } : undefined}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500/15 group-hover:border-emerald-400/30 transition-all"
                    >
                      <span className="text-[10px] sm:text-xs font-medium text-emerald-300/70 group-hover:text-emerald-200 transition-colors">
                        Tap to read
                      </span>
                      <ArrowRight className="w-3 h-3 text-emerald-400/60 group-hover:text-emerald-300 group-hover:translate-x-0.5 transition-all" />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </motion.article>
      </div>

      {/* Detail Modal */}
      <AnnouncementDetailModal
        announcement={latestAnnouncement}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        formatDate={formatDate}
      />
    </>
  );
}

export const FeaturedAnnouncementSection = memo(FeaturedAnnouncementSectionComponent);
export default FeaturedAnnouncementSection;
