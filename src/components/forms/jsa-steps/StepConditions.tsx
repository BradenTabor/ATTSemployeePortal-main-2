import { cn } from "../../../lib/utils";

const WEATHER_CONDITIONS = [
  { key: "sunny", label: "☀️ Sunny" },
  { key: "rain", label: "🌧️ Rain" },
  { key: "overcast", label: "☁️ Overcast" },
  { key: "windy", label: "💨 Windy" },
];

const WEATHER_MODIFIERS = [
  { key: "hot_dry", label: "🔥 Hot / Dry" },
  { key: "wet", label: "💧 Wet" },
  { key: "cold", label: "❄️ Cold" },
  { key: "ice_snow", label: "🌨️ Ice / Snow" },
];

interface StepConditionsProps {
  form: {
    weatherConditions: Record<string, boolean>;
    weatherModifiers: Record<string, boolean>;
    weatherHazards: string;
  };
  onBooleanGroupChange: (
    group: "weatherConditions" | "weatherModifiers",
    key: string
  ) => void;
  onInputChange: (key: "weatherHazards", value: string) => void;
}

interface ToggleButtonGroupProps {
  title: string;
  items: { key: string; label: string }[];
  state: Record<string, boolean>;
  onToggle: (key: string) => void;
}

function ToggleButtonGroup({
  title,
  items,
  state,
  onToggle,
}: ToggleButtonGroupProps) {
  return (
    <div>
      <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
        {title}
      </p>
      <div className="grid gap-2 grid-cols-2">
        {items.map((item) => {
          const active = state[item.key];
          return (
            <button
              type="button"
              key={item.key}
              onClick={() => onToggle(item.key)}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left text-sm transition-all touch-manipulation",
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
    </div>
  );
}

export function StepConditions({
  form,
  onBooleanGroupChange,
  onInputChange,
}: StepConditionsProps) {
  return (
    <div className="space-y-5">
      {/* Weather */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ToggleButtonGroup
          title="Weather"
          items={WEATHER_CONDITIONS}
          state={form.weatherConditions}
          onToggle={(key) => onBooleanGroupChange("weatherConditions", key)}
        />
        <ToggleButtonGroup
          title="Surface / Temperature"
          items={WEATHER_MODIFIERS}
          state={form.weatherModifiers}
          onToggle={(key) => onBooleanGroupChange("weatherModifiers", key)}
        />
      </div>

      {/* Hazards & Mitigation */}
      <div className="space-y-2 pt-2">
        <p className="text-xs font-medium text-white/50 uppercase tracking-wider">
          Weather Hazards & Mitigation
        </p>
        <textarea
          rows={3}
          value={form.weatherHazards}
          onChange={(e) => onInputChange("weatherHazards", e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          placeholder="Describe any weather-related hazards and mitigation..."
        />
      </div>
    </div>
  );
}
