import { motion } from "framer-motion";
import { memo } from "react";
import { ArrowRight, Megaphone, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/ATTS_Logo-removebg-preview.png";
import { useLatestAnnouncementQuery } from "../hooks/queries/useAnnouncementsQuery";
import { getDeviceCapabilities } from "../lib/mobilePerf";

/**
 * DashboardAnnouncementCard - Displays the latest announcement on the dashboard
 * 
 * Performance optimizations:
 * - Uses React Query for caching and data fetching (no manual subscription)
 * - Animations are hover-triggered only (no continuous infinite animations)
 * - Respects reduced motion preferences
 * - Wrapped in memo to prevent unnecessary re-renders
 */
function DashboardAnnouncementCardComponent() {
  const { data: latestAnnouncement, isLoading } = useLatestAnnouncementQuery();
  const navigate = useNavigate();
  const caps = getDeviceCapabilities();

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
    });
  };

  // Use date field if available, fall back to created_at
  const displayDate = latestAnnouncement.date || latestAnnouncement.created_at;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      whileHover={caps.prefersReducedMotion ? undefined : { y: -6 }}
      onClick={() => navigate("/announcements")}
      className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600/20 via-emerald-500/5 to-transparent border-2 border-emerald-500/30 backdrop-blur-md shadow-xl hover:shadow-2xl hover:shadow-emerald-500/20 hover:border-emerald-500/50 transition-all cursor-pointer"
    >
      {/* Animated background - only visible and animated on hover */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-emerald-400/10 via-transparent to-emerald-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ 
          backgroundSize: "200% 200%",
          // CSS animation only runs when visible (on hover) - no JS overhead
          animation: caps.prefersReducedMotion ? 'none' : undefined,
        }}
      />

      {/* Shine effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

      {/* Subtle ATTS logo watermark */}
      <div className="absolute top-4 right-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
        <img src={logo} alt="" loading="lazy" className="w-12 h-12 object-contain" />
      </div>

      <div className="relative p-6 sm:p-8 shadow-[inset_0px_4px_35px_18px_rgba(0,0,0,0.35)] backdrop-blur-[100px]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="p-2.5 bg-emerald-500/20 rounded-xl border border-emerald-500/40 flex-shrink-0"
          >
            <Megaphone className="w-5 h-5 text-emerald-300" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center justify-center gap-1.5 rounded-full"
            style={{
              width: '65px',
              height: '32px',
              background: 'linear-gradient(90deg, rgba(102, 67, 5, 0.2) 21%, rgba(175, 146, 4, 1) 100%)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'rgba(168, 107, 0, 0.4)',
              color: 'rgb(255, 255, 255)',
              fontSize: '15px',
              fontWeight: 600,
              lineHeight: '15px',
              textAlign: 'center',
            }}
          >
            <Sparkles className="w-3 h-3" />
            NEW
          </motion.div>
        </div>

        {/* Title */}
        <motion.h3
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-xl sm:text-2xl font-black text-white mb-2 line-clamp-2 group-hover:text-emerald-100 transition-colors"
        >
          {latestAnnouncement.title}
        </motion.h3>

        {/* Preview */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-sm text-gray-200 line-clamp-2 mb-4 group-hover:text-white transition-colors"
        >
          {latestAnnouncement.message}
        </motion.p>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex items-center justify-between pt-4 border-t border-emerald-500/20"
        >
          <div className="flex items-center gap-2">
            {latestAnnouncement.author && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                {latestAnnouncement.author.charAt(0)}
              </div>
            )}
            <p className="text-xs text-gray-400">
              {formatDate(displayDate)}
            </p>
          </div>
          <motion.div
            whileHover={caps.prefersReducedMotion ? undefined : { x: 4 }}
            className="flex items-center gap-1.5 text-emerald-300 font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity"
          >
            View <ArrowRight className="w-4 h-4" />
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default memo(DashboardAnnouncementCardComponent);
