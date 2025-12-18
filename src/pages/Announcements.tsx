import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { subscribeToTableChanges } from "../lib/realtime";
import { PaginationControls } from "../components/PaginationControls";
import {
  RefreshCcw,
  Clock,
  Sparkles,
  Bell,
  ChevronRight,
  Megaphone,
  Activity,
  Radio,
  Search,
  Signal,
  Lightbulb,
  Zap,
  Users,
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import AdminPremiumScaffold, {
  type AdminHeroConfig,
  type AdminStat,
} from "../components/admin/AdminPremiumScaffold";
import { ExpandableSection } from "../components/dashboard/ExpandableSection";
import { DashboardAvatar } from "../components/dashboard/DashboardAvatar";
import CardListSkeleton from "../components/skeletons/CardListSkeleton";
import { cn } from "../lib/utils";

interface Announcement {
  id: string;
  title: string;
  message: string;
  author: string | null;
  date: string;
  created_at: string;
}

// Skeleton for featured announcement
const FeaturedAnnouncementSkeleton = () => (
  <div className="rounded-[28px] border border-emerald-500/20 bg-black/40 backdrop-blur-2xl h-64 relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent animate-pulse" />
    <div className="p-6 sm:p-10 space-y-4">
      <div className="h-6 w-32 bg-emerald-500/20 rounded-full animate-pulse" />
      <div className="h-10 w-3/4 bg-white/10 rounded-lg animate-pulse" />
      <div className="h-4 w-full bg-white/5 rounded animate-pulse" />
      <div className="h-4 w-2/3 bg-white/5 rounded animate-pulse" />
    </div>
  </div>
);

// Skeleton for loading state
const AnnouncementsSkeleton = () => (
  <div className="space-y-6">
    <FeaturedAnnouncementSkeleton />
    <CardListSkeleton rows={4} variant="emerald" />
  </div>
);

// Empty state component
const EmptyState = ({ searchTerm, onClearFilter }: { searchTerm: string; onClearFilter: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-16 text-center rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-lg space-y-4"
  >
    <div className="p-4 rounded-full bg-emerald-500/10 border border-emerald-400/20">
      <Megaphone className="w-10 h-10 text-emerald-300" />
    </div>
    <h3 className="text-2xl font-semibold text-white">All quiet for now</h3>
    <p className="text-sm text-white/70 max-w-md">
      {searchTerm
        ? `No announcements match "${searchTerm}". Try adjusting your keywords or clearing the filter.`
        : "As soon as leadership posts a new broadcast, it will appear here automatically. Stay tuned for safety alerts, payroll notices, and project wins."}
    </p>
    {searchTerm && (
      <button
        type="button"
        onClick={onClearFilter}
        className="px-4 py-2 rounded-2xl border border-white/20 text-white/80 text-sm hover:border-white/40 transition-colors"
      >
        Clear filter
      </button>
    )}
  </motion.div>
);

// Featured announcement card
interface FeaturedAnnouncementProps {
  announcement: Announcement;
  formatDate: (date: string) => string;
}

const FeaturedAnnouncementCard = ({ announcement, formatDate }: FeaturedAnnouncementProps) => (
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
            {formatDate(announcement.created_at)}
          </span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-4">
          {announcement.title}
        </h2>
        <p className="text-base sm:text-lg text-white/80 leading-relaxed whitespace-pre-wrap">
          {announcement.message}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/10">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
              {announcement.author ? announcement.author.charAt(0) : "A"}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {announcement.author || "ATTS Leadership"}
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
            {formatDate(announcement.created_at)}
          </div>
          <div className="flex items-center gap-3 text-sm text-white/70">
            <Bell className="w-4 h-4 text-emerald-300" />
            Auto pushed to dashboard + mobile
          </div>
        </div>
      </div>
    </div>
  </motion.article>
);

// Announcement card for the feed
interface AnnouncementCardProps {
  announcement: Announcement;
  index: number;
  formatDate: (date: string) => string;
}

const AnnouncementCard = ({ announcement, index, formatDate }: AnnouncementCardProps) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 25 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -25 }}
    transition={{ delay: index * 0.07, duration: 0.35, ease: "easeOut" }}
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
);

