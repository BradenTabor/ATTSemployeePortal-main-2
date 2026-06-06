import { memo, useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useModalOverlay } from "../../hooks/useModalOverlay";
import { glass } from "../../lib/glass";
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Users,
  CloudRain,
  Navigation,
  Clock,
  Calendar,
  Building2,
  FileText,
  Shield,
  X,
  AlertCircle,
  CheckCircle,
  Activity,
  MapPin,
  Copy,
  ImageIcon,
  Loader2,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import type {
  DailyJsaRecord,
  ObserverSignature,
  JsaSpan,
} from "../../pages/forms/DailyJSAForm";
import { SIGNED_URL_EXPIRY } from "../../hooks/jsa/useJSAPhotoUpload";
import { Z } from "@/lib/zIndex";

const PPE_ITEMS = [
  { key: "hard_hats", label: "Hard hats" },
  { key: "safety_glasses", label: "Safety glasses" },
  { key: "ear_plugs", label: "Ear plugs" },
  { key: "reflective_vest", label: "Reflective vest" },
  { key: "fall_protection", label: "Fall protection" },
  { key: "gloves", label: "Gloves" },
  { key: "chaps", label: "Chaps" },
];

const HAZARD_ITEMS = [
  { key: "lines_energized", label: "Are lines energized?" },
  { key: "secondary_voltage", label: "Secondary voltage?" },
  { key: "open_wire_secondary", label: "Open-wire secondary?" },
  { key: "guy_wire_present", label: "Guy wire present?" },
  { key: "rotten_poles", label: "Rotten poles?" },
  { key: "broken_poles", label: "Broken / damaged poles?" },
  { key: "line_clearances_signed", label: "Line clearances needed & signed?" },
  { key: "voltages_grounded", label: "Voltages grounded?" },
  { key: "voltages_verified", label: "Grounds verified?" },
];

const TRAFFIC_HAZARDS = [
  { key: "hills", label: "Hills" },
  { key: "curves", label: "Curves" },
  { key: "heavy_traffic", label: "Heavy traffic" },
  { key: "construction_zone", label: "Construction zone" },
  { key: "school_zone", label: "School zone" },
  { key: "closing_lane", label: "Closing a lane?" },
  { key: "flagger_needed", label: "Flagger needed?" },
  { key: "flagger_trained", label: "Flagger trained?" },
  { key: "has_stop_paddles", label: "Stop/Slow paddles ready?" },
  { key: "has_radios", label: "Required radios ready?" },
];

function getStatus(record: DailyJsaRecord): "draft" | "completed" {
  return (record.status as "draft" | "completed") || "draft";
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "Unknown date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const sectionCard = `${glass.subtle} p-4`;

function SectionHeader({
  icon: Icon,
  label,
  accent = "text-emerald-300",
  count,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  accent?: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/[0.06]">
      <Icon className={`w-4 h-4 ${accent}`} />
      <h3 className="text-xs uppercase tracking-wider text-white/50 font-semibold">
        {label}
      </h3>
      {count != null && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 font-medium">
          {count}
        </span>
      )}
    </div>
  );
}

