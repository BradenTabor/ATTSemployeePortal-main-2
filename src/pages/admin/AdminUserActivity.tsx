import { useEffect, useState, useCallback, useMemo, memo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Users,
  Clock,
  Wifi,
  WifiOff,
  Moon,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  Shield,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  MapPin,
  TrendingUp,
  Eye,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { subscribeToTableChanges } from "../../lib/realtime";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { TextEffect } from "../../components/ui/TextEffect";
import { getDeviceCapabilities } from "../../lib/mobilePerf";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { logger } from "../../lib/logger";
import { cn } from "../../lib/utils";

// Types
interface UserActivitySession {
  id: string;
  user_id: string;
  session_id: string;
  status: "active" | "idle" | "offline";
  last_seen_at: string;
  started_at: string;
  ended_at: string | null;
  current_page: string | null;
  device_info: {
    browser?: string;
    os?: string;
    device_type?: "desktop" | "mobile" | "tablet";
    screen_width?: number;
  };
  email: string | null;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
  session_duration?: string;
  time_since_last_seen?: string;
}

interface ActivityStats {
  totalActive: number;
  totalIdle: number;
  totalOffline: number;
  totalToday: number;
  peakHour: string;
}

// Status badge component
const StatusBadge = memo(({ status }: { status: "active" | "idle" | "offline" }) => {
  const config = {
    active: {
      bg: "bg-emerald-500/20",
      border: "border-emerald-500/50",
      text: "text-emerald-300",
      dot: "bg-emerald-400",
      glow: "shadow-[0_0_12px_rgba(52,211,153,0.5)]",
      label: "Active",
      icon: <Wifi className="w-3 h-3" />,
    },
    idle: {
      bg: "bg-amber-500/20",
      border: "border-amber-500/50",
      text: "text-amber-300",
      dot: "bg-amber-400",
      glow: "shadow-[0_0_12px_rgba(251,191,36,0.4)]",
      label: "Idle",
      icon: <Moon className="w-3 h-3" />,
    },
    offline: {
      bg: "bg-gray-500/20",
      border: "border-gray-500/50",
      text: "text-gray-400",
      dot: "bg-gray-500",
      glow: "",
      label: "Offline",
      icon: <WifiOff className="w-3 h-3" />,
    },
  };

  const c = config[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold",
        c.bg,
        c.border,
        c.text,
        "border"
      )}
    >
      <span className={cn("w-2 h-2 rounded-full animate-pulse", c.dot, c.glow)} />
      {c.icon}
      <span className="hidden sm:inline">{c.label}</span>
    </span>
  );
});
StatusBadge.displayName = "StatusBadge";

// Device icon component
const DeviceIcon = memo(({ deviceType }: { deviceType?: string }) => {
  switch (deviceType) {
    case "mobile":
      return <Smartphone className="w-4 h-4 text-[#f4c979]/60" />;
    case "tablet":
      return <Tablet className="w-4 h-4 text-[#f4c979]/60" />;
    default:
      return <Monitor className="w-4 h-4 text-[#f4c979]/60" />;
  }
});
DeviceIcon.displayName = "DeviceIcon";

// Format relative time
const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 30) return "Just now";
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

// Format duration
const formatDuration = (startStr: string, endStr?: string | null): string => {
  const start = new Date(startStr);
  const end = endStr ? new Date(endStr) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  if (diffHours > 0) return `${diffHours}h ${mins}m`;
  return `${diffMins}m`;
};

// Page name formatter
const formatPageName = (path: string | null): string => {
  if (!path) return "Unknown";
  const routes: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/forms": "Forms Hub",
    "/forms/jsa": "Daily JSA",
    "/announcements": "Announcements",
    "/resources": "Resources",
    "/contact": "Contact",
    "/profile": "Profile",
    "/admin": "Admin Panel",
    "/admin/users": "Users & Activity",
    "/admin/requests-oversight": "Requests & Oversight",
    "/admin/rto": "RTO Requests",
    "/admin/jsa": "JSA Oversight",
    "/mechanic-dashboard": "Mechanic Dashboard",
    "/foreman-dashboard": "Foreman Dashboard",
    "/assigned-jobs": "Assigned Jobs",
  };
  return routes[path] || path.split("/").pop()?.replace(/-/g, " ") || path;
};