// Search bar component
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  visibleCount: number;
  totalCount: number;
}

const SearchBar = ({ value, onChange, onClear, visibleCount, totalCount }: SearchBarProps) => (
  <div className="space-y-4">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3 text-white/70 text-sm">
        <Radio className="w-5 h-5 text-emerald-300" />
        Precision filters let you zero in on any broadcast.
      </div>
      <div className="flex items-center gap-2 text-xs text-white/50">
        <Signal className="w-4 h-4 text-emerald-300" />
        Signal strength · {visibleCount ? "Excellent" : "Idle"}
      </div>
    </div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search announcements by title, message, or author..."
          className="w-full rounded-2xl bg-black/50 border border-white/10 pl-11 pr-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 outline-none transition"
        />
      </div>
      {value && (
        <button
          type="button"
          onClick={onClear}
          className="px-4 py-3 rounded-2xl border border-white/10 text-white/70 text-sm hover:text-white hover:border-white/30 transition"
        >
          Clear filter
        </button>
      )}
    </div>
    <div className="flex items-center gap-2 text-xs text-white/60">
      <Sparkles className="w-4 h-4 text-emerald-300" />
      Showing <span className="text-white font-semibold">{visibleCount}</span> of {totalCount} announcements
    </div>
  </div>
);

// Side panel components
interface LiveStatusCardProps {
  hasNewAnnouncement: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}

