import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CloudSun,
  Edit3,
  HardHat,
  Info,
  Wind,
  Zap,
  PenLine,
  TrendingUp,
  Shield,
  FileCheck,
  Users,
  X,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import type { JsaSpan } from "./StepSpans";
import { ObserverSignatureCapture } from "../ObserverSignatureCapture";
import { JsaUserSelector } from "../JsaUserSelector";
import type { ObserverSignature, SharedUser } from "../../../pages/forms/DailyJSAForm";

type ConditionState = "good" | "needs_replaced";

interface PpeState {
  required: boolean;
  condition: ConditionState;
}

interface StatusLogEntry {
  status: "draft" | "completed";
  timestamp: string;
}

interface StepReviewProps {
  form: {
    jobDate: string;
    callInTime: string;
    callOutTime: string;
    workLocation: string;
    circuitNumber: string;
    nearestHospital: string;
    nearestClinic: string;
    ocContact: string;
    docContact: string;
    gfContact: string;
    safetyContact: string;
    jobsPerformed: string[];
    jobsOther: string;
    ppe: Record<string, PpeState>;
    weatherConditions: Record<string, boolean>;
    weatherModifiers: Record<string, boolean>;
    weatherHazards: string;
    hazardsPresent: Record<string, boolean>;
    trafficHazards: Record<string, boolean>;
    trafficSetup: Record<string, boolean>;
    spans: JsaSpan[];
    notes: string;
    employeeSignature: string;
    employeeSignaturePath: string;
    observerSignatures: ObserverSignature[];
    sharedWithUsers: SharedUser[];
    status: "draft" | "completed";
    createdAt: string | null;
    updatedAt: string | null;
    statusChangedAt: string | null;
    completedAt: string | null;
    statusHistory: StatusLogEntry[];
  };
  onInputChange: (key: "notes" | "employeeSignature", value: string) => void;
  onAddObserver: (observer: ObserverSignature) => void;
  onDeleteObserver: (timestamp: string) => void;
  onSharedUsersChange: (users: SharedUser[]) => void;
  onStatusChange: (status: "draft" | "completed") => void;
  onGoToStep: (step: number) => void;
  isEditMode: boolean;
  errors?: {
    employeeSignature?: string;
    spans?: string;
  };
  onFieldBlur?: (field: "employeeSignature") => void;
}

const JOB_LABELS: Record<string, string> = {
  jarraff: "Jarraff Trimmer",
  bucket_truck: "Bucket Truck",
  chip_truck: "Chip Truck",
  geo_boy: "Geo Boy Mulcher",
  skid_steer: "Skid Steer",
  climbing: "Climbing",
};

