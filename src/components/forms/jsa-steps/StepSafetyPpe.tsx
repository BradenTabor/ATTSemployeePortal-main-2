import { CheckCircle2 } from "lucide-react";
import { cn } from "../../../lib/utils";

type ConditionState = "good" | "needs_replaced";

interface PpeState {
  required: boolean;
  condition: ConditionState;
}

const JOB_OPTIONS = [
  { key: "jarraff", label: "Jarraff Trimmer" },
  { key: "bucket_truck", label: "Bucket Truck" },
  { key: "chip_truck", label: "Chip Truck" },
  { key: "geo_boy", label: "Geo Boy Mulcher" },
  { key: "skid_steer", label: "Skid Steer" },
  { key: "climbing", label: "Climbing" },
];

const PPE_ITEMS = [
  { key: "hard_hats", label: "Hard hats" },
  { key: "safety_glasses", label: "Safety glasses" },
  { key: "ear_plugs", label: "Ear plugs" },
  { key: "reflective_vest", label: "Reflective vest" },
  { key: "fall_protection", label: "Fall protection" },
  { key: "gloves", label: "Gloves" },
  { key: "chaps", label: "Chaps" },
];

interface StepSafetyPpeProps {
  form: {
    jobsPerformed: string[];
    jobsOther: string;
    ppe: Record<string, PpeState>;
  };
  onJobToggle: (key: string) => void;
  onPpeToggle: (key: string) => void;
  onPpeCondition: (key: string, condition: ConditionState) => void;
  onInputChange: (key: "jobsOther", value: string) => void;
}

export function StepSafetyPpe({
  form,
  onJobToggle,
  onPpeToggle,
  onPpeCondition,
  onInputChange,
}: StepSafetyPpeProps) {
  return (
    <div className="space-y-5">
      {/* Jobs Being Performed */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-white/50 uppercase tracking-wider">
          Jobs Being Performed
        </p>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
          {JOB_OPTIONS.map((job) => {
            const active = form.jobsPerformed.includes(job.key);
            return (
              <button
                type="button"
                key={job.key}
                onClick={() => onJobToggle(job.key)}
                className={cn(
                  "rounded-lg border px-3 py-2.5 flex items-center gap-2 text-left text-xs transition-all touch-manipulation",
                  active
                    ? "border-emerald-500/50 bg-emerald-500/15 text-white"
                    : "border-white/10 bg-black/30 text-gray-400 active:bg-white/10"
                )}
              >
                <CheckCircle2
                  className={cn(
                    "w-4 h-4 flex-shrink-0",
                    active ? "text-emerald-400" : "text-gray-600"
                  )}
                />
                <span className="truncate font-medium">{job.label}</span>
              </button>
            );
          })}
        </div>

        {/* Other Job */}
        <input
          type="text"
          value={form.jobsOther}
          onChange={(e) => onInputChange("jobsOther", e.target.value)}
          placeholder="Other job type..."
          className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
        />
      </div>

      {/* PPE Checklist */}
      <div className="space-y-3 pt-2">
        <p className="text-xs font-medium text-white/50 uppercase tracking-wider">
          PPE Checklist
        </p>
        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
          {PPE_ITEMS.map((item) => {
            const state = form.ppe[item.key];
            return (
              <div
                key={item.key}
                className="rounded-lg border border-white/10 bg-black/30 p-3"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs text-white font-medium">{item.label}</p>
                  <button
                    type="button"
                    onClick={() => onPpeToggle(item.key)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-semibold border transition touch-manipulation",
                      state?.required
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                        : "bg-white/5 border-white/10 text-gray-400"
                    )}
                  >
                    {state?.required ? "Req" : "Opt"}
                  </button>
                </div>
                <div className="flex gap-1.5">
                  {(["good", "needs_replaced"] as ConditionState[]).map(
                    (condition) => (
                      <button
                        type="button"
                        key={condition}
                        onClick={() => onPpeCondition(item.key, condition)}
                        className={cn(
                          "flex-1 text-[10px] font-medium rounded border px-2 py-1.5 transition touch-manipulation",
                          state?.condition === condition
                            ? "bg-amber-500/15 border-amber-500/40 text-amber-200"
                            : "border-white/10 bg-white/5 text-gray-500"
                        )}
                      >
                        {condition === "good" ? "Good" : "Replace"}
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
