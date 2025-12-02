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
  ShieldCheck,
  Activity,
  Radio,
  Search,
  Signal,
} from "lucide-react";
import { AuroraBackground } from "../components/AuroraBackground";
import CardListSkeleton from "../components/skeletons/CardListSkeleton";
import logo from "../assets/ATTS_Logo-removebg-preview.png";

interface Announcement {
  id: string;
  title: string;
  message: string;
  author: string | null;
  date: string;
  created_at: string;
}

const AnnouncementsSkeleton = () => (
  <div className="space-y-6">
    <div className="rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-2xl h-64 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
    </div>
    <CardListSkeleton rows={4} variant="emerald" />
  </div>
);

export default function Announcements() {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newAnnouncementIndicator, setNewAnnouncementIndicator] =
    useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // 🔢 Pagination State
  const pageSize = 8;
  const [currentPage, setCurrentPage] = useState(1);
  const totalAnnouncements = announcements.length;

  const filteredAnnouncements = useMemo(() => {
    if (!searchTerm.trim()) return announcements;
    const query = searchTerm.trim().toLowerCase();
    return announcements.filter((announcement) => {
      const haystack = `${announcement.title} ${announcement.message} ${announcement.author ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [announcements, searchTerm]);

  const visibleAnnouncements = filteredAnnouncements.length;
  const totalPages = Math.max(1, Math.ceil(visibleAnnouncements / pageSize));

  // Get paginated announcements
  const paginatedAnnouncements = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredAnnouncements.slice(start, end);
  }, [filteredAnnouncements, currentPage, pageSize]);

  const latestAnnouncement = filteredAnnouncements[0] || null;
  const restAnnouncements = filteredAnnouncements.slice(1);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <AuroraBackground className="min-h-screen flex flex-col py-8 px-4 sm:px-6">
      <div className="w-full max-w-6xl mx-auto flex-1">
        {/* ===== NAVIGATION HEADER ===== */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-8"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-medium text-sm transition-all backdrop-blur-xl border border-white/10 hover:border-white/30 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Dashboard
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-white/40">
              <span>Home</span>
              <span className="w-6 h-px bg-white/10" />
              <span className="text-white">Announcements</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <motion.div
              key={`indicator-${newAnnouncementIndicator}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-semibold tracking-[0.3em] backdrop-blur-xl"
              style={{
                borderColor: newAnnouncementIndicator ? "#fbbf24" : "rgba(16,185,129,0.5)",
                backgroundColor: newAnnouncementIndicator ? "rgba(251,191,36,0.15)" : "rgba(16,185,129,0.15)",
                color: newAnnouncementIndicator ? "#fcd34d" : "#6ee7b7",
              }}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  newAnnouncementIndicator ? "bg-amber-300 animate-pulse" : "bg-emerald-300"
                }`}
              />
              {newAnnouncementIndicator ? "New Broadcast" : "Live Synced"}
            </motion.div>

            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-500/20 border border-emerald-400/40 disabled:opacity-50 group"
            >
              <RefreshCcw
                className={`w-4 h-4 ${
                  refreshing ? "animate-spin" : "group-hover:rotate-180 transition-transform"
                }`}
              />
              {refreshing ? "Syncing..." : "Sync Feed"}
            </button>
          </div>
        </motion.div>

        {/* ===== HERO HEADER ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-12"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between mb-8">
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0.7, rotate: -15, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.2, type: "spring" }}
                className="p-3 rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/20 via-black/40 to-emerald-900/20 shadow-lg shadow-emerald-500/20"
              >
                <img
                  src={logo}
                  alt="ATTS"
                  className="w-16 h-16 object-contain opacity-90"
                />
              </motion.div>
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-emerald-200/80">
                  Company Signals
                </p>
                <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                  Announcements
                </h1>
                <p className="text-white/70 text-sm mt-2 max-w-sm">
                  Broadcasts from leadership, safety, and operations. Updated in real time with no
                  refresh required.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-xs tracking-[0.4em] text-white/60">
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                Verified feed
              </div>
              <div className="inline-flex items-center gap-3 text-white/70 text-sm">
                <Activity className="w-4 h-4 text-emerald-300" />
                Auto-refresh enabled • Powered by Supabase Realtime
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-5 shadow-lg shadow-emerald-500/5"
            >
              <p className="text-xs uppercase tracking-[0.4em] text-white/40 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-300" />
                Total
              </p>
              <div className="mt-3 text-4xl font-black text-white">{totalAnnouncements}</div>
              <p className="text-xs text-white/60 mt-1">Active broadcasts</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-5 shadow-lg shadow-emerald-500/5"
            >
              <p className="text-xs uppercase tracking-[0.4em] text-white/40 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-300" />
                Visible
              </p>
              <div className="mt-3 text-lg font-semibold text-white line-clamp-1">
                {latestAnnouncement?.title || "No announcement"}
              </div>
              <p className="text-xs text-white/60 mt-1">
                Showing {visibleAnnouncements} of {totalAnnouncements}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-5 shadow-lg shadow-emerald-500/5"
            >
              <p className="text-xs uppercase tracking-[0.4em] text-white/40 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-300" />
                Updated
              </p>
              <div className="mt-3 text-base font-semibold text-white">
                {latestAnnouncement ? formatDate(latestAnnouncement.created_at) : "—"}
              </div>
              <p className="text-xs text-white/60 mt-1">Timestamp of last addition</p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mt-8 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-2xl p-5 flex flex-col gap-4"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3 text-white/70 text-sm">
                <Radio className="w-5 h-5 text-emerald-300" />
                Precision filters let you zero in on any broadcast.
              </div>
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Signal className="w-4 h-4 text-emerald-300" />
                Signal strength · {visibleAnnouncements ? "Excellent" : "Idle"}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search announcements by title, message, or author..."
                  className="w-full rounded-2xl bg-white/5 border border-white/10 pl-11 pr-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 outline-none transition"
                />
              </div>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="px-4 py-3 rounded-2xl border border-white/10 text-white/70 text-sm hover:text-white hover:border-white/30 transition"
                >
                  Clear filter
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>

        {/* ===== LOADING STATE ===== */}
        {loading ? (
          <AnnouncementsSkeleton />
        ) : visibleAnnouncements === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-28 text-center rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-lg space-y-4"
          >
            <div className="p-4 rounded-full bg-emerald-500/10 border border-emerald-400/20">
              <Megaphone className="w-10 h-10 text-emerald-300" />
            </div>
            <h3 className="text-2xl font-semibold text-white">All quiet for now</h3>
            <p className="text-sm text-white/70 max-w-md">
              {searchTerm
                ? `No announcements match “${searchTerm}”. Try adjusting your keywords or clearing the filter.`
                : "As soon as leadership posts a new broadcast, it will appear here automatically. Stay tuned for safety alerts, payroll notices, and project wins."}
            </p>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="px-4 py-2 rounded-2xl border border-white/20 text-white/80 text-sm hover:border-white/40"
              >
                Clear filter
              </button>
            )}
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
              <motion.article
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, type: "spring", stiffness: 120, damping: 18 }}
                className="relative overflow-hidden rounded-[28px] border border-emerald-500/30 bg-black/40 backdrop-blur-2xl shadow-2xl"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/20 via-transparent to-emerald-400/10" />
                <motion.div
                  className="absolute inset-0 opacity-40"
                  style={{
                    background:
                      "radial-gradient(circle at 20% 20%, rgba(16,185,129,0.4), transparent 55%)",
                  }}
                  animate={{ rotate: [0, 4, -2, 0], scale: [1, 1.05, 1] }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                />

                <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] p-6 sm:p-10">
                  <div>
                    <div className="flex items-center gap-3 mb-5">
                      <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-400/40 text-xs font-semibold tracking-[0.3em] text-emerald-200 bg-emerald-500/10">
                        <Sparkles className="w-3.5 h-3.5" />
                        LATEST SIGNAL
                      </span>
                      <span className="text-xs text-white/60">
                        {formatDate(latestAnnouncement.created_at)}
                      </span>
                    </div>

                    <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-4">
                      {latestAnnouncement.title}
                    </h2>
                    <p className="text-base sm:text-lg text-white/80 leading-relaxed whitespace-pre-wrap">
                      {latestAnnouncement.message}
                    </p>

                    <div className="mt-8 flex flex-wrap gap-3">
                      <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/10">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                          {latestAnnouncement.author ? latestAnnouncement.author.charAt(0) : "A"}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {latestAnnouncement.author || "ATTS Leadership"}
                          </p>
                          <p className="text-xs text-white/60">Originator</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-white/70 text-xs">
                        <Megaphone className="w-4 h-4 text-emerald-300" />
                        Broadcast channel: Company-wide
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6 flex flex-col gap-5">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-sm text-white/70">
                        <Clock className="w-4 h-4 text-emerald-300" />
                        {formatDate(latestAnnouncement.created_at)}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-white/70">
                        <Bell className="w-4 h-4 text-emerald-300" />
                        Auto pushed to dashboard + mobile
                      </div>
                    </div>
                  </div>
                </div>
              </motion.article>
            )}

            {/* ===== ANNOUNCEMENTS FEED ===== */}
            {restAnnouncements.length > 0 && (
              <div>
                <motion.h3
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-lg font-bold text-white/90 mb-6 flex items-center gap-2"
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
                        initial={{ opacity: 0, y: 25 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -25 }}
                        transition={{ delay: idx * 0.07, duration: 0.35, ease: "easeOut" }}
                        whileHover={{ y: -6 }}
                        className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-lg shadow-black/30"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative p-5 sm:p-6 flex flex-col gap-4 h-full">
                          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.4em] text-white/40">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                            Update
                            <span className="text-white/50">
                              {new Date(announcement.created_at).toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>

                          <h3 className="text-lg font-semibold text-white leading-tight line-clamp-2 group-hover:text-emerald-200 transition-colors">
                            {announcement.title}
                          </h3>
                          <p className="text-sm text-white/70 leading-relaxed line-clamp-3">
                            {announcement.message}
                          </p>

                          <div className="mt-auto flex items-center justify-between pt-4 border-t border-white/10">
                            <div className="flex items-center gap-2 text-xs text-white/50">
                              {announcement.author && (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                                  {announcement.author.charAt(0)}
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-white/80">
                                  {announcement.author || "ATTS"}
                                </p>
                                <p>{formatDate(announcement.created_at)}</p>
                              </div>
                            </div>
                            <motion.div
                              whileHover={{ x: 3 }}
                              className="flex items-center gap-1 text-emerald-300 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Open
                              <ChevronRight className="w-4 h-4" />
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
                    className="mt-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4"
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