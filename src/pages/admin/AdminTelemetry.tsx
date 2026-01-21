/**
 * AdminTelemetry - Comprehensive Telemetry Dashboard
 *
 * Displays ALL collected telemetry data with proper organization:
 * - Summary statistics
 * - Form performance metrics
 * - Announcement engagement
 * - Duplicate detection stats
 * - Activity timeline
 * - Raw event log
 * - Error breakdown
 * - Route analytics
 *
 * @module AdminTelemetry
 */

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Activity,
  AlertTriangle,
  Eye,
  Shield,
  Clock,
  RefreshCw,
  FileText,
  CheckCircle2,
  XCircle,
  List,
  MapPin,
  Users,
  Zap,
  Database,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { cn } from "../../lib/utils";
import {
  useTelemetryStats,
  calculateErrorRate,
  calculatePreventionRate,
  formatDuration,
  type DateRange,
} from "../../hooks/queries/useTelemetryStats";
import {
  useRawTelemetryEvents,
  useErrorBreakdown,
  useRouteStats,
  type RawTelemetryEvent,
} from "../../hooks/queries/useRawTelemetryEvents";

// Import from extracted module
import {
  DATE_RANGE_OPTIONS,
  FORM_TYPE_META,
  FORM_TYPE_LABELS,
  EVENT_TYPE_META,
  containerVariants,
  itemVariants,
} from "./admin-telemetry";

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

// SectionHeader component available if needed for section layouts
// interface SectionHeaderProps {
//   icon: React.ReactNode;
//   title: string;
//   subtitle?: string;
//   action?: React.ReactNode;
// }

interface StatBoxProps {
  label: string;
  value: string | number;
  subValue?: string;
  color?: "emerald" | "blue" | "amber" | "red" | "purple";
  icon?: React.ReactNode;
}

function StatBox({ label, value, subValue, color = "emerald", icon }: StatBoxProps) {
  const colorClasses = {
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    blue: "border-blue-500/30 bg-blue-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    red: "border-red-500/30 bg-red-500/5",
    purple: "border-purple-500/30 bg-purple-500/5",
  };
  
  const textClasses = {
    emerald: "text-emerald-400",
    blue: "text-blue-400",
    amber: "text-amber-400",
    red: "text-red-400",
    purple: "text-purple-400",
  };

  return (
    <div className={cn("rounded-xl border p-3", colorClasses[color])}>
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className={textClasses[color]}>{icon}</span>}
        <span className="text-[10px] uppercase tracking-wide text-white/50">{label}</span>
      </div>
      <p className={cn("text-xl font-bold tabular-nums", textClasses[color])}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {subValue && <p className="text-[10px] text-white/40 mt-0.5">{subValue}</p>}
    </div>
  );
}

// ============================================================================
// SUMMARY SECTION
// ============================================================================

interface SummarySectionProps {
  data: {
    summary: { total_events: number; unique_sessions: number; unique_users: number };
    forms: { total_started: number; total_submitted: number; total_errors: number };
    announcements: { total_views: number; unique_sessions: number; ai_generated_views: number };
    duplicates: { detected: number; prevented: number; overridden: number };
  };
}

// Compact Mobile Stat Chip
function MobileStatChip({ label, value, icon, color = "emerald" }: { 
  label: string; 
  value: string | number; 
  icon: React.ReactNode;
  color?: "emerald" | "blue" | "amber" | "red" | "purple";
}) {
  const colorClasses = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    red: "border-red-500/30 bg-red-500/10 text-red-400",
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  };
  
  return (
    <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-lg border shrink-0", colorClasses[color])}>
      <span className="opacity-80">{icon}</span>
      <span className="text-[10px] text-white/60 whitespace-nowrap">{label}</span>
      <span className="text-xs font-bold tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</span>
    </div>
  );
}