const WEATHER_LABELS: Record<string, string> = {
  sunny: "Sunny",
  rain: "Rain",
  overcast: "Overcast",
  windy: "Windy",
  hot_dry: "Hot / Dry",
  wet: "Wet",
  cold: "Cold",
  ice_snow: "Ice / Snow",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getActiveLabels(
  map: Record<string, boolean>,
  labels: Record<string, string>
): string[] {
  return Object.entries(map)
    .filter(([, active]) => active)
    .map(([key]) => labels[key] || key);
}

interface SummarySectionProps {
  title: string;
  icon: React.ReactNode;
  onEdit: () => void;
  children: React.ReactNode;
}

function SummarySection({
  title,
  icon,
  onEdit,
  children,
}: SummarySectionProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-white/5">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-xs font-semibold text-white">{title}</span>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition touch-manipulation px-1.5 py-1"
        >
          <Edit3 className="w-3 h-3" />
          Edit
        </button>
      </div>
      <div className="px-3 py-2 text-xs">{children}</div>
    </div>
  );
}

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span className="text-gray-500">None selected</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-200"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export function StepReview({
  form,
  onInputChange,
  onAddObserver,
  onDeleteObserver,
  onSharedUsersChange,
  onStatusChange,
  onGoToStep,
  isEditMode,
  errors,
  onFieldBlur,
}: StepReviewProps) {
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [showUserSelector, setShowUserSelector] = useState(false);

  const jobLabels = form.jobsPerformed.map(
    (key) => JOB_LABELS[key] || key
  );
  if (form.jobsOther.trim()) {
    jobLabels.push(form.jobsOther);
  }

  const weatherLabels = useMemo(() => [
    ...getActiveLabels(form.weatherConditions, WEATHER_LABELS),
    ...getActiveLabels(form.weatherModifiers, WEATHER_LABELS),
  ], [form.weatherConditions, form.weatherModifiers]);

  const requiredPpe = Object.entries(form.ppe)
    .filter(([, state]) => state.required)
    .map(([key]) => key.replace(/_/g, " "));

  const handleStatusChange = (nextStatus: "draft" | "completed") => {
    if (nextStatus === form.status) return;

    if (nextStatus === "completed") {
      const confirmed = window.confirm(
        "Mark this JSA as completed?"
      );
      if (!confirmed) {
        setStatusToast("Status unchanged.");
        setTimeout(() => setStatusToast(null), 3000);
        return;
      }
    }

    onStatusChange(nextStatus);
    setStatusToast(
      nextStatus === "completed"
        ? "Completed. Save to finalize."
        : "Draft. You can continue editing."
    );
    setTimeout(() => setStatusToast(null), 3000);
  };

  const filledSpans = form.spans.filter(
    (s) => s.location.trim() || s.hazards.trim()
  );

  // Calculate completion stats for summary card
  const completionStats = useMemo(() => {
    const hazardsCount = Object.values(form.hazardsPresent).filter(Boolean).length +
      Object.values(form.trafficHazards).filter(Boolean).length;
    const trafficSetupCount = Object.values(form.trafficSetup).filter(Boolean).length;
    const ppeCount = Object.values(form.ppe).filter(p => p.required).length;
    const jobsCount = form.jobsPerformed.length + (form.jobsOther.trim() ? 1 : 0);
    
    // Calculate overall completion percentage
    let completedSections = 0;
    if (form.jobDate && form.workLocation.trim()) completedSections++;
    if (jobsCount > 0 && ppeCount > 0) completedSections++;
    if (weatherLabels.length > 0) completedSections++;
    if (hazardsCount > 0 || trafficSetupCount > 0) completedSections++;
    if (filledSpans.length > 0) completedSections++;
    if (form.employeeSignature.trim() || form.employeeSignaturePath) completedSections++;
    
    const completionPercent = Math.round((completedSections / 6) * 100);
    
    return {
      hazardsCount,
      trafficSetupCount,
      ppeCount,
      jobsCount,
      spansCount: filledSpans.length,
      completionPercent,
      isComplete: completedSections >= 5 && (form.employeeSignature.trim() || !!form.employeeSignaturePath),
    };
  }, [form, weatherLabels, filledSpans]);

  return (
    <div className="space-y-4">
      {/* Completion Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-xl border p-4 space-y-3",
          completionStats.isComplete
            ? "bg-emerald-500/10 border-emerald-500/30"
            : "bg-white/5 border-white/10"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {completionStats.isComplete ? (
              <div className="p-1.5 rounded-lg bg-emerald-500/20">
                <FileCheck className="w-4 h-4 text-emerald-400" />
              </div>
            ) : (
              <div className="p-1.5 rounded-lg bg-amber-500/20">
                <TrendingUp className="w-4 h-4 text-amber-400" />
              </div>
            )}
            <span className="text-sm font-semibold text-white">
              {completionStats.isComplete ? "Ready to Submit" : "JSA Progress"}
            </span>
          </div>
          <span className={cn(
            "text-lg font-bold",
            completionStats.isComplete ? "text-emerald-400" : "text-white"
          )}>
            {completionStats.completionPercent}%
          </span>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-lg bg-black/30 px-3 py-2 text-center">
            <p className="text-lg font-bold text-emerald-400">{completionStats.hazardsCount}</p>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Hazards</p>
          </div>
          <div className="rounded-lg bg-black/30 px-3 py-2 text-center">
            <p className="text-lg font-bold text-amber-400">{completionStats.ppeCount}</p>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">PPE Items</p>
          </div>
          <div className="rounded-lg bg-black/30 px-3 py-2 text-center">
            <p className="text-lg font-bold text-sky-400">{completionStats.spansCount}</p>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Spans</p>
          </div>
          <div className="rounded-lg bg-black/30 px-3 py-2 text-center">
            <p className="text-lg font-bold text-purple-400">{completionStats.trafficSetupCount}</p>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Traffic Setup</p>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="relative h-2 bg-black/40 rounded-full overflow-hidden">
          <motion.div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full",
              completionStats.isComplete
                ? "bg-gradient-to-r from-emerald-600 to-emerald-400"
                : "bg-gradient-to-r from-amber-600 to-amber-400"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${completionStats.completionPercent}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        
        {/* Completion message */}
        <AnimatePresence mode="wait">
          {completionStats.isComplete ? (
            <motion.p
              key="complete"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-emerald-300/80 flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5" />
              All required sections complete. Sign below to finalize.
            </motion.p>
          ) : (
            <motion.p
              key="incomplete"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-white/50"
            >
              Complete all sections and sign to submit your JSA.
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {/* TRAPS Reminder */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100 space-y-1">
        <div className="flex items-center gap-1.5 mb-1">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-semibold text-amber-200 cursor-help" title="Time Pressure, Rushing, Anxiety, Pressure to produce, Situational awareness">TRAPS Check</span>
        </div>
        <p>
          <span className="font-medium cursor-help" title="Time Pressure, Rushing, Anxiety, Pressure to produce, Situational awareness">TRAPS:</span> Time Pressure,
          Rushing, Anxiety, Pressure to Produce, Situational Awareness
        </p>
        <p>
          <span className="font-medium cursor-help" title="Self-check, Peer Check, Communication">TOOLS:</span> Self-check, Peer Check,
          Communication
        </p>
      </div>

      {/* Summary Sections */}
      <div className="space-y-2">
        <SummarySection
          title="Job Info"
          icon={<Calendar className="w-3.5 h-3.5 text-emerald-400" />}
          onEdit={() => onGoToStep(1)}
        >
          <div className="space-y-1">
            <div>
              <span className="text-gray-400">Date:</span>{" "}
              <span className="text-white">{formatDate(form.jobDate)}</span>
            </div>
            <div>
              <span className="text-gray-400">Location:</span>{" "}
              <span className="text-white">{form.workLocation || "—"}</span>
            </div>
          </div>
        </SummarySection>

        <SummarySection
          title="PPE"
          icon={<HardHat className="w-3.5 h-3.5 text-emerald-400" />}
          onEdit={() => onGoToStep(2)}
        >
          <div className="space-y-1.5">
            <div>
              <span className="text-gray-400">Jobs:</span>{" "}
              {jobLabels.length > 0 ? jobLabels.join(", ") : "—"}
            </div>
            <ChipList items={requiredPpe} />
          </div>
        </SummarySection>

        <SummarySection
          title="Weather"
          icon={<CloudSun className="w-3.5 h-3.5 text-emerald-400" />}
          onEdit={() => onGoToStep(3)}
        >
          <ChipList items={weatherLabels} />
        </SummarySection>

        <SummarySection
          title="Hazards"
          icon={<Zap className="w-3.5 h-3.5 text-amber-400" />}
          onEdit={() => onGoToStep(4)}
        >
          <span className="text-white">
            {Object.values(form.hazardsPresent).filter(Boolean).length +
              Object.values(form.trafficHazards).filter(Boolean).length +
              Object.values(form.trafficSetup).filter(Boolean).length}{" "}
            items flagged
          </span>
        </SummarySection>

        <SummarySection
          title="Spans"
          icon={<Wind className="w-3.5 h-3.5 text-emerald-400" />}
          onEdit={() => onGoToStep(5)}
        >
          <span className="text-white">
            {filledSpans.length} of {form.spans.length} documented
          </span>
        </SummarySection>
      </div>

      {/* JSA Sharing / Delegation */}
      <div className="space-y-3 pt-2">
        {/* Info Banner */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-300 mb-1">
                About JSA Sharing
              </p>
              <p className="text-xs text-gray-300 leading-relaxed">
                Users you add can <strong className="text-white">view and edit</strong> this JSA from their JSA History page. 
                They <strong className="text-white">cannot</strong> change who it's shared with. You can remove users at any time.
              </p>
            </div>
          </div>
        </div>

        {/* Delegation Summary Section */}
        <div className="rounded-lg border border-white/10 bg-black/30 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-white/5">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-white">Share with Users</span>
            </div>
            <button
              type="button"
              onClick={() => setShowUserSelector(true)}
              className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition touch-manipulation px-1.5 py-1"
            >
              <Edit3 className="w-3 h-3" />
              {form.sharedWithUsers.length > 0 ? 'Edit' : 'Add Users'}
            </button>
          </div>
          <div className="px-3 py-2 text-xs">
            {form.sharedWithUsers.length === 0 ? (
              <span className="text-gray-500">None selected</span>
            ) : (
              <div className="space-y-2">
                {form.sharedWithUsers.map((sharedUser) => (
                  <div
                    key={sharedUser.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {sharedUser.full_name || sharedUser.email}
                        {!sharedUser.full_name && (
                          <span className="ml-2 text-xs text-gray-500">(Inactive)</span>
                        )}
                      </p>
                      {sharedUser.full_name && (
                        <p className="text-xs text-gray-400 truncate">{sharedUser.email}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onSharedUsersChange(
                        form.sharedWithUsers.filter(u => u.id !== sharedUser.id)
                      )}
                      className="p-1 hover:bg-red-500/20 rounded-lg transition ml-2"
                      aria-label={`Remove ${sharedUser.full_name || sharedUser.email}`}
                    >
                      <X className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notes & Signature */}
      <div className="space-y-3 pt-2">
        <div>
          <label className="block text-[10px] font-medium text-white/50 uppercase mb-1">
            Notes
          </label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => onInputChange("notes", e.target.value)}
            placeholder="Additional observations..."
            className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
          />
        </div>

        {/* Type your name signature */}
        <div className="space-y-3">
          <label className="block text-[10px] font-medium text-white/50 uppercase mb-1">
            Employee Signature <span className="text-red-400">*</span>
          </label>
          <p className="text-[10px] text-white/50">Type your name below</p>
          <div className="relative">
            <PenLine className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors",
              errors?.employeeSignature ? "text-rose-400" : "text-emerald-500/50"
            )} />
            <input
              id="employeeSignature"
              name="employeeSignature"
              type="text"
              value={form.employeeSignature}
              data-testid="employee-signature"
              onChange={(e) => onInputChange("employeeSignature", e.target.value)}
              onBlur={() => onFieldBlur?.("employeeSignature")}
              placeholder="Type your full name"
              className={cn(
                "w-full rounded-lg border bg-black/50 pl-10 pr-3 py-3 text-base text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 transition-all",
                errors?.employeeSignature
                  ? "border-rose-500/50 focus:ring-rose-500/50"
                  : form.employeeSignature.trim()
                  ? "border-emerald-500/40 focus:ring-emerald-500/50"
                  : "border-white/10 focus:ring-emerald-500/50"
              )}
              style={{ fontFamily: "'Caveat', cursive" }}
              aria-invalid={!!errors?.employeeSignature}
              aria-describedby={errors?.employeeSignature ? "employeeSignature-error" : undefined}
            />
            {errors?.employeeSignature && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
            )}
          </div>
          {errors?.employeeSignature && (
            <motion.p
              id="employeeSignature-error"
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-1 text-xs text-rose-400 flex items-center gap-1"
            >
              <AlertTriangle className="w-3 h-3" />
              {errors.employeeSignature}
            </motion.p>
          )}
          {(form.employeeSignature.trim() || form.employeeSignaturePath) && !errors?.employeeSignature && (
            <p className="mt-1 text-[10px] text-emerald-400/70 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {form.employeeSignaturePath ? "Signature on file" : "By typing your name, you certify this JSA is accurate"}
            </p>
          )}
        </div>

        {/* Observer Signatures */}
        <ObserverSignatureCapture
          observers={form.observerSignatures}
          onAddObserver={onAddObserver}
          onDeleteObserver={onDeleteObserver}
        />
      </div>

      {/* Status Toggle */}
      <div className="rounded-lg border border-white/15 bg-black/40 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white">Status</span>
          <span
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
              form.status === "completed"
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-amber-500/20 text-amber-300"
            )}
          >
            {form.status}
          </span>
        </div>

        <div className="grid gap-2 grid-cols-2">
          {(
            [
              { value: "draft", label: "Draft" },
              { value: "completed", label: "Complete" },
            ] as const
          ).map((option) => {
            const active = form.status === option.value;
            return (
              <button
                type="button"
                key={option.value}
                onClick={() => handleStatusChange(option.value)}
                aria-pressed={active}
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs font-semibold transition flex items-center justify-center gap-1.5 touch-manipulation",
                  active
                    ? "border-emerald-500/40 bg-emerald-500/15 text-white"
                    : "border-white/10 bg-white/5 text-gray-400 hover:bg-white/10"
                )}
              >
                <CheckCircle2
                  className={cn(
                    "w-3.5 h-3.5",
                    active ? "text-emerald-400" : "text-gray-500"
                  )}
                />
                {option.label}
              </button>
            );
          })}
        </div>

        {statusToast && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] text-emerald-100 flex items-center gap-1"
          >
            <Info className="w-3 h-3" />
            {statusToast}
          </motion.div>
        )}

        {/* Timestamps */}
        {isEditMode && (
          <div className="grid gap-1.5 grid-cols-2 text-[10px] text-gray-400 pt-2 border-t border-white/5">
            <div className="rounded border border-white/10 bg-black/30 px-2 py-1.5">
              <p className="text-[9px] uppercase text-gray-500">Created</p>
              <p className="text-white">{formatDateTime(form.createdAt)}</p>
            </div>
            <div className="rounded border border-white/10 bg-black/30 px-2 py-1.5">
              <p className="text-[9px] uppercase text-gray-500">Saved</p>
              <p className="text-white">{formatDateTime(form.updatedAt)}</p>
            </div>
          </div>
        )}
      </div>

      {/* User Selector Modal */}
      <JsaUserSelector
        selectedUsers={form.sharedWithUsers}
        onUsersChange={onSharedUsersChange}
        isOpen={showUserSelector}
        onClose={() => setShowUserSelector(false)}
      />
    </div>
  );
}
