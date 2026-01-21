/**
 * RiskCalibrationDashboard - Automated Risk Algorithm Tuning Dashboard
 *
 * Provides visibility into the zero-touch continuous improvement loop:
 * - Auto-tuning status and toggle
 * - Accuracy metrics
 * - Tuning timeline and decisions
 * - Risk score history
 * - Incident logging
 *
 * NO approval workflow - system is fully autonomous.
 *
 * @module RiskCalibrationDashboard
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Settings,
  Shield,
  Target,
  TrendingDown,
  XCircle,
  Zap,
  Plus,
} from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { cn } from "../../lib/utils";
import {
  useAutoTuningConfig,
  useToggleAutoTuning,
  useRecentTuningDecisions,
  useAccuracyStats,
  useRiskScoreHistory,
  useActiveAlgorithmConfig,
  useSafetyIncidents,
  useInvalidateRiskCalibration,
} from "../../hooks/queries/useRiskCalibration";
import IncidentLoggingModal from "../../components/admin/IncidentLoggingModal";

// ============================================================================
// CONSTANTS
// ============================================================================

const DATE_RANGE_OPTIONS = [
  { label: "7 Days", days: 7 },
  { label: "14 Days", days: 14 },
  { label: "30 Days", days: 30 },
  { label: "90 Days", days: 90 },
];

const DECISION_TYPE_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  adjustment: { label: "Adjustment", color: "blue", icon: <Settings className="w-3.5 h-3.5" /> },
  activation: { label: "Activated", color: "emerald", icon: <Zap className="w-3.5 h-3.5" /> },
  rollback: { label: "Rollback", color: "red", icon: <TrendingDown className="w-3.5 h-3.5" /> },
  no_action: { label: "No Action", color: "gray", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  disabled: { label: "Disabled", color: "amber", icon: <PauseCircle className="w-3.5 h-3.5" /> },
};

const RISK_LEVEL_COLORS: Record<string, string> = {
  LOW: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  MODERATE: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  ELEVATED: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  HIGH: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  CRITICAL: "text-red-400 bg-red-500/10 border-red-500/30",
};

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
};

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

interface StatBoxProps {
  label: string;
  value: string | number;
  subValue?: string;
  color?: "emerald" | "blue" | "amber" | "red" | "purple" | "orange";
  icon?: React.ReactNode;
}

function StatBox({ label, value, subValue, color = "emerald", icon }: StatBoxProps) {
  const colorClasses = {
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    blue: "border-blue-500/30 bg-blue-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    red: "border-red-500/30 bg-red-500/5",
    purple: "border-purple-500/30 bg-purple-500/5",
    orange: "border-orange-500/30 bg-orange-500/5",
  };
  
  const textClasses = {
    emerald: "text-emerald-400",
    blue: "text-blue-400",
    amber: "text-amber-400",
    red: "text-red-400",
    purple: "text-purple-400",
    orange: "text-orange-400",
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
// AUTO-TUNING STATUS CARD
// ============================================================================

function AutoTuningStatusCard() {
  const { data: config, isLoading } = useAutoTuningConfig();
  const { data: activeConfig } = useActiveAlgorithmConfig();
  const toggleMutation = useToggleAutoTuning();

  const handleToggle = () => {
    if (config) {
      toggleMutation.mutate(!config.enabled);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 animate-pulse">
        <div className="h-6 w-32 bg-white/10 rounded mb-3" />
        <div className="h-10 w-24 bg-white/10 rounded" />
      </div>
    );
  }

  const isEnabled = config?.enabled ?? false;

  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        "rounded-xl sm:rounded-2xl border p-4 sm:p-5",
        isEnabled
          ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent"
          : "border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            isEnabled ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
          )}>
            {isEnabled ? <PlayCircle className="w-5 h-5" /> : <PauseCircle className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Auto-Tuning</h3>
            <p className={cn(
              "text-sm font-medium",
              isEnabled ? "text-emerald-400" : "text-amber-400"
            )}>
              {isEnabled ? "Active" : "Paused"}
            </p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={toggleMutation.isPending}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all",
            isEnabled
              ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30"
              : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30",
            toggleMutation.isPending && "opacity-50 cursor-not-allowed"
          )}
        >
          {toggleMutation.isPending ? "..." : isEnabled ? "Pause" : "Enable"}
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-white/40">Current Version</span>
          <p className="text-white font-medium mt-0.5">{activeConfig?.version || "v1"}</p>
        </div>
        <div>
          <span className="text-white/40">Accuracy Threshold</span>
          <p className="text-white font-medium mt-0.5">{config?.min_accuracy_threshold || 75}%</p>
        </div>
        <div>
          <span className="text-white/40">Rollback Threshold</span>
          <p className="text-white font-medium mt-0.5">{config?.rollback_threshold || 10}%</p>
        </div>
        <div>
          <span className="text-white/40">Eval Period</span>
          <p className="text-white font-medium mt-0.5">{config?.evaluation_period_days || 30} days</p>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// ACCURACY METRICS CARD
// ============================================================================

function AccuracyMetricsCard({ days }: { days: number }) {
  const { data: stats, isLoading } = useAccuracyStats(days);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 animate-pulse">
        <div className="h-6 w-40 bg-white/10 rounded mb-4" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-white/10 rounded" />
          ))}
        </div>
      </div>
    );
  }

  const accuracyRate = stats?.accuracy_rate ?? 0;
  const isGoodAccuracy = accuracyRate >= 75;

  return (
    <motion.div
      variants={itemVariants}
      className="rounded-xl sm:rounded-2xl border border-blue-500/20 bg-gradient-to-br from-[#070a14] via-[#050508] to-[#020205] p-4 sm:p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Prediction Accuracy</h3>
            <p className="text-xs text-white/40">Last {days} days</p>
          </div>
        </div>
        <div className={cn(
          "px-3 py-1.5 rounded-lg text-lg font-bold",
          isGoodAccuracy
            ? "bg-emerald-500/20 text-emerald-400"
            : "bg-amber-500/20 text-amber-400"
        )}>
          {accuracyRate.toFixed(1)}%
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox
          label="True Positives"
          value={stats?.true_positives ?? 0}
          subValue="High risk + incident"
          color="emerald"
          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
        />
        <StatBox
          label="False Positives"
          value={stats?.false_positives ?? 0}
          subValue="High risk, no incident"
          color="amber"
          icon={<AlertTriangle className="w-3.5 h-3.5" />}
        />
        <StatBox
          label="False Negatives"
          value={stats?.false_negatives ?? 0}
          subValue="Low risk + incident"
          color="red"
          icon={<XCircle className="w-3.5 h-3.5" />}
        />
        <StatBox
          label="True Negatives"
          value={stats?.true_negatives ?? 0}
          subValue="Low risk, no incident"
          color="blue"
          icon={<Shield className="w-3.5 h-3.5" />}
        />
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-white/50">Prediction Distribution</span>
          <span className="text-white/70">
            {stats?.total_days ?? 0} days analyzed
          </span>
        </div>
        <div className="relative h-3 rounded-full bg-white/5 overflow-hidden flex">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
            initial={{ width: 0 }}
            animate={{ width: `${((stats?.true_positives ?? 0) + (stats?.true_negatives ?? 0)) / Math.max(stats?.total_days ?? 1, 1) * 100}%` }}
            transition={{ duration: 0.8 }}
          />
          <motion.div
            className="h-full bg-gradient-to-r from-red-400 to-red-500"
            initial={{ width: 0 }}
            animate={{ width: `${((stats?.false_positives ?? 0) + (stats?.false_negatives ?? 0)) / Math.max(stats?.total_days ?? 1, 1) * 100}%` }}
            transition={{ duration: 0.8, delay: 0.2 }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[10px]">
          <span className="flex items-center gap-1 text-emerald-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Correct Predictions
          </span>
          <span className="flex items-center gap-1 text-red-400">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
            Incorrect Predictions
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// TUNING TIMELINE
// ============================================================================

function TuningTimeline() {
  const { data: decisions, isLoading } = useRecentTuningDecisions(15);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 animate-pulse">
        <div className="h-6 w-32 bg-white/10 rounded mb-4" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-white/10 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={itemVariants}
      className="rounded-xl sm:rounded-2xl border border-purple-500/20 bg-gradient-to-br from-[#0f071a] via-[#080510] to-[#020205] p-4 sm:p-5"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
          <Clock className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">Tuning Timeline</h3>
          <p className="text-xs text-white/40">Recent algorithm decisions</p>
        </div>
      </div>

      {!decisions || decisions.length === 0 ? (
        <div className="text-center py-8 text-white/40 text-sm">
          No tuning decisions yet
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {decisions.map((decision) => {
            const meta = DECISION_TYPE_META[decision.decision_type] || DECISION_TYPE_META.no_action;
            const isExpanded = expanded === decision.id;
            const colorClass = {
              emerald: "border-emerald-500/30 bg-emerald-500/5",
              blue: "border-blue-500/30 bg-blue-500/5",
              red: "border-red-500/30 bg-red-500/5",
              amber: "border-amber-500/30 bg-amber-500/5",
              gray: "border-white/10 bg-white/5",
            }[meta.color] || "border-white/10 bg-white/5";

            return (
              <motion.div
                key={decision.id}
                layout
                className={cn(
                  "rounded-lg border p-3 cursor-pointer transition-all",
                  colorClass,
                  isExpanded && "ring-1 ring-white/20"
                )}
                onClick={() => setExpanded(isExpanded ? null : decision.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn(
                      "p-1.5 rounded bg-white/5 shrink-0",
                      `text-${meta.color}-400`
                    )}>
                      {meta.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white">{meta.label}</p>
                      <p className="text-[10px] text-white/40 truncate">
                        {new Date(decision.decision_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        {decision.factor_adjusted && ` · ${decision.factor_adjusted}`}
                      </p>
                    </div>
                  </div>
                  {decision.old_value !== null && decision.new_value !== null && (
                    <div className="flex items-center gap-1 text-[10px] shrink-0">
                      <span className="text-white/50">{decision.old_value}</span>
                      <ChevronRight className="w-3 h-3 text-white/30" />
                      <span className="text-white font-medium">{decision.new_value}</span>
                    </div>
                  )}
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-white/40 shrink-0 ml-2" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-white/40 shrink-0 ml-2" />
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
                      <div className="mt-3 pt-3 border-t border-white/10 text-xs">
                        {decision.adjustment_reason && (
                          <p className="text-white/60 mb-2">{decision.adjustment_reason}</p>
                        )}
                        <div className="flex items-center justify-between text-[10px] text-white/40">
                          <span>By: {decision.decision_maker}</span>
                          {decision.confidence_score && (
                            <span>Confidence: {(decision.confidence_score * 100).toFixed(0)}%</span>
                          )}
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
// RISK LEVEL DISTRIBUTION
// ============================================================================

function RiskLevelDistribution({ dateRange }: { dateRange: { start: string; end: string } }) {
  const { data: history, isLoading } = useRiskScoreHistory(dateRange);

  const distribution = useMemo(() => {
    if (!history || history.length === 0) return [];
    
    const counts: Record<string, number> = {
      LOW: 0,
      MODERATE: 0,
      ELEVATED: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    
    history.forEach((h) => {
      counts[h.risk_level] = (counts[h.risk_level] || 0) + 1;
    });
    
    const total = history.length;
    return Object.entries(counts).map(([level, count]) => ({
      level,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }));
  }, [history]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 animate-pulse">
        <div className="h-6 w-40 bg-white/10 rounded mb-4" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-6 bg-white/10 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={itemVariants}
      className="rounded-xl sm:rounded-2xl border border-amber-500/20 bg-gradient-to-br from-[#14100a] via-[#0a0805] to-[#020205] p-4 sm:p-5"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
          <BarChart3 className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">Risk Level Distribution</h3>
          <p className="text-xs text-white/40">{history?.length || 0} forecasts</p>
        </div>
      </div>

      {distribution.length === 0 ? (
        <div className="text-center py-8 text-white/40 text-sm">
          No risk history data yet
        </div>
      ) : (
        <div className="space-y-2.5">
          {distribution.map(({ level, count, percentage }, idx) => (
            <div key={level}>
              <div className="flex items-center justify-between mb-1">
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded border",
                  RISK_LEVEL_COLORS[level]
                )}>
                  {level}
                </span>
                <span className="text-xs text-white/60 tabular-nums">
                  {count} ({percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    level === "LOW" && "bg-emerald-400",
                    level === "MODERATE" && "bg-blue-400",
                    level === "ELEVATED" && "bg-amber-400",
                    level === "HIGH" && "bg-orange-400",
                    level === "CRITICAL" && "bg-red-400"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, delay: idx * 0.05 }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// INCIDENTS SUMMARY
// ============================================================================

function IncidentsSummary({ 
  dateRange, 
  onLogIncident 
}: { 
  dateRange: { start: string; end: string };
  onLogIncident: () => void;
}) {
  const { data: incidents, isLoading } = useSafetyIncidents(dateRange);

  const summary = useMemo(() => {
    if (!incidents) return { total: 0, bySeverity: {}, forecasted: 0 };
    
    const bySeverity: Record<string, number> = {};
    let forecasted = 0;
    
    incidents.forEach((i) => {
      bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;
      if (i.was_forecasted_high_risk) forecasted++;
    });
    
    return { total: incidents.length, bySeverity, forecasted };
  }, [incidents]);

  const forecastedRate = summary.total > 0 
    ? ((summary.forecasted / summary.total) * 100).toFixed(1) 
    : "0";

  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 animate-pulse">
        <div className="h-6 w-40 bg-white/10 rounded mb-4" />
        <div className="h-24 bg-white/10 rounded" />
      </div>
    );
  }

  return (
    <motion.div
      variants={itemVariants}
      className="rounded-xl sm:rounded-2xl border border-red-500/20 bg-gradient-to-br from-[#140a0a] via-[#0a0505] to-[#020205] p-4 sm:p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Safety Incidents</h3>
            <p className="text-xs text-white/40">{summary.total} logged</p>
          </div>
        </div>
        <button
          onClick={onLogIncident}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-xs font-medium hover:bg-red-500/30 transition-colors border border-red-500/30"
        >
          <Plus className="w-3.5 h-3.5" />
          Log Incident
        </button>
      </div>

      {summary.total === 0 ? (
        <div className="text-center py-6 text-white/40 text-sm">
          No incidents logged in this period
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <p className="text-2xl font-bold text-white">{summary.total}</p>
              <p className="text-[10px] text-white/40 uppercase">Total Incidents</p>
            </div>
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{forecastedRate}%</p>
              <p className="text-[10px] text-white/40 uppercase">Forecasted</p>
            </div>
          </div>

          <div className="space-y-1.5">
            {Object.entries(summary.bySeverity).map(([severity, count]) => (
              <div key={severity} className="flex items-center justify-between text-xs">
                <span className="text-white/60 capitalize">{severity.replace('_', ' ')}</span>
                <span className="text-white font-medium">{count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}

// ============================================================================
// LOADING SKELETON
// ============================================================================

function CalibrationSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6 animate-pulse">
      <div className="h-32 rounded-xl bg-white/5 border border-white/10" />
      <div className="h-48 rounded-xl bg-white/5 border border-white/10" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-64 rounded-xl bg-white/5 border border-white/10" />
        <div className="h-64 rounded-xl bg-white/5 border border-white/10" />
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RiskCalibrationDashboard() {
  const [selectedDays, setSelectedDays] = useState(30);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const invalidateAll = useInvalidateRiskCalibration();

  // Calculate date range - intentionally recalculates on each render
  // to capture current date, with selectedDays as the trigger for range changes
  const dateRange = (() => {
    const now = new Date();
    const end = now.toISOString().split('T')[0];
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - selectedDays);
    const start = startDate.toISOString().split('T')[0];
    return { start, end };
  })();

  // Note: config data is available from this hook but only isLoading is needed in this component
  const { isLoading } = useAutoTuningConfig();

  return (
    <DashboardLayout title="Risk Calibration">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-3"
        >
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-400" />
              <h1 className="text-xl sm:text-2xl font-bold text-white">Risk Calibration</h1>
            </div>
            <p className="text-sm text-white/50 mt-1">
              Automated safety forecast tuning and incident tracking
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Date range selector */}
            <div className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-lg sm:rounded-xl bg-white/5 border border-white/10">
              {DATE_RANGE_OPTIONS.map((option) => (
                <button
                  key={option.days}
                  onClick={() => setSelectedDays(option.days)}
                  className={cn(
                    "px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-medium transition-all",
                    selectedDays === option.days
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "text-white/50 hover:text-white/70 hover:bg-white/5"
                  )}
                >
                  <span className="sm:hidden">{option.days}d</span>
                  <span className="hidden sm:inline">{option.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => invalidateAll()}
              className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white/70 hover:bg-white/10 transition-all"
            >
              <RefreshCw className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </button>
          </div>
        </motion.div>

        {/* Content */}
        {isLoading ? (
          <CalibrationSkeleton />
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-4 sm:space-y-6"
          >
            {/* Auto-Tuning Status */}
            <AutoTuningStatusCard />

            {/* Accuracy Metrics */}
            <AccuracyMetricsCard days={selectedDays} />

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <TuningTimeline />
              <div className="space-y-4 sm:space-y-6">
                <RiskLevelDistribution dateRange={dateRange} />
                <IncidentsSummary 
                  dateRange={dateRange} 
                  onLogIncident={() => setShowIncidentModal(true)} 
                />
              </div>
            </div>

            {/* Footer */}
            <motion.div
              variants={itemVariants}
              className="text-center text-[10px] sm:text-xs text-white/30 pt-4 border-t border-white/5"
            >
              <p>
                Auto-tuning runs every Sunday at 2 AM UTC. Performance checks daily at 3 AM UTC.
              </p>
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* Incident Logging Modal */}
      <IncidentLoggingModal
        isOpen={showIncidentModal}
        onClose={() => setShowIncidentModal(false)}
      />
    </DashboardLayout>
  );
}
