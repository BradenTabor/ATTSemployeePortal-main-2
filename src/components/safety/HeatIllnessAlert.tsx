/**
 * HeatIllnessAlert — Tiered alerts from heat index (OSHA thresholds).
 * Accepts temperature_f and humidity_pct; computes heat index and shows Caution/Warning/Danger.
 */

import { useMemo } from "react";
import { Thermometer } from "lucide-react";

/**
 * Heat index approximation (°F) from temperature and relative humidity (Rothfusz).
 * Simplified for 80–120°F and 40–100% humidity.
 */
function heatIndexF(tempF: number, humidityPct: number): number {
  if (tempF < 80) return tempF;
  const T = tempF;
  const R = humidityPct;
  const hi =
    -42.379 +
    2.04901523 * T +
    10.1433127 * R -
    0.22475541 * T * R -
    6.83783e-3 * T * T -
    5.481717e-2 * R * R +
    1.22874e-3 * T * T * R +
    8.5282e-4 * T * R * R -
    1.99e-6 * T * T * R * R;
  return Math.round(hi);
}

export interface HeatIllnessAlertProps {
  temperature_f: number;
  humidity_pct: number;
  className?: string;
}

type Tier = "caution" | "warning" | "danger" | null;

export default function HeatIllnessAlert({
  temperature_f,
  humidity_pct,
  className = "",
}: HeatIllnessAlertProps) {
  const { heatIndex, tier, message, title } = useMemo(() => {
    const hi = heatIndexF(temperature_f, humidity_pct);
    let tier: Tier = null;
    let title = "";
    let message = "";
    if (hi >= 105) {
      tier = "danger";
      title = "Danger — High heat index";
      message =
        "Consider postponing non-essential outdoor work. Mandatory buddy system. Hydration and shade every 15 minutes.";
    } else if (hi >= 90) {
      tier = "warning";
      title = "Warning — Elevated heat index";
      message =
        "Mandatory 15-minute shade break every hour. Hydration every 15 minutes. Monitor for signs of heat illness.";
    } else if (hi >= 80) {
      tier = "caution";
      title = "Caution — Moderate heat index";
      message = "Increase water intake. Rest in shade every 30 minutes. Watch for symptoms.";
    }
    return { heatIndex: hi, tier, message, title };
  }, [temperature_f, humidity_pct]);

  if (tier === null) {
    return (
      <div className={`rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/60 ${className}`}>
        <span className="flex items-center gap-2">
          <Thermometer className="w-4 h-4" aria-hidden />
          Heat index: {heatIndex}°F — No alert
        </span>
      </div>
    );
  }

  const bg =
    tier === "danger"
      ? "bg-red-500/10 border-red-500/30"
      : tier === "warning"
        ? "bg-amber-500/10 border-amber-500/30"
        : "bg-amber-500/5 border-amber-500/20";
  const text =
    tier === "danger"
      ? "text-red-200"
      : tier === "warning"
        ? "text-amber-200"
        : "text-amber-100";

  return (
    <div
      className={`rounded-xl border p-4 ${bg} ${text} ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 font-semibold mb-2">
        <Thermometer className="w-5 h-5 flex-shrink-0" aria-hidden />
        <span>{title}</span>
        <span className="text-white/70 font-normal">({heatIndex}°F heat index)</span>
      </div>
      <p className="text-sm opacity-95">{message}</p>
      <p className="text-xs mt-2 opacity-75">
        Based on {temperature_f}°F, {humidity_pct}% humidity. OSHA heat illness prevention guidance.
      </p>
    </div>
  );
}