function JsaPhotoSection({ paths }: { paths: string[] }) {
  const [urlState, setUrlState] = useState<{
    pathsKey: string;
    urls: Map<string, string>;
  } | null>(null);
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const lightboxCloseRef = useRef<HTMLButtonElement>(null);
  const lightboxPrevActive = useRef<HTMLElement | null>(null);

  const pathsKey = paths.join(",");

  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from("jsa-photos")
      .createSignedUrls(paths, SIGNED_URL_EXPIRY.display)
      .then(({ data }) => {
        if (cancelled) return;
        const map = new Map<string, string>();
        data?.forEach((item) => {
          if (item.signedUrl && item.path) map.set(item.path, item.signedUrl);
        });
        setUrlState({ pathsKey, urls: map });
      })
      .catch(() => {
        if (!cancelled) setUrlState({ pathsKey, urls: new Map() });
      });
    return () => {
      cancelled = true;
    };
  }, [pathsKey, paths]);

  const loading = !urlState || urlState.pathsKey !== pathsKey;
  const urls = urlState?.urls ?? new Map<string, string>();

  const closeLightbox = useCallback(() => {
    lightboxPrevActive.current?.focus?.();
    lightboxPrevActive.current = null;
    setExpandedUrl(null);
  }, []);

  const openLightbox = useCallback((url: string) => {
    lightboxPrevActive.current = document.activeElement as HTMLElement | null;
    setExpandedUrl(url);
  }, []);

  useEffect(() => {
    if (!expandedUrl) return;
    lightboxCloseRef.current?.focus();
  }, [expandedUrl]);

  useEffect(() => {
    if (!expandedUrl || paths.length === 0) return;
    const urlsMap = urlState?.urls ?? new Map<string, string>();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeLightbox();
        return;
      }
      if (paths.length <= 1) return;
      const currentPath = Array.from(urlsMap.entries()).find(
        ([, u]) => u === expandedUrl
      )?.[0];
      if (!currentPath) return;
      const idx = paths.indexOf(currentPath);
      if (idx === -1) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prevIdx = (idx - 1 + paths.length) % paths.length;
        setExpandedUrl(urlsMap.get(paths[prevIdx]) ?? null);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const nextIdx = (idx + 1) % paths.length;
        setExpandedUrl(urlsMap.get(paths[nextIdx]) ?? null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expandedUrl, paths, urlState?.urls, closeLightbox]);

  return (
    <>
      <div className={sectionCard}>
        <SectionHeader
          icon={ImageIcon}
          label="Paper JSA Photos"
          accent="text-emerald-300"
          count={paths.length}
        />
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-white/40">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading photos...
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {paths.map((path) => {
              const url = urls.get(path);
              return (
                <button
                  key={path}
                  type="button"
                  onClick={() => url && openLightbox(url)}
                  className="rounded-lg overflow-hidden border border-white/10 bg-black/40 w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 hover:border-emerald-500/30 transition-colors cursor-pointer"
                >
                  {url ? (
                    <img
                      src={url}
                      alt="Paper JSA page"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-white/20" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {expandedUrl && (
        <div style={{ zIndex: Z.modal }}
          role="dialog"
          aria-modal="true"
          aria-label="Paper JSA photo (full size)"
          className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && closeLightbox()}
          onKeyDown={(e) => {
            if (e.key !== "Tab") return;
            const focusable = e.currentTarget.querySelectorAll<HTMLElement>(
              'button, [href], input, [tabindex]:not([tabindex="-1"])'
            );
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (focusable.length <= 1) return;
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }}
        >
          <button
            ref={lightboxCloseRef}
            type="button"
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white/80 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            aria-label="Close photo"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={expandedUrl}
            alt="Paper JSA page (full size)"
            tabIndex={0}
            className="max-w-full max-h-full object-contain rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

export interface JsaDetailModalProps {
  jsa: DailyJsaRecord;
  onClose: () => void;
  onEdit: (record: DailyJsaRecord) => void;
  onDuplicate?: () => void;
}

export const JsaDetailModal = memo(function JsaDetailModal({
  jsa,
  onClose,
  onEdit,
  onDuplicate,
}: JsaDetailModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const status = getStatus(jsa);
  const siteHazards = jsa.hazards_present
    ? Object.keys(jsa.hazards_present).filter(
        (k) => (jsa.hazards_present as Record<string, boolean>)[k]
      )
    : [];
  const trafficHazards = jsa.traffic_hazards
    ? Object.keys(jsa.traffic_hazards).filter(
        (k) => (jsa.traffic_hazards as Record<string, boolean>)[k]
      )
    : [];
  const hasHazards = siteHazards.length > 0 || trafficHazards.length > 0;
  const wc = jsa.weather_conditions as
    | { conditions?: Record<string, boolean> }
    | undefined;
  const { modalRef, zIndex } = useModalOverlay({
    isOpen: true,
    onClose,
    zIndex: 100,
  });

  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 flex items-end sm:items-center justify-center"
      style={{ zIndex }}
      aria-hidden
    >
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="jsa-detail-modal-title"
        initial={{
          opacity: 0,
          y: prefersReducedMotion ? 0 : 24,
          scale: prefersReducedMotion ? 1 : 0.97,
        }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.2 }
            : { type: "spring", damping: 28, stiffness: 300 }
        }
        className={`relative z-10 w-full max-w-3xl max-h-[92vh] sm:max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden mx-0 sm:mx-4 ${glass.elevated}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-gray-800 border-b border-white/[0.06] px-5 sm:px-6 py-4">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3 sm:hidden" />

          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <FileText className="w-4 h-4 text-blue-300" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2
                    id="jsa-detail-modal-title"
                    className="text-lg sm:text-xl font-bold text-white truncate"
                  >
                    {jsa.work_location || "N/A"}
                  </h2>
                </div>
              </div>
              <p className="text-xs text-white/40 font-mono">
                {formatDateTime(jsa.created_at)}
                {jsa.circuit_number && (
                  <span className="text-white/30">
                    {" "}
                    · Circuit {jsa.circuit_number}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  status === "draft"
                    ? "border-yellow-500/40 bg-yellow-500/15 text-yellow-200"
                    : "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                }`}
              >
                {status === "draft" ? (
                  <Edit3 className="w-3 h-3" aria-hidden />
                ) : (
                  <CheckCircle2 className="w-3 h-3" aria-hidden />
                )}
                {status === "draft" ? "Draft" : "Complete"}
              </span>
              {jsa.submission_type === "paper" && (
                <span className="hidden sm:inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-200">
                  Paper
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
          {/* Action bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onEdit(jsa)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/50 focus-visible:ring-2 focus-visible:ring-emerald-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 outline-none transition-all active:scale-[0.98]"
            >
              <Edit3 className="w-3.5 h-3.5" aria-hidden />
              Edit
            </button>
            {onDuplicate && (
              <button
                type="button"
                onClick={onDuplicate}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/50 focus-visible:ring-2 focus-visible:ring-amber-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 outline-none transition-all active:scale-[0.98]"
              >
                <Copy className="w-3.5 h-3.5" aria-hidden />
                Duplicate
              </button>
            )}
          </div>

          {/* Job details, emergency, location */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className={sectionCard}>
              <SectionHeader icon={Calendar} label="Job Details" />
              <p className="text-[10px] uppercase text-white/40 mb-1">
                Job Date
              </p>
              <p className="text-sm font-medium text-white mb-3">
                {jsa.job_date
                  ? new Date(jsa.job_date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "—"}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.05]">
                <div>
                  <p className="text-[10px] text-white/40 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Call In
                  </p>
                  <p className="text-sm font-medium text-white">
                    {jsa.call_in_time || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-white/40 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Call Out
                  </p>
                  <p className="text-sm font-medium text-white">
                    {jsa.call_out_time || "—"}
                  </p>
                </div>
              </div>
            </div>

            <div
              className={`${sectionCard} border-red-500/20 bg-red-500/[0.04]`}
            >
              <SectionHeader
                icon={AlertCircle}
                label="Emergency Contacts"
                accent="text-red-300"
              />
              <p className="text-[10px] text-red-200/60 mb-1 flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Nearest Hospital
              </p>
              <p className="text-sm font-semibold text-white mb-3">
                {jsa.nearest_hospital || (
                  <span className="text-white/30 italic font-normal">
                    Not specified
                  </span>
                )}
              </p>
              <p className="text-[10px] text-red-200/60 mb-1 flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Nearest Clinic
              </p>
              <p className="text-sm font-semibold text-white">
                {jsa.nearest_clinic || (
                  <span className="text-white/30 italic font-normal">
                    Not specified
                  </span>
                )}
              </p>
            </div>

            {jsa.circuit_number && (
              <div className={sectionCard}>
                <SectionHeader
                  icon={MapPin}
                  label="Location"
                  accent="text-blue-300"
                />
                <p className="text-[10px] text-white/40 mb-1">Circuit</p>
                <p className="text-lg font-bold text-white">
                  {jsa.circuit_number}
                </p>
              </div>
            )}
          </div>

          {jsa.submission_type !== "paper" && (
            <>
              {/* Jobs & PPE */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className={sectionCard}>
                  <SectionHeader icon={Activity} label="Jobs Performed" />
                  {Array.isArray(jsa.jobs_performed) &&
                  jsa.jobs_performed.length > 0 ? (
                    <ul className="space-y-1.5">
                      {jsa.jobs_performed.map(
                        (
                          job: { label?: string; key?: string },
                          idx: number
                        ) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm text-white/80"
                          >
                            <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                            <span>{job.label || job.key || "Unknown job"}</span>
                          </li>
                        )
                      )}
                    </ul>
                  ) : (
                    <p className="text-sm text-white/40 italic">
                      No jobs recorded
                    </p>
                  )}
                </div>
                <div className={sectionCard}>
                  <SectionHeader
                    icon={Shield}
                    label="PPE Required"
                    accent="text-amber-300"
                  />
                  {jsa.ppe &&
                  Object.values(jsa.ppe).some(
                    (item: { required?: boolean }) => item?.required
                  ) ? (
                    <ul className="space-y-1.5">
                      {Object.entries(jsa.ppe).map(
                        ([key, value]: [
                          string,
                          { required?: boolean; condition?: string },
                        ]) => {
                          if (!value?.required) return null;
                          const item = PPE_ITEMS.find((p) => p.key === key);
                          return (
                            <li
                              key={key}
                              className="flex items-start gap-2 text-sm text-white/80"
                            >
                              <CheckCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                              <span>
                                {item?.label || key}
                                {value.condition === "needs_replaced" && (
                                  <span className="text-amber-300 text-xs ml-2">
                                    (Needs replaced)
                                  </span>
                                )}
                              </span>
                            </li>
                          );
                        }
                      )}
                    </ul>
                  ) : (
                    <p className="text-sm text-white/40 italic">
                      No PPE recorded
                    </p>
                  )}
                </div>
              </div>

              {/* Weather */}
              <div className={sectionCard}>
                <SectionHeader
                  icon={CloudRain}
                  label="Weather"
                  accent="text-blue-300"
                />
                {wc?.conditions ? (
                  <p className="text-sm text-white/80">
                    {Object.keys(wc.conditions)
                      .filter((k) => wc.conditions?.[k])
                      .join(", ") || "None"}
                  </p>
                ) : (
                  <p className="text-sm text-white/40 italic">
                    No weather recorded
                  </p>
                )}
                {jsa.weather_hazards && (
                  <p className="text-sm text-amber-200 mt-2 pt-2 border-t border-white/[0.05]">
                    {jsa.weather_hazards}
                  </p>
                )}
              </div>

              {/* Hazards */}
              <div
                className={`${sectionCard} border-red-500/20 bg-red-500/[0.04]`}
              >
                <SectionHeader
                  icon={AlertTriangle}
                  label="Identified Hazards"
                  accent="text-red-300"
                />
                {!hasHazards ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-200">
                    <CheckCircle className="w-4 h-4" />
                    No hazards recorded.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-52 overflow-y-auto">
                    {siteHazards.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-red-200/60 mb-1.5 font-semibold">
                          Site ({siteHazards.length})
                        </p>
                        <ul className="space-y-1">
                          {siteHazards.map((key) => {
                            const item = HAZARD_ITEMS.find(
                              (h) => h.key === key
                            );
                            return (
                              <li
                                key={key}
                                className="flex items-start gap-2 text-sm text-red-100"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 text-red-300 mt-0.5 flex-shrink-0" />
                                <span>{item?.label || key}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    {trafficHazards.length > 0 && (
                      <div
                        className={
                          siteHazards.length > 0
                            ? "pt-2 border-t border-red-500/20"
                            : ""
                        }
                      >
                        <p className="text-xs uppercase tracking-wider text-red-200/60 mb-1.5 font-semibold">
                          Traffic ({trafficHazards.length})
                        </p>
                        <ul className="space-y-1">
                          {trafficHazards.map((key) => {
                            const item = TRAFFIC_HAZARDS.find(
                              (h) => h.key === key
                            );
                            return (
                              <li
                                key={key}
                                className="flex items-start gap-2 text-sm text-red-100"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 text-red-300 mt-0.5 flex-shrink-0" />
                                <span>{item?.label || key}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Spans */}
              {Array.isArray(jsa.spans) && jsa.spans.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Navigation className="w-4 h-4 text-purple-300" />
                    <h3 className="text-sm font-semibold text-white">
                      Spans ({jsa.spans.length})
                    </h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 max-h-80 overflow-y-auto">
                    {jsa.spans.map((span: JsaSpan, idx: number) => (
                      <div key={idx} className={`${sectionCard} space-y-2`}>
                        <div className="flex justify-between pb-2 border-b border-white/[0.06]">
                          <h4 className="text-xs font-semibold text-purple-300 uppercase">
                            Span {span.spanNumber}
                          </h4>
                          {span.initials && (
                            <span className="text-[10px] text-white/40 font-mono">
                              {span.initials}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-white/40 uppercase">
                          Location
                        </p>
                        <p className="text-sm text-white/80">
                          {span.location || "—"}
                        </p>
                        {span.hazards && (
                          <>
                            <p className="text-[10px] text-amber-300/60 uppercase">
                              Hazards
                            </p>
                            <p className="text-sm text-amber-200">
                              {span.hazards}
                            </p>
                          </>
                        )}
                        {span.mitigation && (
                          <>
                            <p className="text-[10px] text-emerald-300/60 uppercase">
                              Mitigation
                            </p>
                            <p className="text-sm text-emerald-200">
                              {span.mitigation}
                            </p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Paper JSA Photos */}
          {jsa.jsa_photo_paths &&
            Array.isArray(jsa.jsa_photo_paths) &&
            jsa.jsa_photo_paths.length > 0 && (
              <JsaPhotoSection paths={jsa.jsa_photo_paths} />
            )}

          {/* Notes */}
          {jsa.notes?.trim() && (
            <div className={sectionCard}>
              <SectionHeader
                icon={FileText}
                label="Notes"
                accent="text-amber-300"
              />
              <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">
                {jsa.notes.trim()}
              </p>
            </div>
          )}

          {/* Signatures */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-emerald-300" />
              <h3 className="text-sm font-semibold text-white">Signatures</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={sectionCard}>
                <h4 className="text-xs uppercase tracking-wider text-white/40 mb-2">
                  Employee
                </h4>
                {jsa.employee_signature_path ? (
                  <>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-2 flex justify-center">
                      <img
                        src={
                          supabase.storage
                            .from("signatures")
                            .getPublicUrl(jsa.employee_signature_path).data
                            .publicUrl
                        }
                        alt="Employee signature"
                        className="max-h-20 object-contain"
                      />
                    </div>
                    <p className="text-[10px] text-white/40 text-center mt-2">
                      Verified
                    </p>
                  </>
                ) : jsa.employee_signature?.trim() ? (
                  <>
                    <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-3">
                      <p
                        className="text-2xl text-white/80 break-words"
                        style={{ fontFamily: "Caveat, cursive" }}
                      >
                        {jsa.employee_signature.trim()}
                      </p>
                    </div>
                    <p className="text-[10px] text-white/40 text-center mt-2">
                      Verified
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-white/40 italic">None</p>
                )}
              </div>
              {Array.isArray(jsa.observer_signatures) &&
                jsa.observer_signatures.length > 0 && (
                  <div className={sectionCard}>
                    <h4 className="text-xs uppercase tracking-wider text-white/40 mb-2">
                      Observers ({jsa.observer_signatures.length})
                    </h4>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {jsa.observer_signatures.map(
                        (obs: ObserverSignature, idx: number) => (
                          <div
                            key={idx}
                            className="rounded-lg border border-white/10 bg-black/30 p-2.5 space-y-2"
                          >
                            <div className="flex justify-between items-center gap-2">
                              <p className="text-sm font-semibold text-white truncate">
                                {obs.name}
                              </p>
                              <p className="text-[10px] text-white/30 shrink-0">
                                {new Date(obs.timestamp).toLocaleDateString()}
                              </p>
                            </div>
                            {obs.role && (
                              <p className="text-xs text-white/40">{obs.role}</p>
                            )}
                            <div className="rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2">
                              <p
                                className="text-xl text-white/80 break-words"
                                style={{ fontFamily: "Caveat, cursive" }}
                              >
                                {obs.signature_data}
                              </p>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  return typeof document !== "undefined"
    ? createPortal(content, document.body)
    : null;
});

export default JsaDetailModal;
