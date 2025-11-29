import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { subscribeToTableChanges } from "../lib/realtime";
import { PaginationControls } from "../components/PaginationControls";
import {
  RefreshCcw,
  ArrowLeft,
  Clock,
  Sparkles,
  TrendingUp,
  Bell,
  ChevronRight,
  Megaphone,
} from "lucide-react";
import { AuroraBackground } from "../components/AuroraBackground";
import logo from "../assets/ATTS_Logo-removebg-preview.png";

interface Announcement {
  id: string;
  title: string;
  message: string;
  author: string | null;
  date: string;
  created_at: string;
}

export default function Announcements() {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newAnnouncementIndicator, setNewAnnouncementIndicator] =
    useState(false);

  // 🔢 Pagination State
  const pageSize = 8;
  const [currentPage, setCurrentPage] = useState(1);
  const totalAnnouncements = announcements.length;
  const totalPages = Math.max(1, Math.ceil(totalAnnouncements / pageSize));

  // Get paginated announcements
  const paginatedAnnouncements = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return announcements.slice(start, end);
  }, [announcements, currentPage, pageSize]);

  const latestAnnouncement = announcements[0] || null;
  const restAnnouncements = announcements.slice(1);

  // 📥 Fetch helper
  const fetchAnnouncements = useCallback(async (showSpinner: boolean = true) => {
    if (showSpinner) setLoading(true);

    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching announcements:", error);
      } else {
        const newData = (data || []) as Announcement[];
        if (
          announcements.length > 0 &&
          newData.length > announcements.length
        ) {
          setNewAnnouncementIndicator(true);
          setTimeout(() => setNewAnnouncementIndicator(false), 5000);
        }
        setAnnouncements(newData);
      }
    } catch (err) {
      console.error("Error loading announcements:", err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [announcements. length]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch(
        "https://hook.us2.make.com/dlb3kmbn4615q14lcw6dhheif7602ph2",
        { method: "POST" }
      );
      await fetchAnnouncements(false);
    } catch (err) {
      console.error("Error refreshing announcements:", err);
    }
    setRefreshing(false);
  };

  // 🔁 Initial load + realtime subscription
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (cancelled) return;
      await fetchAnnouncements(true);
    };

    load();

    const unsubscribe = subscribeToTableChanges({
      channelName: "announcements-realtime",
      table: "announcements",
      onInsert: () => {
        if (!cancelled) {
          setNewAnnouncementIndicator(true);
          fetchAnnouncements(false);
          setTimeout(() => setNewAnnouncementIndicator(false), 5000);
        }
      },
      onUpdate: () => {
        if (!cancelled) fetchAnnouncements(false);
      },
      onDelete: () => {
        if (!cancelled) fetchAnnouncements(false);
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [fetchAnnouncements]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today at ${date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${date.toLocaleTimeString("en-US", {
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

  return (
    <AuroraBackground className="min-h-screen flex flex-col py-8 px-4 sm:px-6">
      <div className="w-full max-w-6xl mx-auto flex-1">
        {/* ===== NAVIGATION HEADER ===== */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between mb-8"
        >
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-all backdrop-blur-md border border-white/20 hover:border-white/40 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back
          </button>

          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-500/80 text-white font-medium text-sm transition-all backdrop-blur-md border border-emerald-500/30 disabled:opacity-50 group"
          >
            <RefreshCcw
              className={`w-4 h-4 ${
                refreshing ? "animate-spin" : "group-hover:rotate-180 transition-transform"
              }`}
            />
            {refreshing ? "Syncing..." : "Sync"}
          </button>
        </motion.div>

        {/* ===== HERO HEADER ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-12"
        >
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-4 mb-3">
                {/* Subtle ATTS logo */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ duration: 0.6, delay: 0.2, type: "spring" }}
                  className="p-2 bg-gradient-to-br from-emerald-600/20 to-emerald-500/10 rounded-2xl border border-emerald-500/30"
                >
                  <img
                    src={logo}
                    alt="ATTS"
                    className="w-16 h-16 object-contain opacity-90"
                  />
                </motion.div>
              </div>
            </div>
            <div>
              <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                Announcements
              </h1>
              <p className="text-emerald-300/80 text-sm mt-1 font-medium">
                Stay informed with the latest updates
              </p>
            </div>
            {/* Real-time indicator */}
            <motion.div
              key={`indicator-${newAnnouncementIndicator}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/40 rounded-full text-sm text-amber-300 font-medium backdrop-blur-sm"
            >
              {newAnnouncementIndicator ?  (
                <>
                  <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  New announcement! 
                </>
              ) : (
                <>
                  <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                  Live & synced
                </>
              )}
            </motion.div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-4"
            >
              <div className="text-gray-400 text-xs font-medium">Total</div>
              <div className="text-2xl font-bold text-white mt-1">
                {totalAnnouncements}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-4"
            >
              <div className="text-emerald-400 text-xs font-medium flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Latest
              </div>
              <div className="text-base font-bold text-white mt-1 truncate">
                {latestAnnouncement?.title. slice(0, 15)}... 
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-4 col-span-2 sm:col-span-1"
            >
              <div className="text-gray-400 text-xs font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" /> Updated
              </div>
              <div className="text-sm font-medium text-white mt-1">
                {latestAnnouncement
                  ? formatDate(latestAnnouncement.created_at)
                  : "—"}
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* ===== LOADING STATE ===== */}
        {loading ?  (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-32"
          >
            <div className="relative w-16 h-16 mb-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0"
              >
                <div className="w-full h-full rounded-full border-4 border-transparent border-t-emerald-400 border-r-emerald-400/50" />
              </motion.div>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-2 flex items-center justify-center"
              >
                <p className="text-emerald-400 font-medium">Loading announcements...</p>
              </motion.div>
            </div>
          </motion.div>
        ) : announcements.length === 0 ?  (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-32 text-center"
          >
            <div className="p-4 bg-gray-600/10 rounded-full mb-6">
              <Megaphone className="w-12 h-12 text-gray-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              No Announcements Yet
            </h3>
            <p className="text-gray-400 max-w-xs">
              Check back soon! New announcements will appear here automatically.
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.05, delayChildren: 0.1 }}
            className="space-y-6"
          >
            {/* ===== FEATURED ANNOUNCEMENT (HERO) ===== */}
            {latestAnnouncement && (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: 0.6,
                  ease: "easeOut",
                  type: "spring",
                  stiffness: 100,
                  damping: 15,
                }}
                whileHover={{ y: -8 }}
                className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600/30 via-emerald-500/10 to-transparent border-2 border-emerald-500/40 backdrop-blur-md shadow-2xl"
              >
                {/* Animated background gradient */}
                <motion.div
                  animate={{
                    backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
                  }}
                  transition={{ duration: 8, repeat: Infinity }}
                  className="absolute inset-0 bg-gradient-to-br from-emerald-400/10 via-transparent to-emerald-600/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundSize: "200% 200%" }}
                />

                {/* Shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                <div className="relative p-8 sm:p-10">
                  {/* Badge */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/40 rounded-full text-xs font-bold text-emerald-300 mb-4 backdrop-blur-sm"
                  >
                    <Sparkles className="w-3 h-3" />
                    LATEST
                  </motion.div>

                  {/* Title */}
                  <motion.h2
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className="text-3xl sm:text-4xl font-black text-white mb-3 leading-tight group-hover:text-emerald-200 transition-colors"
                  >
                    {latestAnnouncement.title}
                  </motion.h2>

                  {/* Message */}
                  <motion. p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-gray-200 text-base sm:text-lg leading-relaxed mb-6 max-w-2xl group-hover:text-white/90 transition-colors whitespace-pre-wrap"
                  >
                    {latestAnnouncement. message}
                  </motion. p>

                  {/* Footer */}
                  <motion. div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-6 border-t border-emerald-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                        {latestAnnouncement.author
                          ? latestAnnouncement.author.charAt(0)
                          : "A"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-emerald-200">
                          {latestAnnouncement.author || "ATTS"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDate(latestAnnouncement.created_at)}
                        </p>
                      </div>
                    </div>
                    <motion.div
                      whileHover={{ x: 4 }}
                      className="flex items-center gap-2 text-emerald-300 font-medium text-sm"
                    >
                      Read now <ChevronRight className="w-4 h-4" />
                    </motion.div>
                  </motion.div>
                </div>
              </motion. div>
            )}

            {/* ===== ANNOUNCEMENTS FEED ===== */}
            {restAnnouncements.length > 0 && (
              <div>
                <motion.h3
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-lg font-bold text-white/80 mb-6 flex items-center gap-2"
                >
                  <Bell className="w-4 h-4 text-emerald-400" />
                  Previous Updates
                </motion.h3>

                <motion.div
                  layout
                  className="grid grid-cols-1 md:grid-cols-2 gap-5"
                >
                  <AnimatePresence mode="popLayout">
                    {paginatedAnnouncements.map((announcement, idx) => (
                      <motion.div
                        key={announcement.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{
                          delay: idx * 0.08,
                          duration: 0.4,
                          ease: "easeOut",
                        }}
                        whileHover={{ y: -4, scale: 1.02 }}
                        className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 backdrop-blur-md hover:border-emerald-500/40 transition-all shadow-lg hover:shadow-2xl hover:shadow-emerald-500/10"
                      >
                        {/* Hover gradient */}
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                        {/* Subtle logo in corner */}
                        <div className="absolute top-3 right-3 opacity-5 group-hover:opacity-10 transition-opacity">
                          <img
                            src={logo}
                            alt=""
                            className="w-6 h-6 object-contain"
                          />
                        </div>

                        {/* Content */}
                        <div className="relative p-5 sm:p-6">
                          {/* Title */}
                          <h3 className="text-base sm:text-lg font-bold text-white mb-2 line-clamp-2 group-hover:text-emerald-200 transition-colors">
                            {announcement.title}
                          </h3>

                          {/* Message preview */}
                          <p className="text-sm text-gray-300 line-clamp-3 mb-4 leading-relaxed group-hover:text-gray-200 transition-colors">
                            {announcement.message}
                          </p>

                          {/* Footer */}
                          <div className="flex items-center justify-between pt-4 border-t border-white/10">
                            <div className="flex items-center gap-2">
                              {announcement.author && (
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400/60 to-emerald-600/60 flex items-center justify-center text-white font-bold text-xs">
                                  {announcement. author.charAt(0)}
                                </div>
                              )}
                              <p className="text-xs text-gray-400">
                                {formatDate(announcement.created_at)}
                              </p>
                            </div>
                            <motion.div
                              whileHover={{ x: 2 }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <ChevronRight className="w-4 h-4 text-emerald-400" />
                            </motion.div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>

                {/* ===== PAGINATION ===== */}
                {totalPages > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mt-8"
                  >
                    <PaginationControls
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={restAnnouncements.length}
                      loading={loading}
                      pageSize={pageSize}
                      onPreviousClick={() =>
                        setCurrentPage((prev) => Math.max(1, prev - 1))
                      }
                      onNextClick={() =>
                        setCurrentPage((prev) =>
                          Math.min(totalPages, prev + 1)
                        )
                      }
                      label="announcements"
                    />
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </AuroraBackground>
  );
}