function SummarySection({ data }: SummarySectionProps) {
  const errorRate = calculateErrorRate(data.forms.total_submitted, data.forms.total_errors);
  const preventionRate = calculatePreventionRate(data.duplicates.detected, data.duplicates.prevented);

  return (
    <motion.div variants={itemVariants}>
      {/* Mobile: Horizontal scrolling compact strip */}
      <div className="sm:hidden overflow-x-auto -mx-4 px-4 pb-2">
        <div className="flex gap-1.5">
          <MobileStatChip label="Events" value={data.summary.total_events} icon={<Activity className="w-3 h-3" />} color="emerald" />
          <MobileStatChip label="Sessions" value={data.summary.unique_sessions} icon={<Users className="w-3 h-3" />} color="blue" />
          <MobileStatChip label="Started" value={data.forms.total_started} icon={<FileText className="w-3 h-3" />} color="blue" />
          <MobileStatChip label="Submitted" value={data.forms.total_submitted} icon={<CheckCircle2 className="w-3 h-3" />} color="emerald" />
          <MobileStatChip label="Errors" value={data.forms.total_errors} icon={<XCircle className="w-3 h-3" />} color="red" />
          <MobileStatChip label="Views" value={data.announcements.total_views} icon={<Eye className="w-3 h-3" />} color="purple" />
          <MobileStatChip label="Dupes" value={data.duplicates.detected} icon={<Shield className="w-3 h-3" />} color="amber" />
        </div>
      </div>

      {/* Desktop: Full Grid */}
      <div className="hidden sm:grid sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatBox 
          label="Total Events" 
          value={data.summary.total_events} 
          icon={<Activity className="w-3.5 h-3.5" />}
          color="emerald"
        />
        <StatBox 
          label="Sessions" 
          value={data.summary.unique_sessions} 
          icon={<Users className="w-3.5 h-3.5" />}
          color="blue"
        />
        <StatBox 
          label="Users" 
          value={data.summary.unique_users} 
          icon={<Users className="w-3.5 h-3.5" />}
          color="purple"
        />
        <StatBox 
          label="Forms Started" 
          value={data.forms.total_started} 
          icon={<FileText className="w-3.5 h-3.5" />}
          color="blue"
        />
        <StatBox 
          label="Forms Submitted" 
          value={data.forms.total_submitted} 
          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          color="emerald"
        />
        <StatBox 
          label="Form Errors" 
          value={data.forms.total_errors}
          subValue={`${errorRate}% rate`}
          icon={<XCircle className="w-3.5 h-3.5" />}
          color="red"
        />
        <StatBox 
          label="Announcements" 
          value={data.announcements.total_views}
          subValue={`${data.announcements.ai_generated_views} AI`}
          icon={<Eye className="w-3.5 h-3.5" />}
          color="purple"
        />
        <StatBox 
          label="Duplicates" 
          value={data.duplicates.detected}
          subValue={`${preventionRate}% prevented`}
          icon={<Shield className="w-3.5 h-3.5" />}
          color="amber"
        />
      </div>
    </motion.div>
  );
}

// ============================================================================
// FORM PERFORMANCE SECTION
// ============================================================================

interface FormPerformanceSectionProps {
  completionTimes: Array<{
    form_type: string;
    p50_seconds: number;
    p90_seconds: number;
    sample_size: number;
  }>;
  byType: Array<{
    form_type: string;
    started: number;
    submitted: number;
    errors: number;
  }>;
}

const ALL_FORM_TYPES = ['dvir', 'equipment', 'rto', 'jsa'] as const;

