import { useState } from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { cn } from "../../../lib/utils";
import type { JsaSpan } from "./StepSpans";

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
    status: "draft" | "completed";
    createdAt: string | null;
    updatedAt: string | null;
    statusChangedAt: string | null;
    completedAt: string | null;
    statusHistory: StatusLogEntry[];
  };
  onInputChange: (key: "notes" | "employeeSignature", value: string) => void;
  onStatusChange: (status: "draft" | "completed") => void;
  onGoToStep: (step: number) => void;
  isEditMode: boolean;
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
  onStatusChange,
  onGoToStep,
  isEditMode,
}: StepReviewProps) {
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const jobLabels = form.jobsPerformed.map(
    (key) => JOB_LABELS[key] || key
  );
  if (form.jobsOther.trim()) {
    jobLabels.push(form.jobsOther);
  }

  const weatherLabels = [
    ...getActiveLabels(form.weatherConditions, WEATHER_LABELS),
    ...getActiveLabels(form.weatherModifiers, WEATHER_LABELS),
  ];

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

  return (
    <div className="space-y-4">
      {/* TRAPS Reminder */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100 space-y-1">
        <div className="flex items-center gap-1.5 mb-1">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-semibold text-amber-200">TRAPS Check</span>
        </div>
        <p>
          <span className="font-medium">TRAPS:</span> Time Pressure,
          Overconfidence, Distractions
        </p>
        <p>
          <span className="font-medium">TOOLS:</span> Self-check, Peer Check,
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

        <div>
          <label className="block text-[10px] font-medium text-white/50 uppercase mb-1">
            Signature <span className="text-emerald-400">*</span>
          </label>
          <input
            type="text"
            value={form.employeeSignature}
            onChange={(e) => onInputChange("employeeSignature", e.target.value)}
            placeholder="Type your name or initials"
            className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          />
        </div>
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
    </div>
  );
}
