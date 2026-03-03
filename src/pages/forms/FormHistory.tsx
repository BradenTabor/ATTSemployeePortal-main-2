import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import { BlurFade } from "../../components/ui/blur-fade";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { glass } from "../../lib/glass";
import {
  FileText,
  ChevronRight,
  Truck,
  Shield,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

/** Custom icon images for Forms History (place in public/assets/). Fallback to Lucide if missing. */
const FORM_HISTORY_ICONS = {
  dvir: "/assets/forms-history-dvir-icon.png",
  jsa: "/assets/forms-history-jsa-icon.png",
} as const;

interface FormSummary {
  dvirCount: number;
  jsaCount: number;
  lastDvir: string | null;
  lastJsa: string | null;
  loading: boolean;
}

const hubCards = [
  {
    key: "dvir" as const,
    path: "/forms-history/dvir",
    title: "Daily Vehicle Inspection",
    subtitle: "DVIR",
    description:
      "Review your previously submitted DVIR forms, track deficiencies, and view inspection photos.",
    iconSrc: FORM_HISTORY_ICONS.dvir,
    fallbackIcon: Truck,
    accentFrom: "from-emerald-500/20",
    accentBorder: "border-emerald-400/30",
    accentText: "text-emerald-300",
    accentBg: "bg-emerald-500/10",
    accentHover: "hover:border-emerald-400/50 hover:shadow-emerald-500/10",
  },
  {
    key: "jsa" as const,
    path: "/forms-history/jsa",
    title: "Job Safety Analysis",
    subtitle: "JSA",
    description:
      "Review your JSA submissions, track identified hazards, and verify observer signatures.",
    iconSrc: FORM_HISTORY_ICONS.jsa,
    fallbackIcon: Shield,
    accentFrom: "from-blue-500/20",
    accentBorder: "border-blue-400/30",
    accentText: "text-blue-300",
    accentBg: "bg-blue-500/10",
    accentHover: "hover:border-blue-400/50 hover:shadow-blue-500/10",
  },
] as const;

export default function FormHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const prefersReducedMotion = useReducedMotion();

  const [summary, setSummary] = useState<FormSummary>({
    dvirCount: 0,
    jsaCount: 0,
    lastDvir: null,
    lastJsa: null,
    loading: true,
  });
  const [iconImageError, setIconImageError] = useState<{ dvir: boolean; jsa: boolean }>({
    dvir: false,
    jsa: false,
  });

  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    let cancelled = false;

    async function fetchSummary() {
      const [dvirRes, jsaRes] = await Promise.all([
        supabase
          .from("dvir_reports")
          .select("created_at", { count: "exact", head: false })
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("daily_jsa")
          .select("created_at", { count: "exact", head: false })
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      if (cancelled) return;
      setSummary({
        dvirCount: dvirRes.count ?? 0,
        jsaCount: jsaRes.count ?? 0,
        lastDvir: dvirRes.data?.[0]?.created_at ?? null,
        lastJsa: jsaRes.data?.[0]?.created_at ?? null,
        loading: false,
      });
    }

    fetchSummary();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const counts: Record<"dvir" | "jsa", number> = {
    dvir: summary.dvirCount,
    jsa: summary.jsaCount,
  };
  const lastDates: Record<"dvir" | "jsa", string | null> = {
    dvir: summary.lastDvir,
    jsa: summary.lastJsa,
  };

  return (
    <DashboardLayout title="Forms History">
      <div className="w-full max-w-5xl mx-auto space-y-8">
        {/* Back link + header */}
        <BlurFade delay={0} duration={0.4} direction="up" offset={8} inView={false}>
          <div>
            <button
              type="button"
              onClick={() => navigate("/forms")}
              className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 rounded-lg px-1 -ml-1"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden />
              Back to Forms
            </button>
            <div className="flex flex-col gap-1">
              <p className="text-xs uppercase tracking-[0.35em] font-medium text-emerald-200/80">
                Compliance
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Forms History
              </h2>
              <p className="text-sm text-white/60 mt-1 max-w-xl leading-relaxed">
                View and search your submitted safety forms. Select a form type to
                browse your records.
              </p>
            </div>
          </div>
        </BlurFade>

        {/* Stat summary strip — solid surfaces */}
        <BlurFade delay={0.05} duration={0.4} direction="up" offset={8} inView={false}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "DVIR Submissions",
                value: summary.loading ? "—" : summary.dvirCount.toLocaleString(),
                iconType: "dvir" as const,
                fallbackIcon: Truck,
                accent: "text-emerald-300",
              },
              {
                label: "JSA Submissions",
                value: summary.loading ? "—" : summary.jsaCount.toLocaleString(),
                iconType: "jsa" as const,
                fallbackIcon: Shield,
                accent: "text-blue-300",
              },
              {
                label: "Last DVIR",
                value: summary.loading
                  ? "—"
                  : summary.lastDvir
                    ? formatDistanceToNow(new Date(summary.lastDvir), { addSuffix: true })
                    : "None",
                iconType: "dvir" as const,
                fallbackIcon: Clock,
                accent: "text-emerald-300",
              },
              {
                label: "Last JSA",
                value: summary.loading
                  ? "—"
                  : summary.lastJsa
                    ? formatDistanceToNow(new Date(summary.lastJsa), { addSuffix: true })
                    : "None",
                iconType: "jsa" as const,
                fallbackIcon: Clock,
                accent: "text-blue-300",
              },
            ].map((stat) => {
              const FallbackIcon = stat.fallbackIcon;
              const useFallback = iconImageError[stat.iconType];
              return (
              <div
                key={stat.label}
                className={`${glass.card} p-3 sm:p-4 transition-colors duration-150 hover:border-white/[0.08]`}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden ${
                      stat.accent === "text-emerald-300"
                        ? "border-emerald-400/25 bg-emerald-500/10"
                        : "border-blue-400/25 bg-blue-500/10"
                    }`}
                  >
                    {useFallback ? (
                      <FallbackIcon
                        className={`w-4 h-4 ${stat.accent}`}
                        aria-hidden
                      />
                    ) : (
                      <img
                        src={FORM_HISTORY_ICONS[stat.iconType]}
                        alt=""
                        className="h-4 w-4 object-contain"
                        onError={() =>
                          setIconImageError((prev) => ({ ...prev, [stat.iconType]: true }))
                        }
                      />
                    )}
                  </div>
                  <span className="text-[10px] sm:text-xs uppercase tracking-wider text-white/40 font-medium truncate">
                    {stat.label}
                  </span>
                </div>
                <p
                  className={`text-lg sm:text-xl font-semibold text-white tabular-nums ${
                    summary.loading ? "animate-pulse" : ""
                  }`}
                >
                  {stat.value}
                </p>
              </div>
            );
            })}
          </div>
        </BlurFade>

        {/* Form type cards — solid surfaces, accent gradient overlay only */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {hubCards.map((card, index) => {
            const FallbackIcon = card.fallbackIcon;
            const count = counts[card.key];
            const lastDate = lastDates[card.key];
            const useFallback = iconImageError[card.key];
            return (
              <BlurFade
                key={card.key}
                delay={0.08 + index * 0.04}
                inView={false}
                className="h-full"
              >
                <motion.button
                  type="button"
                  onClick={() => navigate(card.path)}
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.01 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className={`group w-full flex flex-col ${glass.card} bg-gradient-to-b ${card.accentFrom} to-transparent p-5 sm:p-6 text-left border ${card.accentBorder} ${card.accentHover} focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 outline-none transition-all duration-200 h-full`}
                  aria-label={`Open ${card.title} history`}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div
                      className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] overflow-hidden ${card.accentBg} ${card.accentBorder} transition-transform duration-150 group-hover:scale-[1.02]`}
                    >
                      {useFallback ? (
                        <FallbackIcon className={`w-6 h-6 ${card.accentText}`} aria-hidden />
                      ) : (
                        <img
                          src={card.iconSrc}
                          alt=""
                          className="h-6 w-6 object-contain"
                          onError={() =>
                            setIconImageError((prev) => ({ ...prev, [card.key]: true }))
                          }
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-white/40 group-hover:text-white/70 transition-colors">
                      <span className="text-xs font-medium">View all</span>
                      <ChevronRight className="w-4 h-4" aria-hidden />
                    </div>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-base sm:text-lg font-semibold text-white mb-1">
                      {card.title}
                    </h3>
                    <p className="text-xs text-white/50 font-medium mb-3">
                      {card.subtitle}
                    </p>
                    <p className="text-sm text-white/60 leading-relaxed line-clamp-2">
                      {card.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-white/30" aria-hidden />
                      <span className="text-xs text-white/50">
                        {summary.loading ? (
                          <span className="inline-block w-12 h-3 bg-white/10 animate-pulse rounded" />
                        ) : (
                          <span className="text-white/70 font-medium tabular-nums">
                            {count.toLocaleString()}
                          </span>
                        )}{" "}
                        {!summary.loading && "submissions"}
                      </span>
                    </div>
                    {!summary.loading && lastDate && (
                      <span className="text-[11px] text-white/40">
                        Last:{" "}
                        {formatDistanceToNow(new Date(lastDate), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </motion.button>
              </BlurFade>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