function FormPerformanceSection({ completionTimes, byType }: FormPerformanceSectionProps) {
  const formStats = useMemo(() => {
    return ALL_FORM_TYPES.map(formType => {
      const timing = completionTimes.find(d => d.form_type === formType);
      const stats = byType.find(d => d.form_type === formType);
      return {
        form_type: formType,
        p50_seconds: timing?.p50_seconds ?? 0,
        p90_seconds: timing?.p90_seconds ?? 0,
        sample_size: timing?.sample_size ?? 0,
        started: stats?.started ?? 0,
        submitted: stats?.submitted ?? 0,
        errors: stats?.errors ?? 0,
      };
    });
  }, [completionTimes, byType]);

  const maxTime = Math.max(...formStats.map((d) => d.p90_seconds), 60);

  const colorClasses: Record<string, { bg: string; border: string; text: string; bar: string }> = {
    emerald: { bg: "from-emerald-500/10 to-emerald-600/5", border: "border-emerald-500/30", text: "text-emerald-400", bar: "from-emerald-400 to-emerald-500" },
    blue: { bg: "from-blue-500/10 to-blue-600/5", border: "border-blue-500/30", text: "text-blue-400", bar: "from-blue-400 to-blue-500" },
    purple: { bg: "from-purple-500/10 to-purple-600/5", border: "border-purple-500/30", text: "text-purple-400", bar: "from-purple-400 to-purple-500" },
    amber: { bg: "from-amber-500/10 to-amber-600/5", border: "border-amber-500/30", text: "text-amber-400", bar: "from-amber-400 to-amber-500" },
  };

  return (
    <motion.div
      variants={itemVariants}
      className="rounded-xl sm:rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-[#07140f] via-[#050a0f] to-[#020205] p-3 sm:p-5"
    >
      {/* Compact mobile header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Clock className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-white">Form Performance</h3>
            <p className="hidden sm:block text-xs text-white/40 mt-0.5">Completion times, submission rates, and error tracking</p>
          </div>
        </div>
      </div>

      {/* Mobile: Compact horizontal scrolling cards */}
      <div className="sm:hidden overflow-x-auto -mx-3 px-3 pb-2">
        <div className="flex gap-2">
          {formStats.map((item) => {
            const meta = FORM_TYPE_META[item.form_type];
            const colors = colorClasses[meta?.color || 'emerald'];
            const completionRate = item.started > 0 ? Math.round((item.submitted / item.started) * 100) : 0;

            return (
              <div
                key={item.form_type}
                className={cn(
                  "rounded-lg border p-2.5 bg-gradient-to-br min-w-[140px] shrink-0",
                  colors.bg, colors.border
                )}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <div className={cn("p-1 rounded bg-white/5", colors.text)}>
                    {meta?.icon && <div className="w-3.5 h-3.5">{meta.icon}</div>}
                  </div>
                  <span className="text-xs font-medium text-white">{meta?.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-center">
                  <div>
                    <p className="text-sm font-bold text-emerald-400 tabular-nums">{item.submitted}</p>
                    <p className="text-[8px] text-white/40">Done</p>
                  </div>
                  <div>
                    <p className={cn("text-sm font-bold tabular-nums", completionRate >= 80 ? "text-emerald-400" : completionRate >= 50 ? "text-amber-400" : "text-white/50")}>
                      {completionRate}%
                    </p>
                    <p className="text-[8px] text-white/40">Rate</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop: Full Grid */}
      <div className="hidden sm:grid sm:grid-cols-2 gap-3">
        {formStats.map((item, idx) => {
          const meta = FORM_TYPE_META[item.form_type];
          const colors = colorClasses[meta?.color || 'emerald'];
          const p50Width = maxTime > 0 ? (item.p50_seconds / maxTime) * 100 : 0;
          const p90Width = maxTime > 0 ? (item.p90_seconds / maxTime) * 100 : 0;
          const completionRate = item.started > 0 ? Math.round((item.submitted / item.started) * 100) : 0;
          const hasData = item.sample_size > 0;

          return (
            <motion.div
              key={item.form_type}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={cn(
                "rounded-xl border p-4 bg-gradient-to-br",
                colors.bg, colors.border
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={cn("p-2 rounded-lg bg-white/5", colors.text)}>
                    {meta?.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-sm">{meta?.label}</h4>
                    <p className="text-[10px] text-white/40">{meta?.fullName}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-white tabular-nums">{item.started}</p>
                  <p className="text-[9px] text-white/40">Started</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-emerald-400 tabular-nums">{item.submitted}</p>
                  <p className="text-[9px] text-white/40">Submitted</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-red-400 tabular-nums">{item.errors}</p>
                  <p className="text-[9px] text-white/40">Errors</p>
                </div>
                <div className="text-center">
                  <p className={cn("text-lg font-bold tabular-nums", completionRate >= 80 ? "text-emerald-400" : completionRate >= 50 ? "text-amber-400" : "text-red-400")}>
                    {completionRate}%
                  </p>
                  <p className="text-[9px] text-white/40">Complete</p>
                </div>
              </div>

              {hasData ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-white/50">Completion Time</span>
                    <span className="text-white/70 tabular-nums">
                      p50: {formatDuration(item.p50_seconds)} · p90: {formatDuration(item.p90_seconds)}
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full bg-white/15"
                      initial={{ width: 0 }}
                      animate={{ width: `${p90Width}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.1 }}
                    />
                    <motion.div
                      className={cn("absolute inset-y-0 left-0 rounded-full bg-gradient-to-r", colors.bar)}
                      initial={{ width: 0 }}
                      animate={{ width: `${p50Width}%` }}
                      transition={{ duration: 0.8, delay: idx * 0.1 + 0.1 }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-2 text-white/30 text-xs">
                  No submissions yet
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ============================================================================
// ANNOUNCEMENT ENGAGEMENT SECTION
// ============================================================================

interface AnnouncementSectionProps {
  data: {
    total_views: number;
    unique_sessions: number;
    ai_generated_views: number;
  };
}

function AnnouncementSection({ data }: AnnouncementSectionProps) {
  const aiPercentage = data.total_views > 0
    ? Math.round((data.ai_generated_views / data.total_views) * 100)
    : 0;
  const humanViews = data.total_views - data.ai_generated_views;

  return (
    <motion.div
      variants={itemVariants}
      className="rounded-xl sm:rounded-2xl border border-purple-500/20 bg-gradient-to-br from-[#0f071a] via-[#080510] to-[#020205] p-3 sm:p-5"
    >
      {/* Compact mobile header */}
      <div className="flex items-center gap-2 mb-2 sm:mb-4">
        <div className="p-1.5 sm:p-2 rounded-lg bg-purple-500/10 text-purple-400">
          <Eye className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
        </div>
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-white">Announcements</h3>
          <p className="hidden sm:block text-xs text-white/40 mt-0.5">Views and engagement metrics</p>
        </div>
      </div>

      {/* Mobile: Inline compact stats */}
      <div className="sm:hidden flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-lg font-bold text-purple-400 tabular-nums">{data.total_views}</p>
            <p className="text-[8px] text-white/40">Views</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-emerald-400 tabular-nums">{data.ai_generated_views}</p>
            <p className="text-[8px] text-white/40">AI</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-amber-400 tabular-nums">{humanViews}</p>
            <p className="text-[8px] text-white/40">Human</p>
          </div>
        </div>
      </div>

      {/* Desktop: Full Grid */}
      <div className="hidden sm:grid sm:grid-cols-4 gap-3">
        <StatBox label="Total Views" value={data.total_views} color="purple" icon={<Eye className="w-3.5 h-3.5" />} />
        <StatBox label="Unique Sessions" value={data.unique_sessions} color="blue" icon={<Users className="w-3.5 h-3.5" />} />
        <StatBox 
          label="AI-Generated Views" 
          value={data.ai_generated_views} 
          subValue={`${aiPercentage}% of total`}
          color="emerald" 
          icon={<Zap className="w-3.5 h-3.5" />} 
        />
        <StatBox 
          label="Human-Authored Views" 
          value={humanViews} 
          subValue={`${100 - aiPercentage}% of total`}
          color="amber" 
          icon={<FileText className="w-3.5 h-3.5" />} 
        />
      </div>

      {/* View Distribution Bar - Compact on mobile */}
      <div className="pt-2 sm:mt-4 sm:pt-4 border-t border-white/10">
        <div className="hidden sm:flex items-center justify-between text-xs text-white/50 mb-2">
          <span>View Distribution</span>
          <span>AI vs Human-authored content</span>
        </div>
        <div className="relative h-2 sm:h-3 rounded-full bg-white/5 overflow-hidden flex">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
            initial={{ width: 0 }}
            animate={{ width: `${aiPercentage}%` }}
            transition={{ duration: 0.8 }}
          />
          <motion.div
            className="h-full bg-gradient-to-r from-amber-400 to-amber-500"
            initial={{ width: 0 }}
            animate={{ width: `${100 - aiPercentage}%` }}
            transition={{ duration: 0.8, delay: 0.2 }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 sm:mt-2 text-[9px] sm:text-[10px]">
          <span className="flex items-center gap-1 text-emerald-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            AI ({aiPercentage}%)
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Human ({100 - aiPercentage}%)
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// DUPLICATE DETECTION SECTION
// ============================================================================

interface DuplicateSectionProps {
  data: {
    detected: number;
    prevented: number;
    overridden: number;
  };
}

function DuplicateSection({ data }: DuplicateSectionProps) {
  const preventionRate = calculatePreventionRate(data.detected, data.prevented);
  const overrideRate = data.detected > 0 ? Math.round((data.overridden / data.detected) * 100) : 0;

  return (
    <motion.div
      variants={itemVariants}
      className="rounded-xl sm:rounded-2xl border border-amber-500/20 bg-gradient-to-br from-[#14100a] via-[#0a0805] to-[#020205] p-3 sm:p-5"
    >
      {/* Compact mobile header */}
      <div className="flex items-center gap-2 mb-2 sm:mb-4">
        <div className="p-1.5 sm:p-2 rounded-lg bg-amber-500/10 text-amber-400">
          <Shield className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
        </div>
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-white">Duplicate Detection</h3>
          <p className="hidden sm:block text-xs text-white/40 mt-0.5">Preventing duplicate submissions</p>
        </div>
      </div>

      {/* Mobile: Compact inline stats */}
      <div className="sm:hidden flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-lg font-bold text-amber-400 tabular-nums">{data.detected}</p>
            <p className="text-[8px] text-white/40">Detected</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-emerald-400 tabular-nums">{data.prevented}</p>
            <p className="text-[8px] text-white/40">Blocked</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-red-400 tabular-nums">{data.overridden}</p>
            <p className="text-[8px] text-white/40">Override</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-emerald-400">{preventionRate}%</p>
          <p className="text-[8px] text-white/40">Block rate</p>
        </div>
      </div>

      {/* Desktop: Full Grid */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-3 mb-4">
        <StatBox label="Detected" value={data.detected} color="amber" icon={<AlertTriangle className="w-3.5 h-3.5" />} />
        <StatBox 
          label="Prevented" 
          value={data.prevented} 
          subValue={`${preventionRate}% rate`}
          color="emerald" 
          icon={<CheckCircle2 className="w-3.5 h-3.5" />} 
        />
        <StatBox 
          label="Overridden" 
          value={data.overridden}
          subValue={`${overrideRate}% rate`}
          color="red" 
          icon={<XCircle className="w-3.5 h-3.5" />} 
        />
      </div>

      {data.detected > 0 && (
        <div className="pt-2 sm:pt-3 border-t border-white/10">
          <div className="flex items-center justify-between text-[10px] sm:text-xs">
            <span className="text-white/50">Estimated time saved</span>
            <span className="text-emerald-400 font-medium">~{Math.round(data.prevented * 5)} min</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// ACTIVITY TIMELINE SECTION
// ============================================================================

interface TimelineSectionProps {
  data: Array<{
    day: string;
    form_submissions: number;
    form_errors: number;
    announcement_views: number;
  }>;
}

function TimelineSection({ data }: TimelineSectionProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeMetric, setActiveMetric] = useState<'submissions' | 'views' | 'errors' | 'all'>('all');
  
  const chartData = useMemo(() => {
    const filledData = [...data].slice(-14);
    while (filledData.length < 14) {
      const firstDate = filledData.length > 0 ? new Date(filledData[0].day) : new Date();
      firstDate.setDate(firstDate.getDate() - 1);
      filledData.unshift({
        day: firstDate.toISOString().split('T')[0],
        form_submissions: 0,
        form_errors: 0,
        announcement_views: 0,
      });
    }
    return filledData;
  }, [data]);

  const maxValue = Math.max(
    ...chartData.map((d) => Math.max(
      activeMetric === 'views' || activeMetric === 'errors' ? 0 : d.form_submissions,
      activeMetric === 'submissions' || activeMetric === 'errors' ? 0 : d.announcement_views,
      activeMetric === 'submissions' || activeMetric === 'views' ? 0 : d.form_errors
    )),
    1
  );

  const totals = useMemo(() => ({
    submissions: chartData.reduce((sum, d) => sum + d.form_submissions, 0),
    views: chartData.reduce((sum, d) => sum + d.announcement_views, 0),
    errors: chartData.reduce((sum, d) => sum + d.form_errors, 0),
  }), [chartData]);

  const createPath = useCallback((metric: 'form_submissions' | 'announcement_views' | 'form_errors'): { linePath: string; areaPath: string } => {
    if (chartData.length === 0) return { linePath: '', areaPath: '' };
    
    const width = 100;
    const height = 100;
    const padding = 2;
    const effectiveWidth = width - padding * 2;
    const effectiveHeight = height - padding * 2;
    
    const points = chartData.map((d, i) => {
      const x = padding + (i / (chartData.length - 1)) * effectiveWidth;
      const value = d[metric];
      const y = height - padding - (value / maxValue) * effectiveHeight;
      return { x, y: isNaN(y) ? height - padding : y };
    });
    
    const linePath = points.map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = points[i - 1];
      const cpX = (prev.x + p.x) / 2;
      return `C ${cpX} ${prev.y}, ${cpX} ${p.y}, ${p.x} ${p.y}`;
    }).join(' ');
    
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`;
    
    return { linePath, areaPath };
  }, [chartData, maxValue]);

  const submissionPaths = createPath('form_submissions');
  const viewPaths = createPath('announcement_views');
  const errorPaths = createPath('form_errors');

  return (
    <motion.div
      variants={itemVariants}
      className="rounded-xl sm:rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-[#07140f] via-[#050a0f] to-[#020205] p-3 sm:p-5"
    >
      {/* Compact mobile header with inline filter */}
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <BarChart3 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-white">Activity Timeline</h3>
            <p className="hidden sm:block text-xs text-white/40 mt-0.5">Events over the last 14 days</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/5 border border-white/10">
          {[
            { id: 'all', label: 'All', mobileLabel: '•' },
            { id: 'submissions', label: 'Forms', mobileLabel: 'F' },
            { id: 'views', label: 'Views', mobileLabel: 'V' },
            { id: 'errors', label: 'Errors', mobileLabel: 'E' },
          ].map((option) => (
            <button
              key={option.id}
              onClick={() => setActiveMetric(option.id as typeof activeMetric)}
              className={cn(
                "px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[9px] sm:text-[10px] font-medium transition-all",
                activeMetric === option.id
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-white/50"
              )}
            >
              <span className="sm:hidden">{option.mobileLabel}</span>
              <span className="hidden sm:inline">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats - Compact on mobile */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4">
        <motion.div 
          className={cn(
            "rounded-lg sm:rounded-xl p-1.5 sm:p-2.5 border transition-all cursor-pointer",
            activeMetric === 'submissions' || activeMetric === 'all'
              ? "bg-emerald-500/10 border-emerald-500/30"
              : "bg-white/5 border-white/10"
          )}
          onClick={() => setActiveMetric(activeMetric === 'submissions' ? 'all' : 'submissions')}
          whileHover={{ scale: 1.02 }}
        >
          <div className="flex items-center gap-1 mb-0.5">
            <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-emerald-400" />
            <span className="text-[8px] sm:text-[9px] text-white/50 uppercase">Subs</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-white tabular-nums">{totals.submissions}</p>
        </motion.div>
        <motion.div 
          className={cn(
            "rounded-lg sm:rounded-xl p-1.5 sm:p-2.5 border transition-all cursor-pointer",
            activeMetric === 'views' || activeMetric === 'all'
              ? "bg-blue-500/10 border-blue-500/30"
              : "bg-white/5 border-white/10"
          )}
          onClick={() => setActiveMetric(activeMetric === 'views' ? 'all' : 'views')}
          whileHover={{ scale: 1.02 }}
        >
          <div className="flex items-center gap-1 mb-0.5">
            <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-blue-400" />
            <span className="text-[8px] sm:text-[9px] text-white/50 uppercase">Views</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-white tabular-nums">{totals.views}</p>
        </motion.div>
        <motion.div 
          className={cn(
            "rounded-lg sm:rounded-xl p-1.5 sm:p-2.5 border transition-all cursor-pointer",
            activeMetric === 'errors' || activeMetric === 'all'
              ? "bg-red-500/10 border-red-500/30"
              : "bg-white/5 border-white/10"
          )}
          onClick={() => setActiveMetric(activeMetric === 'errors' ? 'all' : 'errors')}
          whileHover={{ scale: 1.02 }}
        >
          <div className="flex items-center gap-1 mb-0.5">
            <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-red-400" />
            <span className="text-[8px] sm:text-[9px] text-white/50 uppercase">Errors</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-white tabular-nums">{totals.errors}</p>
        </motion.div>
      </div>

      {/* Chart - Shorter on mobile */}
      <div className="relative h-28 sm:h-40">
        <div className="absolute left-0 top-0 bottom-5 w-6 flex flex-col justify-between text-[9px] text-white/30 tabular-nums">
          <span>{maxValue}</span>
          <span>{Math.round(maxValue / 2)}</span>
          <span>0</span>
        </div>

        <div className="absolute left-8 right-0 top-0 bottom-0">
          <div className="absolute inset-0 bottom-5 flex flex-col justify-between pointer-events-none">
            {[0, 1, 2].map((i) => (
              <div key={i} className="border-t border-white/5 w-full" />
            ))}
          </div>

          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 bottom-5 w-full h-full overflow-visible">
            <defs>
              <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(52, 211, 153)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="rgb(52, 211, 153)" stopOpacity="0.05" />
              </linearGradient>
              <linearGradient id="viewGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(96, 165, 250)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="rgb(96, 165, 250)" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(248, 113, 113)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="rgb(248, 113, 113)" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            <AnimatePresence>
              {(activeMetric === 'views' || activeMetric === 'all') && (
                <motion.path d={viewPaths.areaPath} fill="url(#viewGrad)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
              )}
              {(activeMetric === 'errors' || activeMetric === 'all') && (
                <motion.path d={errorPaths.areaPath} fill="url(#errGrad)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
              )}
              {(activeMetric === 'submissions' || activeMetric === 'all') && (
                <motion.path d={submissionPaths.areaPath} fill="url(#subGrad)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
              )}
              {(activeMetric === 'views' || activeMetric === 'all') && (
                <motion.path d={viewPaths.linePath} fill="none" stroke="rgb(96, 165, 250)" strokeWidth="0.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }} />
              )}
              {(activeMetric === 'errors' || activeMetric === 'all') && (
                <motion.path d={errorPaths.linePath} fill="none" stroke="rgb(248, 113, 113)" strokeWidth="0.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }} />
              )}
              {(activeMetric === 'submissions' || activeMetric === 'all') && (
                <motion.path d={submissionPaths.linePath} fill="none" stroke="rgb(52, 211, 153)" strokeWidth="0.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }} />
              )}
            </AnimatePresence>
          </svg>

          {/* Hover zones */}
          <div className="absolute inset-0 bottom-5 flex">
            {chartData.map((entry, idx) => (
              <div
                key={entry.day}
                className="flex-1 relative"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <AnimatePresence>
                  {hoveredIndex === idx && (
                    <>
                      <motion.div
                        className="absolute top-0 bottom-0 left-1/2 w-px bg-white/20"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      />
                      <motion.div
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                      >
                        <div className="bg-black/90 border border-white/20 rounded-lg px-2.5 py-1.5 text-[10px] whitespace-nowrap">
                          <p className="font-medium text-white mb-1">
                            {new Date(entry.day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
                          <div className="space-y-0.5">
                            <div className="flex justify-between gap-3">
                              <span className="text-emerald-400">Submissions</span>
                              <span className="text-white tabular-nums">{entry.form_submissions}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-blue-400">Views</span>
                              <span className="text-white tabular-nums">{entry.announcement_views}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-red-400">Errors</span>
                              <span className="text-white tabular-nums">{entry.form_errors}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          {/* X-axis */}
          <div className="absolute bottom-0 left-0 right-0 h-5 flex justify-between text-[9px] text-white/30">
            {chartData.filter((_, i) => i === 0 || i === 6 || i === 13).map((entry) => (
              <span key={entry.day}>
                {new Date(entry.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// RAW EVENTS LOG SECTION
// ============================================================================

interface RawEventsLogProps {
  events: RawTelemetryEvent[];
  isLoading: boolean;
}

function RawEventsLog({ events, isLoading }: RawEventsLogProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter(e => e.event_name === filter);
  }, [events, filter]);

  const eventTypes = useMemo(() => {
    const types = new Set(events.map(e => e.event_name));
    return Array.from(types);
  }, [events]);

  return (
    <motion.div
      variants={itemVariants}
      className="rounded-xl sm:rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a0a0f] via-[#050508] to-[#020205] p-3 sm:p-5"
    >
      <div className="flex items-center justify-between gap-2 mb-2 sm:mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 sm:p-2 rounded-lg bg-white/5 text-white/60">
            <List className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-white">Events</h3>
            <p className="hidden sm:block text-xs text-white/40 mt-0.5">{events.length} recent</p>
          </div>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-1.5 py-0.5 text-[10px] sm:text-xs text-white/70 focus:outline-none"
        >
          <option value="all">All</option>
          {eventTypes.map(type => (
            <option key={type} value={type}>{EVENT_TYPE_META[type]?.label?.substring(0, 10) || type}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-1.5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-4 text-white/40 text-xs">
          No events found
        </div>
      ) : (
        <div className="space-y-1 max-h-[200px] sm:max-h-[300px] overflow-y-auto pr-0.5">
          {filteredEvents.slice(0, 20).map((event) => {
            const meta = EVENT_TYPE_META[event.event_name];
            const isExpanded = expanded === event.id;
            const colorClass = {
              emerald: "border-emerald-500/30 bg-emerald-500/5",
              blue: "border-blue-500/30 bg-blue-500/5",
              red: "border-red-500/30 bg-red-500/5",
              amber: "border-amber-500/30 bg-amber-500/5",
              purple: "border-purple-500/30 bg-purple-500/5",
            }[meta?.color || 'blue'];

            return (
              <motion.div
                key={event.id}
                layout
                className={cn(
                  "rounded-md border p-2 cursor-pointer transition-all",
                  colorClass,
                  isExpanded && "ring-1 ring-white/20"
                )}
                onClick={() => setExpanded(isExpanded ? null : event.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn("p-1 rounded bg-white/5 shrink-0", `text-${meta?.color || 'blue'}-400`)}>
                      {meta?.icon || <Activity className="w-3 h-3" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-xs font-medium text-white truncate">{meta?.label || event.event_name}</p>
                      <p className="text-[9px] text-white/40 truncate">
                        {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {event.form_type && ` · ${FORM_TYPE_LABELS[event.form_type] || event.form_type}`}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3 text-white/40 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-white/40 shrink-0" />
                  )}
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                        <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                          <div>
                            <span className="text-white/40">Session:</span>
                            <p className="text-white/70 font-mono truncate">{event.session_id?.slice(-8)}</p>
                          </div>
                          <div>
                            <span className="text-white/40">User:</span>
                            <p className="text-white/70 font-mono truncate">{event.user_id?.slice(-8) || 'Anon'}</p>
                          </div>
                        </div>
                        <div>
                          <span className="text-[9px] text-white/40">Properties:</span>
                          <pre className="mt-1 p-1.5 rounded bg-black/30 text-[9px] text-white/60 font-mono overflow-x-auto max-h-24">
                            {JSON.stringify(event.properties, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// ROUTE ANALYTICS SECTION
// ============================================================================

interface RouteAnalyticsProps {
  routes: Array<{ route: string; event_count: number; unique_sessions: number }>;
  isLoading: boolean;
}

function RouteAnalytics({ routes, isLoading }: RouteAnalyticsProps) {
  const maxCount = Math.max(...routes.map(r => r.event_count), 1);

  return (
    <motion.div
      variants={itemVariants}
      className="rounded-xl sm:rounded-2xl border border-blue-500/20 bg-gradient-to-br from-[#070a14] via-[#050508] to-[#020205] p-3 sm:p-5"
    >
      <div className="flex items-center gap-2 mb-2 sm:mb-4">
        <div className="p-1.5 sm:p-2 rounded-lg bg-blue-500/10 text-blue-400">
          <MapPin className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
        </div>
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-white">Routes</h3>
          <p className="hidden sm:block text-xs text-white/40 mt-0.5">Events by page</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-1.5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-6 rounded bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : routes.length === 0 ? (
        <div className="text-center py-4 text-white/40 text-xs">No route data</div>
      ) : (
        <div className="space-y-1.5">
          {routes.slice(0, 6).map((route, idx) => {
            const width = (route.event_count / maxCount) * 100;
            return (
              <motion.div
                key={route.route}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] sm:text-xs text-white/70 truncate font-mono">{route.route}</span>
                  <span className="text-[9px] sm:text-[10px] text-white/50 tabular-nums ml-2 shrink-0">
                    {route.event_count}
                  </span>
                </div>
                <div className="h-1 sm:h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${width}%` }}
                    transition={{ duration: 0.5, delay: idx * 0.05 }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// ERROR BREAKDOWN SECTION
// ============================================================================

interface ErrorBreakdownSectionProps {
  errors: Array<{ form_type: string | null; error_code: string | null; field_name: string | null; count: number }>;
  isLoading: boolean;
}

function ErrorBreakdownSection({ errors, isLoading }: ErrorBreakdownSectionProps) {
  return (
    <motion.div
      variants={itemVariants}
      className="rounded-xl sm:rounded-2xl border border-red-500/20 bg-gradient-to-br from-[#140a0a] via-[#0a0505] to-[#020205] p-3 sm:p-5"
    >
      <div className="flex items-center gap-2 mb-2 sm:mb-4">
        <div className="p-1.5 sm:p-2 rounded-lg bg-red-500/10 text-red-400">
          <AlertTriangle className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
        </div>
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-white">Errors</h3>
          <p className="hidden sm:block text-xs text-white/40 mt-0.5">Form submission errors</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-1.5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 rounded bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : errors.length === 0 ? (
        <div className="text-center py-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-400/50 mx-auto mb-1" />
          <p className="text-xs text-white/50">No errors</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {errors.slice(0, 5).map((error, idx) => (
            <motion.div
              key={`${error.form_type}-${error.error_code}-${error.field_name}`}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center justify-between p-2 rounded-lg bg-red-500/5 border border-red-500/20"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1 rounded bg-red-500/10 text-red-400 shrink-0">
                  <XCircle className="w-3 h-3" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-medium text-white truncate">
                    {error.error_code || 'Unknown'}
                  </p>
                  <p className="text-[9px] text-white/40 truncate">
                    {error.form_type ? FORM_TYPE_LABELS[error.form_type] : 'Unknown'}
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-red-400 tabular-nums shrink-0 ml-2">{error.count}</span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// LOADING SKELETON
// ============================================================================

function TelemetrySkeleton() {
  return (
    <div className="space-y-3 sm:space-y-6 animate-pulse">
      {/* Stats Strip */}
      <div className="h-8 sm:hidden rounded-lg bg-white/5 border border-white/10" />
      <div className="hidden sm:grid sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-white/5 border border-white/10" />
        ))}
      </div>
      {/* Form Performance */}
      <div className="h-32 sm:h-60 rounded-xl bg-white/5 border border-white/10" />
      {/* Timeline */}
      <div className="h-40 sm:h-56 rounded-xl bg-white/5 border border-white/10" />
      {/* Two columns */}
      <div className="grid grid-cols-2 gap-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-32 sm:h-48 rounded-xl bg-white/5 border border-white/10" />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AdminTelemetry() {
  const [selectedDays, setSelectedDays] = useState(14);
  const [now] = useState(() => Date.now());

  const dateRange = useMemo<DateRange>(() => ({
    from: new Date(now - selectedDays * 24 * 60 * 60 * 1000),
    to: new Date(now),
  }), [selectedDays, now]);

  // Fetch all data
  const { data, isLoading, error, refetch, isRefetching } = useTelemetryStats(dateRange);
  const { data: rawEvents, isLoading: rawEventsLoading } = useRawTelemetryEvents(100);
  const { data: errorBreakdown, isLoading: errorsLoading } = useErrorBreakdown();
  const { data: routeStats, isLoading: routesLoading } = useRouteStats();

  const hasData = data && data.summary.total_events > 0;

  return (
    <DashboardLayout title="Telemetry Dashboard">
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-5">
        {/* Compact Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-2"
        >
          {/* Title - hidden on mobile since navbar shows it */}
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-400" />
              <h1 className="text-xl sm:text-2xl font-bold text-white">Telemetry Dashboard</h1>
            </div>
            <p className="text-sm text-white/50 mt-1">
              Complete analytics for forms, announcements, and system health
            </p>
          </div>

          {/* Mobile-only compact date selector */}
          <div className="flex sm:hidden items-center gap-1 p-0.5 rounded-lg bg-white/5 border border-white/10 overflow-x-auto">
            {DATE_RANGE_OPTIONS.map((option) => (
              <button
                key={option.days}
                onClick={() => setSelectedDays(option.days)}
                className={cn(
                  "px-2 py-1 rounded-md text-[10px] font-medium transition-all whitespace-nowrap",
                  selectedDays === option.days
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-white/50"
                )}
              >
                {option.days}d
              </button>
            ))}
          </div>

          {/* Desktop date selector */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
              {DATE_RANGE_OPTIONS.map((option) => (
                <button
                  key={option.days}
                  onClick={() => setSelectedDays(option.days)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    selectedDays === option.days
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "text-white/50 hover:text-white/70 hover:bg-white/5"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className={cn(
                "p-2 rounded-xl bg-white/5 border border-white/10 text-white/50",
                "hover:text-white/70 hover:bg-white/10 transition-all",
                isRefetching && "animate-spin"
              )}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile refresh button */}
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className={cn(
              "sm:hidden p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50",
              isRefetching && "animate-spin"
            )}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </motion.div>

        {/* Content */}
        {isLoading ? (
          <TelemetrySkeleton />
        ) : error ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center"
          >
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white mb-2">Error Loading Data</h3>
            <p className="text-sm text-white/60 mb-4">{error.message}</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 rounded-xl bg-red-500/20 text-red-300 text-sm font-medium hover:bg-red-500/30 transition-colors"
            >
              Try Again
            </button>
          </motion.div>
        ) : !hasData ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
              <Activity className="w-8 h-8 text-emerald-400/60" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Telemetry Data Yet</h3>
            <p className="text-sm text-white/50 max-w-md">
              Telemetry data will appear here once users start interacting with forms and announcements.
            </p>
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-5"
          >
            {/* Summary Stats */}
            <SummarySection data={data} />

            {/* Form Performance */}
            <FormPerformanceSection 
              completionTimes={data.forms.completion_times} 
              byType={data.forms.by_type} 
            />

            {/* Activity Timeline */}
            <TimelineSection data={data.timeline} />

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
              <AnnouncementSection data={data.announcements} />
              <DuplicateSection data={data.duplicates} />
            </div>

            {/* Three Column Layout - Horizontal scroll on mobile */}
            <div className="sm:hidden overflow-x-auto -mx-4 px-4 pb-2">
              <div className="flex gap-3 min-w-max">
                <div className="w-64 shrink-0">
                  <RouteAnalytics routes={routeStats || []} isLoading={routesLoading} />
                </div>
                <div className="w-56 shrink-0">
                  <ErrorBreakdownSection errors={errorBreakdown || []} isLoading={errorsLoading} />
                </div>
                <div className="w-64 shrink-0">
                  <RawEventsLog events={rawEvents || []} isLoading={rawEventsLoading} />
                </div>
              </div>
            </div>
            <div className="hidden sm:grid lg:grid-cols-3 gap-5">
              <RouteAnalytics routes={routeStats || []} isLoading={routesLoading} />
              <ErrorBreakdownSection errors={errorBreakdown || []} isLoading={errorsLoading} />
              <RawEventsLog events={rawEvents || []} isLoading={rawEventsLoading} />
            </div>

            {/* Compact Footer */}
            <motion.div
              variants={itemVariants}
              className="text-center text-[10px] sm:text-xs text-white/30 pt-3 sm:pt-4 border-t border-white/5"
            >
              <p>
                {new Date(data.period.from).toLocaleDateString()} → {new Date(data.period.to).toLocaleDateString()} · {data.summary.total_events} events
              </p>
              <p className="mt-0.5 hidden sm:block">
                Privacy: All data is aggregated per GDPR compliance.
              </p>
            </motion.div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
