import { motion, AnimatePresence } from "framer-motion";
import { memo, useState, useCallback } from "react";
import { Megaphone, ArrowUpRight, Sparkles, ChevronDown, Bell, Clock, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLatestAnnouncementQuery } from "../../hooks/queries/useAnnouncementsQuery";
import { getDeviceCapabilities } from "../../lib/mobilePerf";
import { useAnnouncementTracking } from "../../hooks/useAnnouncementTracking";
import { AnnouncementDetailModal } from "../AnnouncementDetailModal";
import { CollectPointsButton } from "../CollectPointsButton";
import { isRewardEligible } from "../../hooks/useAnnouncementRewards";
import { canopy } from "../../lib/glass";
import { Eyebrow } from "../canopy/Eyebrow";
import { EASE_CANOPY } from "../../motion/presets";

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

  const header = (
    <div className="mb-3 flex items-center justify-between gap-3 px-1">
      <Eyebrow tone="verdant" rule={false}>
        <span className="inline-flex items-center gap-2">
          <Megaphone className="h-3 w-3" aria-hidden />
          Broadcast · latest
        </span>
      </Eyebrow>
      <button
        type="button"
        onClick={handleViewAll}
        className="tap-44 group relative inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-bone-300 transition-colors hover:text-verdant-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-verdant-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 rounded"
      >
        View all
        <ArrowUpRight className="h-3 w-3 transition-transform duration-300 ease-canopy group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
      </button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="relative">
        {header}
        <div className={`${canopy.instrument} animate-pulse p-5 sm:p-6`} aria-busy>
          <div className="flex items-center gap-2">
            <div className="h-5 w-14 rounded-full bg-verdant-500/20" />
            <div className="h-3 w-28 rounded bg-bone-50/[0.08]" />
          </div>
          <div className="mt-4 h-7 w-3/4 rounded bg-bone-50/[0.1]" />
          <div className="mt-3 h-3 w-full rounded bg-bone-50/[0.06]" />
          <div className="mt-2 h-3 w-2/3 rounded bg-bone-50/[0.06]" />
        </div>
      </div>
    );
  }

  if (!latestAnnouncement) {
    return (
      <div className="relative">
        {header}
        <div className={`${canopy.instrument} p-8 text-center`}>
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-leaf-xs border border-bone-50/[0.1] bg-ink-950/70">
            <Bell className="h-5 w-5 text-bone-400" aria-hidden />
          </span>
          <p className="type-display text-lg text-bone-200">Quiet canopy</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-bone-500">No announcements yet</p>
        </div>
      </div>
    );
  }

  const displayDate = latestAnnouncement.date || latestAnnouncement.created_at;
  const isLong = latestAnnouncement.message.length > 160;
  const messagePreview = isLong ? `${latestAnnouncement.message.slice(0, 160)}…` : latestAnnouncement.message;
  const author = latestAnnouncement.author || 'ATTS Leadership';

  return (
    <>
      <div className="relative">
        {header}

        <motion.article
          ref={trackingRef}
          initial={enableAnimations ? { opacity: 0, y: 16, filter: 'blur(8px)' } : false}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, ease: EASE_CANOPY, delay: 0.05 }}
          onClick={handleOpenModal}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleOpenModal();
            }
          }}
          aria-label={`Open announcement: ${latestAnnouncement.title}`}
          className={`${canopy.instrument} group cursor-pointer transition-[border-color,transform] duration-500 ease-canopy hover:-translate-y-0.5 hover:border-verdant-400/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-verdant-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950`}
        >
          {/* Bloom */}
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-24 h-56 w-56 rounded-full bg-verdant-400/20 blur-3xl transition-opacity duration-700 group-hover:opacity-80"
          />
          {/* Sheen sweep */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(105deg,transparent_35%,rgba(244,247,242,0.06)_50%,transparent_65%)] transition-transform duration-[1400ms] ease-canopy group-hover:translate-x-full"
          />

          <div className="relative p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={canopy.pillLive}>
                <Sparkles className="h-3 w-3" aria-hidden />
                <span className="font-mono text-[10px] uppercase tracking-[0.18em]">New</span>
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-bone-400">
                <Clock className="h-3 w-3" aria-hidden />
                {formatDate(displayDate)}
              </span>
            </div>

            <h4 className="type-display mt-4 text-balance text-[1.5rem] leading-[1.05] text-bone-50 sm:text-[1.9rem] md:text-[2.2rem]">
              {latestAnnouncement.title}
            </h4>

            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={isExpanded ? 'expanded' : 'collapsed'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className={`mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-bone-300 sm:text-[15px] ${isExpanded ? '' : 'line-clamp-2'}`}
              >
                {isExpanded ? latestAnnouncement.message : messagePreview}
              </motion.p>
            </AnimatePresence>

            {isLong && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded((v) => !v);
                }}
                className="tap-44 relative mt-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-verdant-300/80 transition-colors hover:text-verdant-200"
              >
                {isExpanded ? 'Show less' : 'Read more'}
                <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.3 }} className="flex">
                  <ChevronDown className="h-3 w-3" aria-hidden />
                </motion.span>
              </button>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-bone-50/[0.08] pt-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-leaf-xs bg-[linear-gradient(135deg,#8DF5A8,#1F7A44)] font-display text-xs font-semibold text-ink-950">
                  {author.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-bone-100">{author}</span>
                  <span className="mt-0.5 flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.18em] text-bone-500">
                    <User className="h-2.5 w-2.5" aria-hidden />
                    Originator
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {isRewardEligible(latestAnnouncement.author) ? (
                  <CollectPointsButton
                    announcementId={latestAnnouncement.id}
                    author={latestAnnouncement.author}
                    compact
                    isClaimable={true}
                  />
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-bone-300 transition-colors group-hover:text-verdant-200">
                    Read
                    <ArrowUpRight className="h-3 w-3 transition-transform duration-300 ease-canopy group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bottom vein */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-5 bottom-0 h-px origin-left scale-x-0 bg-[linear-gradient(90deg,#3DDC84,#B8FF7A)] transition-transform duration-700 ease-canopy group-hover:scale-x-100 sm:inset-x-6"
          />
        </motion.article>
      </div>

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