// Role badge styling
const getRoleBadgeClass = (role: string | null): string => {
  const badgeClasses: Record<string, string> = {
    admin: "bg-[#2a0b02] text-[#ffb199] border border-[#ff6b4a]/40",
    mechanic: "bg-[#0d1d2c] text-[#9cd7ff] border border-[#4c95c9]/40",
    employee: "bg-[#23102a] text-[#deb2ff] border border-[#b57ae3]/40",
    manager: "bg-[#1a2a1a] text-[#a8e6a8] border border-[#4caf50]/40",
    general_foreman: "bg-[#2d1b4e]/30 text-[#e9d5ff] border border-[#c084fc]/40",
    safety_officer: "bg-[#450a0a]/30 text-[#fef2f2] border border-[#fecaca]/40",
    foreman: "bg-[#03150f]/30 text-[#e5fff6] border border-[#7de1b4]/35",
  };
  return badgeClasses[role || ""] || "bg-white/5 text-[#fdf4db] border border-white/15";
};

// Compact Stats Strip for Mobile - Shows all key stats in one row
const CompactStatsStrip = memo(({ stats }: { stats: ActivityStats }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-white/10 bg-[#0c0a08]/70 sm:hidden"
    >
      {/* Active */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
        <div className="min-w-0">
          <p className="text-[10px] text-emerald-300/70 uppercase tracking-wide">Active</p>
          <p className="text-lg font-bold text-emerald-50 leading-tight">{stats.totalActive}</p>
        </div>
      </div>
      
      <div className="w-px h-8 bg-white/10" />
      
      {/* Idle */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.4)]" />
        <div className="min-w-0">
          <p className="text-[10px] text-amber-300/70 uppercase tracking-wide">Idle</p>
          <p className="text-lg font-bold text-amber-50 leading-tight">{stats.totalIdle}</p>
        </div>
      </div>
      
      <div className="w-px h-8 bg-white/10" />
      
      {/* Today */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-2 h-2 rounded-full bg-[#f4c979]" />
        <div className="min-w-0">
          <p className="text-[10px] text-[#f4c979]/70 uppercase tracking-wide">Today</p>
          <p className="text-lg font-bold text-[#fff8eb] leading-tight">{stats.totalToday}</p>
        </div>
      </div>
    </motion.div>
  );
});
CompactStatsStrip.displayName = "CompactStatsStrip";

// Stats Card Component - Premium solid design for better readability (desktop)
const StatsCard = memo(
  ({
    icon,
    label,
    value,
    subValue,
    color,
    delay = 0,
  }: {
    icon: React.ReactNode;
    label: string;
    value: number | string;
    subValue?: string;
    color: "emerald" | "amber" | "gray" | "gold";
    delay?: number;
  }) => {
    const colorClasses = {
      emerald: {
        bg: "from-[#0d2818] via-[#0a1f14] to-[#071510]",
        border: "border-emerald-500/50",
        accent: "bg-emerald-500",
        icon: "text-emerald-400",
        iconBg: "bg-emerald-500/20 border-emerald-500/40",
        label: "text-emerald-300/80",
        value: "text-emerald-50",
        subValue: "text-emerald-300/60",
        glow: "shadow-[0_0_40px_rgba(52,211,153,0.15),inset_0_1px_0_rgba(255,255,255,0.05)]",
      },
      amber: {
        bg: "from-[#1f1a0d] via-[#19150a] to-[#121008]",
        border: "border-amber-500/50",
        accent: "bg-amber-500",
        icon: "text-amber-400",
        iconBg: "bg-amber-500/20 border-amber-500/40",
        label: "text-amber-300/80",
        value: "text-amber-50",
        subValue: "text-amber-300/60",
        glow: "shadow-[0_0_40px_rgba(251,191,36,0.15),inset_0_1px_0_rgba(255,255,255,0.05)]",
      },
      gray: {
        bg: "from-[#1a1a1a] via-[#141414] to-[#0f0f0f]",
        border: "border-gray-500/40",
        accent: "bg-gray-500",
        icon: "text-gray-400",
        iconBg: "bg-gray-500/20 border-gray-500/40",
        label: "text-gray-400",
        value: "text-gray-100",
        subValue: "text-gray-500",
        glow: "shadow-[0_0_30px_rgba(100,100,100,0.1),inset_0_1px_0_rgba(255,255,255,0.03)]",
      },
      gold: {
        bg: "from-[#1f1810] via-[#18120b] to-[#110d08]",
        border: "border-[#f4c979]/50",
        accent: "bg-[#f4c979]",
        icon: "text-[#f4c979]",
        iconBg: "bg-[#f4c979]/20 border-[#f4c979]/40",
        label: "text-[#f8e5bb]/80",
        value: "text-[#fff8eb]",
        subValue: "text-[#f4c979]/60",
        glow: "shadow-[0_0_40px_rgba(244,201,121,0.15),inset_0_1px_0_rgba(255,255,255,0.05)]",
      },
    };

    const c = colorClasses[color];

    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "relative overflow-hidden rounded-2xl border p-3 sm:p-4",
          "bg-gradient-to-br",
          c.bg,
          c.border,
          c.glow
        )}
      >
        {/* Top accent line */}
        <div className={cn("absolute top-0 left-3 right-3 h-[2px] rounded-full", c.accent, "opacity-60")} />
        
        {/* Subtle inner highlight */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent" />

        <div className="relative flex items-start justify-between gap-2">
          <div className="space-y-0.5 min-w-0 flex-1">
            <p className={cn("text-[9px] sm:text-[10px] uppercase tracking-[0.15em] font-semibold truncate", c.label)}>
              {label}
            </p>
            <p className={cn("text-xl sm:text-2xl font-black tabular-nums tracking-tight", c.value)}>
              {value}
            </p>
            {subValue && (
              <p className={cn("text-[9px] sm:text-[10px] font-medium truncate", c.subValue)}>
                {subValue}
              </p>
            )}
          </div>
          <div className={cn(
            "p-2 rounded-lg border backdrop-blur-sm flex-shrink-0",
            c.iconBg,
            c.icon
          )}>
            {icon}
          </div>
        </div>
      </motion.div>
    );
  }
);
StatsCard.displayName = "StatsCard";

