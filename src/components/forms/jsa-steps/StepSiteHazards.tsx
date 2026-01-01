import { AlertTriangle, Zap, Car } from "lucide-react";
import { cn } from "../../../lib/utils";

const HAZARD_ITEMS = [
  { key: "lines_energized", label: "Lines energized?" },
  { key: "secondary_voltage", label: "Secondary voltage?" },
  { key: "open_wire_secondary", label: "Open-wire secondary?" },
  { key: "guy_wire_present", label: "Guy wire present?" },
  { key: "rotten_poles", label: "Rotten poles?" },
  { key: "broken_poles", label: "Broken/damaged poles?" },
  { key: "line_clearances_signed", label: "Clearances signed?" },
  { key: "voltages_grounded", label: "Voltages grounded?" },
  { key: "voltages_verified", label: "Grounds verified?" },
];

const TRAFFIC_HAZARDS = [
  { key: "hills", label: "Hills" },
  { key: "curves", label: "Curves" },
  { key: "heavy_traffic", label: "Heavy traffic" },
  { key: "construction_zone", label: "Construction" },
  { key: "school_zone", label: "School zone" },
  { key: "closing_lane", label: "Closing lane?" },
  { key: "flagger_needed", label: "Flagger needed?" },
  { key: "flagger_trained", label: "Flagger trained?" },
  { key: "has_stop_paddles", label: "Stop paddles?" },
  { key: "has_radios", label: "Radios ready?" },
];

const TRAFFIC_SETUP = [
  { key: "warning_signs_used", label: "Warning signs?" },
  { key: "warning_signs_distance", label: "Signs at distance?" },
  { key: "reflective_cones", label: "Cones placed?" },
  { key: "cone_separation", label: "Cone separation?" },
  { key: "buffer_zone", label: "Buffer zone?" },
];

interface StepSiteHazardsProps {
  form: {
    hazardsPresent: Record<string, boolean>;
    trafficHazards: Record<string, boolean>;
    trafficSetup: Record<string, boolean>;
  };
  onBooleanGroupChange: (
    group: "hazardsPresent" | "trafficHazards" | "trafficSetup",
    key: string
  ) => void;
}

interface ToggleGroupProps {
  items: { key: string; label: string }[];
  state: Record<string, boolean>;
  onToggle: (key: string) => void;
  cols?: number;
}

function ToggleGroup({ items, state, onToggle, cols = 2 }: ToggleGroupProps) {
  return (
    <div className={cn("grid gap-1.5", cols === 3 ? "grid-cols-3" : "grid-cols-2")}>
      {items.map((item) => {
        const active = state[item.key];
        return (
          <button
            type="button"
            key={item.key}
            onClick={() => onToggle(item.key)}
            className={cn(
              "rounded-lg border px-2.5 py-2 text-left text-[11px] transition-all touch-manipulation",
              active
                ? "border-emerald-500/40 bg-emerald-500/15 text-white font-medium"
                : "border-white/10 bg-black/30 text-gray-400 active:bg-white/10"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function StepSiteHazards({
  form,
  onBooleanGroupChange,
}: StepSiteHazardsProps) {
  return (
    <div className="space-y-5">
      {/* Electrical Hazards */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <p className="text-xs font-semibold text-amber-200 uppercase tracking-wide">
            Electrical Hazards
          </p>
        </div>
        <ToggleGroup
          items={HAZARD_ITEMS}
          state={form.hazardsPresent}
          onToggle={(key) => onBooleanGroupChange("hazardsPresent", key)}
          cols={3}
        />
      </div>

      {/* Traffic Hazards */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Car className="w-4 h-4 text-emerald-400" />
          <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">
            Traffic Hazards
          </p>
        </div>
        <ToggleGroup
          items={TRAFFIC_HAZARDS}
          state={form.trafficHazards}
          onToggle={(key) => onBooleanGroupChange("trafficHazards", key)}
        />
      </div>

      {/* Work Zone Setup */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-emerald-400" />
          <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">
            Work Zone Setup
          </p>
        </div>
        <ToggleGroup
          items={TRAFFIC_SETUP}
          state={form.trafficSetup}
          onToggle={(key) => onBooleanGroupChange("trafficSetup", key)}
        />
      </div>
    </div>
  );
}
