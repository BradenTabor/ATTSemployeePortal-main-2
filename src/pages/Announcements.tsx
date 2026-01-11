import { useEffect, useState, useCallback, useMemo, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { subscribeToTableChanges } from "../lib/realtime";
import { PaginationControls } from "../components/PaginationControls";
import {
  RefreshCcw,
  Sparkles,
  ChevronRight,
  Megaphone,
  Search,
  Signal,
  Calendar,
  Expand,
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import { ExpandableSection } from "../components/dashboard/ExpandableSection";
import { DashboardAvatar } from "../components/dashboard/DashboardAvatar";
import CardListSkeleton from "../components/skeletons/CardListSkeleton";
import { cn } from "../lib/utils";
import { TextEffect } from "../components/ui/TextEffect";
import { getDeviceCapabilities } from "../lib/mobilePerf";
import { CollectPointsButton } from "../components/CollectPointsButton";
import { AnnouncementDetailModal } from "../components/AnnouncementDetailModal";

interface Announcement {
  id: string;
  title: string;
  message: string;
  author: string | null;
  date: string;
  created_at: string;
}

// Skeleton for featured announcement - compact design
const FeaturedAnnouncementSkeleton = () => (
  <div 
    className="rounded-2xl md:rounded-3xl border border-emerald-500/20 relative overflow-hidden"
    style={{
      background: 'radial-gradient(ellipse at 30% 20%, rgba(5, 77, 53, 0.4) 0%, rgba(3, 18, 12, 0.95) 70%)',
    }}
  >
    <div className="p-4 sm:p-6 md:p-8 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-6 w-20 bg-emerald-500/20 rounded-full animate-pulse" />
        <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
      </div>
      <div className="h-8 w-3/4 bg-white/10 rounded-lg animate-pulse" />
      <div className="space-y-2">
        <div className="h-4 w-full bg-white/5 rounded animate-pulse" />
        <div className="h-4 w-2/3 bg-white/5 rounded animate-pulse" />
      </div>
      <div className="pt-4 border-t border-emerald-500/10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 animate-pulse" />
        <div className="space-y-1.5">
          <div className="h-3 w-24 bg-white/10 rounded animate-pulse" />
          <div className="h-2 w-16 bg-white/5 rounded animate-pulse" />
        </div>
      </div>
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

// Empty state component - compact premium design
const EmptyState = ({ searchTerm, onClearFilter }: { searchTerm: string; onClearFilter: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-10 sm:py-12 text-center rounded-2xl border border-emerald-500/20"
    style={{
      background: 'linear-gradient(135deg, rgba(4, 21, 15, 0.9) 0%, rgba(2, 13, 9, 0.95) 100%)',
    }}
  >
    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-400/25 mb-4">
      <Megaphone className="w-8 h-8 text-emerald-300/70" />
    </div>
    <h3 className="text-xl font-bold text-white mb-2">All quiet for now</h3>
    <p className="text-xs sm:text-sm text-white/60 max-w-sm px-4">
      {searchTerm
        ? `No announcements match "${searchTerm}". Try adjusting your keywords.`
        : "New broadcasts from leadership will appear here automatically."}
    </p>
    {searchTerm && (
      <button
        type="button"
        onClick={onClearFilter}
        className="mt-4 px-4 py-2 rounded-xl border border-emerald-500/30 text-emerald-300/80 text-xs font-medium hover:border-emerald-400/50 hover:text-emerald-200 transition-colors"
      >
        Clear filter
      </button>
    )}
  </motion.div>
);

// Featured announcement card - Ultra Premium design
interface FeaturedAnnouncementProps {
  announcement: Announcement;
  formatDate: (date: string) => string;
  onClick?: () => void;
}

const FeaturedAnnouncementCard = ({ announcement, formatDate, onClick }: FeaturedAnnouncementProps) => (
  <motion.article
    layout
    initial={{ opacity: 0, y: 20, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.6, type: "spring", stiffness: 100, damping: 18 }}
    whileHover={{ y: -4 }}
    whileTap={{ scale: 0.995 }}
    onClick={onClick}
    className="relative overflow-hidden rounded-2xl md:rounded-[28px] border border-emerald-400/30 shadow-[0_8px_80px_-20px_rgba(16,185,129,0.5),0_4px_24px_-8px_rgba(0,0,0,0.6)] cursor-pointer group/featured"
    style={{
      background: 'linear-gradient(145deg, rgba(4, 30, 21, 0.98) 0%, rgba(2, 15, 10, 1) 50%, rgba(1, 8, 5, 1) 100%)',
    }}
  >
    {/* Outer glow border effect */}
    <div className="absolute -inset-[1px] rounded-[inherit] bg-gradient-to-br from-emerald-400/40 via-emerald-500/20 to-emerald-600/30 opacity-60 blur-[1px] pointer-events-none" />
    
    {/* Animated rotating gradient ring */}
    <motion.div
      className="absolute -inset-[2px] rounded-[inherit] opacity-50 pointer-events-none"
      style={{
        background: 'conic-gradient(from 0deg, transparent 0%, rgba(16, 185, 129, 0.6) 10%, transparent 25%, transparent 50%, rgba(52, 211, 153, 0.4) 60%, transparent 75%)',
      }}
      animate={{ rotate: 360 }}
      transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
    />
    
    {/* Inner container with solid bg to contain content */}
    <div 
      className="relative rounded-[inherit] overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, rgba(4, 30, 21, 0.99) 0%, rgba(2, 15, 10, 1) 50%, rgba(1, 8, 5, 1) 100%)',
      }}
    >
      {/* Premium top shine line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent" />
      
      {/* Floating orbs - decorative ambient lighting */}
      <motion.div
        className="absolute w-64 h-64 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, transparent 70%)',
          top: '-20%',
          left: '-10%',
          filter: 'blur(40px)',
        }}
        animate={{ 
          x: [0, 20, 0],
          y: [0, 15, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-48 h-48 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(52, 211, 153, 0.2) 0%, transparent 70%)',
          bottom: '-15%',
          right: '-5%',
          filter: 'blur(35px)',
        }}
        animate={{ 
          x: [0, -15, 0],
          y: [0, -10, 0],
          scale: [1, 1.15, 1],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      
      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(16, 185, 129, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16, 185, 129, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />
      
      {/* Corner accent decorations */}
      <div className="absolute top-3 right-3 w-16 h-16 pointer-events-none opacity-40">
        <div className="absolute top-0 right-0 w-8 h-[1px] bg-gradient-to-l from-emerald-400/80 to-transparent" />
        <div className="absolute top-0 right-0 w-[1px] h-8 bg-gradient-to-b from-emerald-400/80 to-transparent" />
      </div>
      <div className="absolute bottom-3 left-3 w-16 h-16 pointer-events-none opacity-40">
        <div className="absolute bottom-0 left-0 w-8 h-[1px] bg-gradient-to-r from-emerald-400/80 to-transparent" />
        <div className="absolute bottom-0 left-0 w-[1px] h-8 bg-gradient-to-t from-emerald-400/80 to-transparent" />
      </div>

      {/* Content container */}
      <div className="relative p-5 sm:p-7 md:p-9">
        {/* Header row with premium badge */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-5">
          <motion.div 
            className="relative"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
          >
            {/* Badge glow */}
            <div className="absolute -inset-1 rounded-full bg-emerald-400/30 blur-md" />
            <span className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-300/50 text-[10px] sm:text-xs font-bold tracking-[0.3em] text-emerald-100 bg-gradient-to-r from-emerald-500/30 via-emerald-400/20 to-emerald-500/30 shadow-lg shadow-emerald-500/20 backdrop-blur-sm">
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-200" />
              </motion.div>
              LATEST SIGNAL
            </span>
          </motion.div>
          
          {/* Date with subtle styling */}
          <div className="flex items-center gap-2 text-xs sm:text-sm text-emerald-200/60 font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 animate-pulse" />
            {formatDate(announcement.created_at)}
          </div>
        </div>

        {/* Title with gradient text effect */}
        <motion.h2 
          className="text-2xl sm:text-3xl md:text-4xl font-black leading-tight mb-4 tracking-tight"
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #d1fae5 50%, #a7f3d0 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          {announcement.title}
        </motion.h2>
        
        {/* Message with elegant typography */}
        <motion.p 
          className="text-sm sm:text-base md:text-lg text-white/70 leading-relaxed whitespace-pre-wrap line-clamp-5 sm:line-clamp-none font-light"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {announcement.message}
        </motion.p>

        {/* Mobile tap hint - only shows when content might be truncated */}
        <motion.div 
          className="flex sm:hidden items-center justify-center gap-2 mt-3 py-2 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 opacity-70 group-hover/featured:opacity-100 transition-opacity"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ delay: 0.4 }}
        >
          <Expand className="w-3.5 h-3.5 text-emerald-300" />
          <span className="text-[11px] text-emerald-200/80 font-medium tracking-wide">Tap to read full message</span>
        </motion.div>

        {/* Premium author footer */}
        <motion.div 
          className="mt-6 pt-5 border-t border-emerald-400/15"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-4">
            {/* Premium avatar with glow */}
            <div className="relative">
              <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-emerald-400/40 to-emerald-600/40 blur-sm" />
              <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-emerald-300 via-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-xl shadow-emerald-500/30 ring-2 ring-emerald-300/30">
                {announcement.author ? announcement.author.charAt(0).toUpperCase() : "A"}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm sm:text-base font-semibold text-white truncate">
                {announcement.author || "ATTS Leadership"}
              </p>
              <p className="text-[10px] sm:text-xs text-emerald-300/50 font-bold tracking-[0.2em] uppercase mt-0.5">
                Originator
              </p>
            </div>
            {/* Collect Points Button - Only shows for Safety AI announcements */}
            <CollectPointsButton 
              announcementId={announcement.id}
              author={announcement.author}
              className="hidden sm:flex"
            />
            {/* Decorative signal indicator - hidden when rewards button shows */}
            {announcement.author !== "Safety AI" && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex gap-0.5">
                  <div className="w-1 h-3 rounded-full bg-emerald-400/60" />
                  <div className="w-1 h-4 rounded-full bg-emerald-400/80" />
                  <div className="w-1 h-5 rounded-full bg-emerald-400" />
                </div>
                <span className="text-[10px] text-emerald-300/60 font-medium tracking-wide">LIVE</span>
              </div>
            )}
          </div>
          {/* Mobile rewards button - shows below author info */}
          <div className="mt-4 sm:hidden">
            <CollectPointsButton 
              announcementId={announcement.id}
              author={announcement.author}
            />
          </div>
        </motion.div>
      </div>
    </div>
  </motion.article>
);

// Announcement card for the feed - Premium compact design
interface AnnouncementCardProps {
  announcement: Announcement;
  index: number;
  formatDate: (date: string) => string;
  onClick?: () => void;
}

const AnnouncementCard = forwardRef<HTMLDivElement, AnnouncementCardProps>(
  ({ announcement, index, formatDate, onClick }, ref) => (
  <motion.div
    ref={ref}
    layout
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -16, transition: { duration: 0.2 } }}
    transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" }}
    whileHover={{ y: -4, transition: { duration: 0.2 } }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="group relative overflow-hidden rounded-2xl border border-emerald-500/20 hover:border-emerald-400/40 transition-colors duration-300 cursor-pointer"
    style={{
      background: 'linear-gradient(135deg, rgba(4, 21, 15, 0.9) 0%, rgba(2, 13, 9, 0.95) 100%)',
    }}
  >
    {/* Subtle top glow line */}
    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    
    {/* Hover glow effect */}
    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/8 via-transparent to-emerald-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    
    <div className="relative p-4 flex flex-col gap-3 h-full">
      {/* Header with timestamp */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-emerald-300/50 font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
          Update
        </div>
        <span className="text-[10px] text-white/40 tabular-nums">
          {new Date(announcement.created_at).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-base font-bold text-white leading-snug line-clamp-2 group-hover:text-emerald-100 transition-colors">
        {announcement.title}
      </h3>
      
      {/* Message - more compact */}
      <p className="text-xs sm:text-sm text-white/60 leading-relaxed line-clamp-2">
        {announcement.message}
      </p>

      {/* Footer - compact author section */}
      <div className="mt-auto flex items-center justify-between pt-3 border-t border-emerald-500/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-emerald-500/20">
            {(announcement.author || "A").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-white/80 truncate">
              {announcement.author || "ATTS"}
            </p>
            <p className="text-[10px] text-emerald-300/40">{formatDate(announcement.created_at)}</p>
          </div>
        </div>
        <motion.div
          whileHover={{ x: 2 }}
          className="flex items-center gap-0.5 text-emerald-300/70 text-xs font-semibold sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        >
          <span className="hidden sm:inline">View</span>
          <span className="sm:hidden text-[10px]">Read</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </motion.div>
      </div>
    </div>
  </motion.div>
));

AnnouncementCard.displayName = "AnnouncementCard";

// Search bar component - compact premium design
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  visibleCount: number;
  totalCount: number;
}

const SearchBar = ({ value, onChange, onClear, visibleCount, totalCount }: SearchBarProps) => (
  <div className="space-y-3">
    {/* Search input row */}
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-300/50" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search by title, message, or author..."
          className="w-full rounded-xl bg-[#020d09] border border-emerald-500/20 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/30 outline-none transition"
        />
      </div>
      {value && (
        <button
          type="button"
          onClick={onClear}
          className="px-3 py-2.5 rounded-xl border border-emerald-500/20 text-emerald-300/70 text-xs font-medium hover:text-emerald-200 hover:border-emerald-400/40 transition whitespace-nowrap"
        >
          Clear
        </button>
      )}
    </div>
    
    {/* Stats row - compact */}
    <div className="flex items-center justify-between gap-3 text-[10px] sm:text-xs">
      <div className="flex items-center gap-1.5 text-emerald-300/50">
        <Sparkles className="w-3 h-3" />
        <span><span className="text-white font-medium">{visibleCount}</span> of {totalCount}</span>
      </div>
      <div className="flex items-center gap-1.5 text-white/40">
        <Signal className="w-3 h-3 text-emerald-400/60" />
        <span>{visibleCount ? "Live" : "Idle"}</span>
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
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

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

  // Parse latest date for compact display
  const latestDateInfo = useMemo(() => {
    if (!latestAnnouncement) return { date: "—", time: "" };
    const parts = formatDate(latestAnnouncement.created_at).split(" at ");
    return { date: parts[0] || "—", time: parts[1] || "" };
  }, [latestAnnouncement]);

  // Hero config - compact with inline badge
  // Device capabilities for animation decisions
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;

  return (
    <DashboardLayout title="Announcements">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-4 pt-4 sm:pt-6">
        {/* Premium Glass Header - Emerald Theme */}
        <div className="mb-5 md:mb-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div 
              className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
              style={{
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                background: 'linear-gradient(145deg, rgba(4, 30, 21, 0.6) 0%, rgba(2, 15, 10, 0.5) 50%, rgba(1, 8, 5, 0.4) 100%)',
                boxShadow: 'inset 0 0 15px rgba(125, 225, 180, 0.05), 0 8px 32px rgba(0,0,0,0.4)',
              }}
            >
              <div className="absolute inset-0 opacity-70 pointer-events-none" style={{ background: 'linear-gradient(125deg, rgba(255,255,255,0.15) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.05) 100%)' }} />
              <div className="absolute inset-0 opacity-50 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 50%)' }} />
              <div className="absolute top-0 left-0 w-24 h-24 rounded-full opacity-30 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(125,225,180,0.3) 0%, transparent 70%)', filter: 'blur(15px)' }} />
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />
              <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-gradient-to-b from-transparent via-white/[0.1] to-transparent" />
              <div className="absolute top-0 bottom-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-black/[0.1] to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/[0.15] to-transparent" />

              <div className="relative px-5 py-4 md:px-7 md:py-5">
                <div className="flex items-center gap-3 mb-3">
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.2 }} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
                    <Megaphone className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-200">Company Signals</span>
                  </motion.div>
                  {latestAnnouncement && (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.3 }} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#03150f]/60 border border-emerald-500/20">
                      <Calendar className="w-3 h-3 text-emerald-400" />
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-emerald-200/70">Updated {latestDateInfo.date}</span>
                    </motion.div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <motion.div initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }} className="w-1 h-14 md:h-16 rounded-full bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-600 origin-top flex-shrink-0" style={{ boxShadow: '0 0 20px rgba(16, 185, 129, 0.4), 0 0 40px rgba(16, 185, 129, 0.2)' }} />
                  <div className="flex-1 min-w-0">
                    {enableAnimations ? (
                      <TextEffect as="h1" preset="blurSlide" per="char" delay={0.15} className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight" segmentWrapperClassName="bg-gradient-to-r from-white via-emerald-100 to-white/90 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(125,225,180,0.3)]">
                        Announcements
                      </TextEffect>
                    ) : (
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-emerald-100 to-white/90 bg-clip-text text-transparent">Announcements</h1>
                    )}
                    <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.7 }} className="mt-1.5 md:mt-2 text-xs sm:text-sm text-emerald-200/50 font-medium leading-relaxed max-w-xl">
                      Broadcasts from leadership, safety, and operations
                    </motion.p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="w-full space-y-4 md:space-y-6">
          {/* Content sections */}
          {loading ? (
            <AnnouncementsSkeleton />
          ) : visibleAnnouncements === 0 ? (
            <EmptyState searchTerm={searchTerm} onClearFilter={() => setSearchTerm("")} />
          ) : (
            <>
              {/* Featured Announcement - Direct display like Dashboard */}
              {latestAnnouncement && (
                <FeaturedAnnouncementCard
                  announcement={latestAnnouncement}
                  formatDate={formatDate}
                  onClick={() => setSelectedAnnouncement(latestAnnouncement)}
                />
              )}

              {/* Previous Updates Section with embedded search */}
              {restAnnouncements.length > 0 && (
                <ExpandableSection
                  id="announcements-feed"
                  title="Previous Updates"
                  subtitle={`${restAnnouncements.length} earlier broadcast${restAnnouncements.length !== 1 ? "s" : ""}`}
                  icon={<DashboardAvatar variant="jobs" className="w-8 h-8 md:w-10 md:h-10" />}
                  storageKey="announcements-feed-expanded"
                  defaultOpen={true}
                >
                  <div className="space-y-4">
                    {/* Search & Status - embedded in this section */}
                    <div className="space-y-3">
                      <SearchBar
                        value={searchTerm}
                        onChange={setSearchTerm}
                        onClear={() => setSearchTerm("")}
                        visibleCount={visibleAnnouncements}
                        totalCount={totalAnnouncements}
                      />
                      
                      {/* Inline Live Status */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-3 border-t border-emerald-500/10">
                        <motion.div
                          key={`status-${newAnnouncementIndicator}`}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={cn(
                            "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold tracking-wide",
                            newAnnouncementIndicator
                              ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
                              : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                          )}
                        >
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              newAnnouncementIndicator ? "bg-amber-300 animate-pulse" : "bg-emerald-300"
                            )}
                          />
                          {newAnnouncementIndicator ? "New Broadcast!" : "Live Synced"}
                        </motion.div>

                        <button
                          onClick={handleManualRefresh}
                          disabled={refreshing}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold text-xs transition-all shadow-md shadow-emerald-500/20 border border-emerald-400/30 disabled:opacity-50 group min-h-[40px]"
                        >
                          <RefreshCcw
                            className={cn(
                              "w-3.5 h-3.5",
                              refreshing ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-300"
                            )}
                          />
                          {refreshing ? "Syncing..." : "Sync Feed"}
                        </button>
                      </div>
                    </div>

                    {/* Announcements grid */}
                    <motion.div
                      layout
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
                    >
                      <AnimatePresence mode="popLayout">
                        {paginatedAnnouncements.map((announcement, idx) => (
                          <AnnouncementCard
                            key={announcement.id}
                            announcement={announcement}
                            index={idx}
                            formatDate={formatDate}
                            onClick={() => setSelectedAnnouncement(announcement)}
                          />
                        ))}
                      </AnimatePresence>
                    </motion.div>

                    {/* Pagination - compact */}
                    {totalPages > 1 && (
                      <div className="rounded-xl border border-emerald-500/15 bg-[#03150f]/60 backdrop-blur-xl p-3">
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
      </div>

      {/* Announcement Detail Modal */}
      <AnnouncementDetailModal
        announcement={selectedAnnouncement}
        isOpen={selectedAnnouncement !== null}
        onClose={() => setSelectedAnnouncement(null)}
        formatDate={formatDate}
      />
    </DashboardLayout>
  );
}