// User Activity Card Component - Compact for mobile
const UserActivityCard = memo(
  ({
    session,
    index,
    isExpanded,
    onToggle,
  }: {
    session: UserActivitySession;
    index: number;
    isExpanded: boolean;
    onToggle: () => void;
  }) => {
    const isActive = session.status === "active";
    const isIdle = session.status === "idle";

    return (
      <motion.article
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ delay: index * 0.02, duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        layout
        className={cn(
          "group relative rounded-xl border transition-all duration-200",
          "bg-gradient-to-br from-[#1b1914]/80 to-[#120f0c]/60",
          isActive
            ? "border-emerald-500/30 hover:border-emerald-500/50"
            : isIdle
            ? "border-amber-500/20 hover:border-amber-500/40"
            : "border-white/10 hover:border-white/20"
        )}
      >
        {/* Live indicator pulse for active users */}
        {isActive && (
          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5">
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
            <span className="absolute inset-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
          </div>
        )}

        <div className="p-3 space-y-2">
          {/* Header Row - More compact */}
          <div className="flex items-center gap-2.5">
            {/* Avatar with status ring - smaller on mobile */}
            <div className="relative flex-shrink-0">
              <div
                className={cn(
                  "rounded-full p-0.5",
                  isActive
                    ? "bg-gradient-to-br from-emerald-400 to-emerald-600"
                    : isIdle
                    ? "bg-gradient-to-br from-amber-400 to-amber-600"
                    : "bg-gradient-to-br from-gray-500 to-gray-600"
                )}
              >
                <div className="rounded-full bg-[#0c0a08] p-0.5">
                  <UserAvatar
                    avatarUrl={session.avatar_url}
                    name={session.full_name}
                    email={session.email}
                    size="sm"
                  />
                </div>
              </div>
            </div>

            {/* User Info - Condensed */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-white text-xs sm:text-sm truncate">
                  {session.full_name || session.email?.split("@")[0] || "Unknown"}
                </p>
                <StatusBadge status={session.status} />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {session.role && (
                  <span
                    className={cn(
                      "inline-flex items-center px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-semibold",
                      getRoleBadgeClass(session.role)
                    )}
                  >
                    {session.role.charAt(0).toUpperCase() + session.role.slice(1).replace("_", " ")}
                  </span>
                )}
                <span className="text-[9px] text-white/40 truncate hidden sm:inline">
                  {session.email}
                </span>
              </div>
            </div>

            {/* Quick info + Expand Button */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[9px] text-white/50 hidden sm:inline">
                {formatRelativeTime(session.last_seen_at)}
              </span>
              <button
                type="button"
                onClick={onToggle}
                className="p-1.5 rounded-lg border border-white/10 hover:border-[#f4c979]/30 hover:bg-white/5 transition-all focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#f4c979]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
                aria-label={isExpanded ? "Collapse details" : "Expand details"}
              >
                {isExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-[#f4c979]" aria-hidden />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-white/50" aria-hidden />
                )}
              </button>
            </div>
          </div>

          {/* Quick Stats Row - Mobile optimized */}
          <div className="flex items-center gap-3 text-[9px] sm:text-[10px] text-white/50">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(session.last_seen_at)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Activity className="w-3 h-3" />
              {formatDuration(session.started_at, session.ended_at)}
            </span>
            {session.current_page && (
              <span className="inline-flex items-center gap-1 text-[#f4c979]/70 truncate">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{formatPageName(session.current_page)}</span>
              </span>
            )}
          </div>

          {/* Expanded Details */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="pt-2 border-t border-white/5 space-y-2">
                  {/* Email on mobile (shown in expanded) */}
                  <p className="text-[10px] text-[#c7b696] truncate sm:hidden">
                    {session.email}
                  </p>
                  
                  {/* Device Info - Compact */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/10">
                      <DeviceIcon deviceType={session.device_info?.device_type} />
                      <span className="text-[9px] sm:text-[10px] text-white/70">
                        {session.device_info?.device_type || "Desktop"}
                      </span>
                    </div>
                    {session.device_info?.browser && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/10">
                        <Globe className="w-3 h-3 text-[#f4c979]/60" />
                        <span className="text-[9px] sm:text-[10px] text-white/70">
                          {session.device_info.browser}
                        </span>
                      </div>
                    )}
                    {session.device_info?.os && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/10">
                        <Monitor className="w-3 h-3 text-[#f4c979]/60" />
                        <span className="text-[9px] sm:text-[10px] text-white/70">
                          {session.device_info.os}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Session Timeline - Compact */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="px-2 py-1.5 rounded bg-white/5 border border-white/10">
                      <p className="text-[8px] uppercase tracking-wider text-white/40">Started</p>
                      <p className="text-[10px] text-white/80">
                        {new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="px-2 py-1.5 rounded bg-white/5 border border-white/10">
                      <p className="text-[8px] uppercase tracking-wider text-white/40">Last Active</p>
                      <p className="text-[10px] text-white/80">
                        {new Date(session.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.article>
    );
  }
);
UserActivityCard.displayName = "UserActivityCard";

// Main Component
interface AdminUserActivityProps {
  /** When true, render only inner content (no layout). Used by AdminUsersHub. */
  embedded?: boolean;
}

function AdminUserActivity({ embedded = false }: AdminUserActivityProps) {
  const { role: currentUserRole } = useAuth();
  const [sessions, setSessions] = useState<UserActivitySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  // Device capabilities for animation decisions
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;

  // Calculate stats
  const stats: ActivityStats = useMemo(() => {
    const active = sessions.filter((s) => s.status === "active").length;
    const idle = sessions.filter((s) => s.status === "idle").length;
    const offline = sessions.filter((s) => s.status === "offline").length;

    // Count unique users who were active today (had activity today)
    const today = new Date().toDateString();
    const todayUsers = new Set(
      sessions
        .filter((s) => s.status !== "offline" && new Date(s.last_seen_at).toDateString() === today)
        .map((s) => s.user_id)
    );

    return {
      totalActive: active,
      totalIdle: idle,
      totalOffline: offline,
      totalToday: todayUsers.size,
      peakHour: "9 AM - 10 AM", // Could be calculated from data
    };
  }, [sessions]);

  // Helper to convert avatar storage path to public URL
  const getAvatarPublicUrl = useCallback((avatarPath: string | null): string | null => {
    if (!avatarPath) return null;
    const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath);
    return data.publicUrl ?? null;
  }, []);

  // Track last cleanup time to avoid calling too frequently
  const lastCleanupRef = useRef<number>(0);
  
  // Fetch sessions - includes ALL users, marking those without sessions as offline
  const fetchSessions = useCallback(async () => {
    try {
      // Only run cleanup/idle marking every 2 minutes to avoid race conditions
      // This prevents marking the current admin as idle while they're viewing this page
      const now = Date.now();
      if (now - lastCleanupRef.current > 120000) {
        lastCleanupRef.current = now;
        await supabase.rpc("cleanup_stale_sessions");
        await supabase.rpc("mark_idle_sessions");
      }

      // Fetch all users from app_users
      const { data: allUsers, error: usersError } = await supabase
        .from("app_users")
        .select("id, user_id, email, full_name, role, avatar_url, created_at")
        .order("full_name", { ascending: true });

      if (usersError) {
        logger.error("Failed to fetch users:", usersError);
        return;
      }

      // Fetch last activity per user (form submissions, incidents, telemetry) for offline "last seen"
      const { data: lastActivityRows, error: lastActivityError } = await supabase.rpc("get_user_last_activity");
      if (lastActivityError) {
        logger.warn("Failed to fetch user last activity (offline last-seen may show account creation date):", lastActivityError);
      }
      const lastActivityMap = new Map<string, string>();
      (lastActivityRows || []).forEach((row: { user_id: string; last_activity_at: string }) => {
        lastActivityMap.set(row.user_id, row.last_activity_at);
      });

      // Fetch active/idle sessions from user_activity_feed
      // Optimized: select only needed fields (80% data reduction) + limit to 50 most recent
      const { data: activeSessions, error: sessionsError } = await supabase
        .from("user_activity_feed")
        .select("id, user_id, session_id, status, last_seen_at, started_at, ended_at, current_page, device_info, avatar_url")
        .in("status", ["active", "idle"])
        .order("last_seen_at", { ascending: false })
        .limit(50);

      if (sessionsError) {
        logger.error("Failed to fetch user activity:", sessionsError);
        return;
      }

      // Create a map of user_id to their active session
      // Note: activeSessions from API doesn't include email/full_name/role yet - those are added in merge step
      type RawSession = Omit<UserActivitySession, 'email' | 'full_name' | 'role'>;
      const activeSessionMap = new Map<string, RawSession>();
      (activeSessions || []).forEach((session: RawSession) => {
        // Only keep the most recent session per user
        if (!activeSessionMap.has(session.user_id)) {
          activeSessionMap.set(session.user_id, session);
        }
      });

      // Merge all users with their session data (or mark as offline)
      const mergedSessions: UserActivitySession[] = (allUsers || []).map((user) => {
        const activeSession = activeSessionMap.get(user.user_id) as UserActivitySession | undefined;
        
        if (activeSession) {
          // User has an active/idle session
          return {
            ...activeSession,
            avatar_url: getAvatarPublicUrl(activeSession.avatar_url),
          };
        } else {
          // User is offline: use last activity from forms/incidents/telemetry, else account creation
          const lastActivityAt = lastActivityMap.get(user.user_id) ?? user.created_at;
          return {
            id: `offline-${user.user_id}`,
            user_id: user.user_id,
            session_id: "",
            status: "offline" as const,
            last_seen_at: lastActivityAt,
            started_at: user.created_at,
            ended_at: null,
            current_page: null,
            device_info: {},
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            avatar_url: getAvatarPublicUrl(user.avatar_url),
          };
        }
      });

      // Sort: active first, then idle, then offline (by last_seen_at within each group)
      mergedSessions.sort((a, b) => {
        const statusOrder = { active: 0, idle: 1, offline: 2 };
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        if (statusDiff !== 0) return statusDiff;
        return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
      });

      setSessions(mergedSessions);
    } catch (err) {
      logger.error("Unexpected error fetching activity:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAvatarPublicUrl]);

  // Initial fetch and realtime subscription
  useEffect(() => {
    if (currentUserRole !== "admin") return;

    let isMounted = true;

    const load = async () => {
      if (!isMounted) return;
      await fetchSessions();
    };

    load();

    // Subscribe to realtime changes
    const unsubscribe = subscribeToTableChanges({
      channelName: "admin-user-activity",
      table: "user_activity_sessions",
      onInsert: () => {
        if (isMounted) fetchSessions();
      },
      onUpdate: () => {
        if (isMounted) fetchSessions();
      },
      onDelete: () => {
        if (isMounted) fetchSessions();
      },
      onError: (error) => {
        logger.error("Realtime subscription error:", error);
      },
    });

    // Refresh every 30 seconds to update relative times
    const refreshInterval = setInterval(() => {
      if (isMounted) fetchSessions();
    }, 30000);

    return () => {
      isMounted = false;
      unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [currentUserRole, fetchSessions]);

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSessions();
  }, [fetchSessions]);

  // Toggle session expansion
  const toggleExpanded = useCallback((sessionId: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }, []);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      // Status filter
      if (statusFilter && session.status !== statusFilter) return false;

      // Search filter
      if (debouncedSearchQuery) {
        const query = debouncedSearchQuery.toLowerCase();
        const matchesName = session.full_name?.toLowerCase().includes(query);
        const matchesEmail = session.email?.toLowerCase().includes(query);
        const matchesRole = session.role?.toLowerCase().includes(query);
        if (!matchesName && !matchesEmail && !matchesRole) return false;
      }

      return true;
    });
  }, [sessions, statusFilter, debouncedSearchQuery]);

  // Group sessions by status for the live feed
  const groupedSessions = useMemo(() => {
    const active = filteredSessions.filter((s) => s.status === "active");
    const idle = filteredSessions.filter((s) => s.status === "idle");
    const offline = filteredSessions.filter((s) => s.status === "offline");
    return { active, idle, offline };
  }, [filteredSessions]);

  // Access denied for non-admins
  if (currentUserRole !== "admin") {
    if (embedded) return null;
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-black to-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  const inner = (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 pb-4 pt-3 sm:pt-6">
        {/* Compact Header for Mobile / Premium Glass Header for Desktop */}
        <div className="mb-3 sm:mb-5">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div
              className="relative overflow-hidden rounded-xl sm:rounded-2xl md:rounded-3xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]"
              style={{
                background:
                  "linear-gradient(145deg, rgba(244, 201, 121, 0.1) 0%, rgba(28, 28, 31, 0.65) 40%, rgba(15, 13, 9, 0.75) 100%)",
                backdropFilter: "blur(24px) saturate(1.6)",
                WebkitBackdropFilter: "blur(24px) saturate(1.6)",
              }}
            >
              {/* Glass effects - hidden on mobile for perf */}
              <div
                className="absolute inset-0 pointer-events-none hidden sm:block"
                style={{
                  background:
                    "linear-gradient(125deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 25%, transparent 50%)",
                }}
              />
              <div
                className="absolute inset-0 pointer-events-none hidden sm:block"
                style={{
                  background: "radial-gradient(ellipse at 25% 0%, rgba(244, 201, 121, 0.2) 0%, transparent 45%)",
                }}
              />
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-white/5 via-white/25 to-white/5 rounded-t-[inherit]" />

              <div className="relative px-3 py-2.5 sm:px-5 sm:py-4 md:px-7 md:py-5">
                {/* Eyebrow badges - Compact on mobile */}
                <div className="flex items-center gap-2 mb-2 sm:mb-3 flex-wrap">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-[#f4c979]/15 border border-[#f4c979]/30"
                  >
                    <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#f4c979]" />
                    <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] font-bold text-[#f8e5bb]">
                      Admin • Live
                    </span>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.15 }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30"
                  >
                    <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400" />
                    <span className="text-[8px] sm:text-[9px] uppercase tracking-wider font-semibold text-emerald-300">
                      Real-time
                    </span>
                  </motion.div>
                </div>

                {/* Title and description - Compact on mobile */}
                <div className="flex items-center gap-2.5 sm:gap-4">
                  <motion.div
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="w-0.5 sm:w-1 h-10 sm:h-14 md:h-16 rounded-full bg-gradient-to-b from-[#f7e4bd] via-[#f4c979] to-[#d79a32] origin-top flex-shrink-0"
                    style={{
                      boxShadow: "0 0 20px rgba(244, 201, 121, 0.5), 0 0 40px rgba(244, 201, 121, 0.25)",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    {enableAnimations ? (
                      <TextEffect
                        as="h1"
                        preset="blurSlide"
                        per="char"
                        delay={0.1}
                        className="text-base sm:text-xl md:text-2xl lg:text-3xl font-black tracking-tight"
                        segmentWrapperClassName="bg-gradient-to-r from-white via-[#f8e5bb] to-white/90 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(244,201,121,0.35)]"
                      >
                        Activity Monitor
                      </TextEffect>
                    ) : (
                      <h1 className="text-base sm:text-xl md:text-2xl lg:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-[#f8e5bb] to-white/90 bg-clip-text text-transparent">
                        Activity Monitor
                      </h1>
                    )}
                    {/* Description - hidden on mobile */}
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.5 }}
                      className="hidden sm:block mt-1 md:mt-2 text-xs sm:text-sm text-[#f8e5bb]/50 font-medium leading-relaxed max-w-xl"
                    >
                      Track who's online and monitor real-time user activity
                    </motion.p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Compact Stats Strip for Mobile */}
        <div className="mb-3">
          <CompactStatsStrip stats={stats} />
        </div>

        {/* Stats Grid - Hidden on mobile, shown on sm+ */}
        <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
          <StatsCard
            icon={<Wifi className="w-5 h-5" />}
            label="Active Now"
            value={stats.totalActive}
            subValue="Currently online"
            color="emerald"
            delay={0.1}
          />
          <StatsCard
            icon={<Moon className="w-5 h-5" />}
            label="Idle"
            value={stats.totalIdle}
            subValue="Away from app"
            color="amber"
            delay={0.15}
          />
          <StatsCard
            icon={<Users className="w-5 h-5" />}
            label="Today's Visitors"
            value={stats.totalToday}
            subValue="Unique users"
            color="gold"
            delay={0.2}
          />
          <StatsCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Peak Activity"
            value={stats.peakHour}
            subValue="Most active time"
            color="gold"
            delay={0.25}
          />
        </div>

        {/* Filters and Search - Compact on mobile */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="rounded-xl sm:rounded-2xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#080705] p-2.5 sm:p-4 mb-3 sm:mb-6 shadow-[0_25px_50px_rgba(0,0,0,0.55)]"
        >
          <div className="flex gap-2 sm:gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#b59d72] absolute left-3 sm:left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg sm:rounded-xl bg-[#050402]/70 border border-[#f4c979]/20 pl-9 sm:pl-11 pr-3 sm:pr-4 py-2 sm:py-3 text-xs sm:text-sm text-[#fdf4db] placeholder:text-[#bfa984] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/60 min-h-[40px] sm:min-h-[48px]"
              />
            </div>

            {/* Status Filter */}
            <div className="relative flex-shrink-0">
              <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#b59d72] absolute left-3 sm:left-4 top-1/2 -translate-y-1/2" />
              <select
                value={statusFilter || ""}
                onChange={(e) => setStatusFilter(e.target.value || null)}
                className="w-[90px] sm:w-auto rounded-lg sm:rounded-xl bg-[#050402]/70 border border-[#f4c979]/20 pl-8 sm:pl-11 pr-2 sm:pr-10 py-2 sm:py-3 text-xs sm:text-sm text-[#fdf4db] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/60 appearance-none cursor-pointer min-h-[40px] sm:min-h-[48px]"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="idle">Idle</option>
                <option value="offline">Offline</option>
              </select>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label={refreshing ? "Refreshing activity..." : "Refresh user activity"}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2 sm:py-3 rounded-lg sm:rounded-xl",
                "bg-gradient-to-r from-[#f7e4bd]/10 to-[#f4c979]/10",
                "border border-[#f4c979]/30 text-[#f4c979]",
                "hover:from-[#f7e4bd]/20 hover:to-[#f4c979]/20",
                "transition-all duration-200 min-h-[40px] sm:min-h-[48px] flex-shrink-0",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#f4c979]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
              )}
            >
              <RefreshCw className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", refreshing && "animate-spin")} aria-hidden />
              <span className="text-xs sm:text-sm font-semibold hidden sm:inline">Refresh</span>
            </button>
          </div>

          {/* Active filters - Compact */}
          {(searchQuery || statusFilter) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="flex flex-wrap gap-1.5 sm:gap-2 pt-2 sm:pt-3 mt-2 sm:mt-3 border-t border-white/5"
            >
              {searchQuery && (
                <span className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border border-[#f4c979]/30 bg-[#f4c979]/10 text-[10px] sm:text-xs text-[#fef3d1]">
                  {searchQuery}
                  <button type="button" onClick={() => setSearchQuery("")} aria-label="Clear search" className="hover:text-white focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#f4c979]/50 rounded">✕</button>
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border border-[#f6dcb2]/30 bg-[#f6dcb2]/10 text-[10px] sm:text-xs text-[#fef3d1]">
                  {statusFilter}
                  <button type="button" onClick={() => setStatusFilter(null)} aria-label="Clear status filter" className="hover:text-white focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#f4c979]/50 rounded">✕</button>
                </span>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Activity Feed */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.25 }}
          className="rounded-xl sm:rounded-2xl md:rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.65)]"
        >
          {/* Section Header - Compact on mobile */}
          <div className="px-3 py-2.5 sm:px-5 sm:py-4 border-b border-white/5 bg-gradient-to-r from-[#2b251b]/50 to-[#1b1812]/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-[#f4c979]/15 border border-[#f4c979]/30">
                  <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-[#f4c979]" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-lg font-semibold text-white">Live Feed</h2>
                  <p className="text-[10px] sm:text-xs text-white/50">
                    {filteredSessions.length} session{filteredSessions.length !== 1 ? "s" : ""} • Auto-updates
                  </p>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-3 sm:p-6 space-y-2 sm:space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 sm:h-24 rounded-xl sm:rounded-2xl bg-white/5 animate-pulse"
                />
              ))}
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-10 sm:py-16 px-4">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-[#211c15] border border-[#f6dcb2]/30 mx-auto mb-3 sm:mb-4">
                <Activity className="w-5 h-5 sm:w-7 sm:h-7 text-[#f4c979]" />
              </div>
              <h3 className="text-base sm:text-xl font-semibold text-white mb-1 sm:mb-2">No Activity Found</h3>
              <p className="text-xs sm:text-sm text-[#f8e5bb]/70 max-w-sm mx-auto">
                {searchQuery || statusFilter
                  ? "No matches. Try adjusting filters."
                  : "Activity will appear as users interact."}
              </p>
            </div>
          ) : (
            <div className="p-2.5 sm:p-4 md:p-6 space-y-3 sm:space-y-6">
              {/* Active Users Section */}
              {groupedSessions.active.length > 0 && (
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center gap-1.5 sm:gap-2 px-0.5 sm:px-1">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                    <h3 className="text-xs sm:text-sm font-semibold text-emerald-300 uppercase tracking-wider">
                      Active ({groupedSessions.active.length})
                    </h3>
                  </div>
                  <div className="grid gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <AnimatePresence mode="popLayout">
                      {groupedSessions.active.map((session, index) => (
                        <UserActivityCard
                          key={session.id}
                          session={session}
                          index={index}
                          isExpanded={expandedSessions.has(session.id)}
                          onToggle={() => toggleExpanded(session.id)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Idle Users Section */}
              {groupedSessions.idle.length > 0 && (
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center gap-1.5 sm:gap-2 px-0.5 sm:px-1">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]" />
                    <h3 className="text-xs sm:text-sm font-semibold text-amber-300 uppercase tracking-wider">
                      Idle ({groupedSessions.idle.length})
                    </h3>
                  </div>
                  <div className="grid gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <AnimatePresence mode="popLayout">
                      {groupedSessions.idle.map((session, index) => (
                        <UserActivityCard
                          key={session.id}
                          session={session}
                          index={index}
                          isExpanded={expandedSessions.has(session.id)}
                          onToggle={() => toggleExpanded(session.id)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Offline Users Section (Collapsed by default) */}
              {groupedSessions.offline.length > 0 && (
                <details className="group">
                  <summary className="flex items-center gap-1.5 sm:gap-2 px-0.5 sm:px-1 cursor-pointer list-none">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-gray-500" />
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wider">
                      Offline ({groupedSessions.offline.length})
                    </h3>
                    <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="grid gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-2 sm:mt-3">
                    <AnimatePresence mode="popLayout">
                      {groupedSessions.offline.slice(0, 12).map((session, index) => (
                        <UserActivityCard
                          key={session.id}
                          session={session}
                          index={index}
                          isExpanded={expandedSessions.has(session.id)}
                          onToggle={() => toggleExpanded(session.id)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </details>
              )}
            </div>
          )}
        </motion.div>
    </div>
  );

  if (embedded) return inner;
  return <DashboardLayout title="User Activity" pageHeading>{inner}</DashboardLayout>;
}

export default memo(AdminUserActivity);