const LiveStatusCard = ({ hasNewAnnouncement, refreshing, onRefresh }: LiveStatusCardProps) => (
  <div className="rounded-3xl border border-white/10 bg-[#03150f]/80 p-5 space-y-4">
    <div className="flex items-center gap-2">
      <Activity className="w-4 h-4 text-emerald-400" />
      <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">
        Live Status
      </p>
    </div>
    
    <div className="space-y-3">
      <motion.div
        key={`status-${hasNewAnnouncement}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-semibold tracking-wide w-full justify-center",
          hasNewAnnouncement
            ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
            : "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
        )}
      >
        <span
          className={cn(
            "w-2 h-2 rounded-full",
            hasNewAnnouncement ? "bg-amber-300 animate-pulse" : "bg-emerald-300"
          )}
        />
        {hasNewAnnouncement ? "New Broadcast!" : "Live Synced"}
      </motion.div>

      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-500/20 border border-emerald-400/40 disabled:opacity-50 group"
      >
        <RefreshCcw
          className={cn(
            "w-4 h-4",
            refreshing ? "animate-spin" : "group-hover:rotate-180 transition-transform"
          )}
        />
        {refreshing ? "Syncing..." : "Sync Feed"}
      </button>

      <p className="text-xs text-white/50 text-center">
        Powered by Supabase Realtime
      </p>
    </div>
  </div>
);

const QuickTipsCard = () => (
  <div className="rounded-3xl border border-white/10 bg-[#03150f]/80 p-5 space-y-4">
    <div className="flex items-center gap-2">
      <Lightbulb className="w-4 h-4 text-amber-400" />
      <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">
        Quick Tips
      </p>
    </div>
    
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center flex-shrink-0">
          <Zap className="w-3 h-3 text-emerald-300" />
        </div>
        <p className="text-xs text-white/60 leading-relaxed">
          Updates appear automatically - no refresh needed.
        </p>
      </div>
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center flex-shrink-0">
          <Search className="w-3 h-3 text-emerald-300" />
        </div>
        <p className="text-xs text-white/60 leading-relaxed">
          Search by title, message, or author name.
        </p>
      </div>
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center flex-shrink-0">
          <Users className="w-3 h-3 text-emerald-300" />
        </div>
        <p className="text-xs text-white/60 leading-relaxed">
          All broadcasts are company-wide from leadership.
        </p>
      </div>
    </div>
  </div>
);

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newAnnouncementIndicator, setNewAnnouncementIndicator] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination State
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

  // Get paginated announcements (excluding the first/featured one)
  const latestAnnouncement = filteredAnnouncements[0] || null;
  const restAnnouncements = filteredAnnouncements.slice(1);

  const paginatedAnnouncements = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return restAnnouncements.slice(start, end);
  }, [restAnnouncements, currentPage, pageSize]);

  // Fetch helper
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
  }, [announcements.length]);

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

  // Initial load + realtime subscription
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

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Hero config
  const heroConfig = useMemo<AdminHeroConfig>(
    () => ({
      eyebrow: "Company Signals",
      eyebrowIcon: <Megaphone className="w-4 h-4" />,
      heading: "Company Announcements",
      description:
        "Broadcasts from leadership, safety, and operations. Updated in real time with no refresh required.",
    }),
    []
  );

  // Hero stats - keeping minimal for cleaner layout
  const heroStats = useMemo<AdminStat[]>(
    () => [
      {
        label: "Last Updated",
        value: latestAnnouncement ? formatDate(latestAnnouncement.created_at).split(" at ")[0] : "—",
        hint: latestAnnouncement ? formatDate(latestAnnouncement.created_at).split(" at ")[1] || "" : "No updates",
      },
    ],
    [latestAnnouncement]
  );

  // Side panel content
  const sidePanelContent = (
    <div className="space-y-6">
      <LiveStatusCard
        hasNewAnnouncement={newAnnouncementIndicator}
        refreshing={refreshing}
        onRefresh={handleManualRefresh}
      />
      <QuickTipsCard />
    </div>
  );

  return (
    <DashboardLayout title="Announcements">
      <AdminPremiumScaffold
        hero={heroConfig}
        stats={heroStats}
        theme="emerald"
        sidePanel={sidePanelContent}
      >
        <div className="w-full space-y-4 md:space-y-6">
          {/* Search & Filters Section */}
          <ExpandableSection
            id="announcements-search"
            title="Search & Filters"
            subtitle="Find broadcasts quickly"
            icon={<DashboardAvatar variant="tools" className="w-8 h-8 md:w-10 md:h-10" />}
            storageKey="announcements-search-expanded"
            defaultOpen={true}
          >
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              onClear={() => setSearchTerm("")}
              visibleCount={visibleAnnouncements}
              totalCount={totalAnnouncements}
            />
          </ExpandableSection>

          {/* Content sections */}
          {loading ? (
            <AnnouncementsSkeleton />
          ) : visibleAnnouncements === 0 ? (
            <EmptyState searchTerm={searchTerm} onClearFilter={() => setSearchTerm("")} />
          ) : (
            <>
              {/* Featured Announcement Section */}
              {latestAnnouncement && (
                <ExpandableSection
                  id="announcements-featured"
                  title="Latest Signal"
                  subtitle={latestAnnouncement.title}
                  icon={<DashboardAvatar variant="announcements" className="w-8 h-8 md:w-10 md:h-10" />}
                  storageKey="announcements-featured-expanded"
                  defaultOpen={true}
                >
                  <FeaturedAnnouncementCard
                    announcement={latestAnnouncement}
                    formatDate={formatDate}
                  />
                </ExpandableSection>
              )}

              {/* Previous Updates Section */}
              {restAnnouncements.length > 0 && (
                <ExpandableSection
                  id="announcements-feed"
                  title="Previous Updates"
                  subtitle={`${restAnnouncements.length} earlier broadcast${restAnnouncements.length !== 1 ? "s" : ""}`}
                  icon={<DashboardAvatar variant="jobs" className="w-8 h-8 md:w-10 md:h-10" />}
                  storageKey="announcements-feed-expanded"
                  defaultOpen={true}
                >
                  <div className="space-y-6">
                    <motion.div
                      layout
                      className="grid grid-cols-1 md:grid-cols-2 gap-5"
                    >
                      <AnimatePresence mode="popLayout">
                        {paginatedAnnouncements.map((announcement, idx) => (
                          <AnnouncementCard
                            key={announcement.id}
                            announcement={announcement}
                            index={idx}
                            formatDate={formatDate}
                          />
                        ))}
                      </AnimatePresence>
                    </motion.div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
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
                      </div>
                    )}
                  </div>
                </ExpandableSection>
              )}
            </>
          )}
        </div>
      </AdminPremiumScaffold>
    </DashboardLayout>
  );
}
