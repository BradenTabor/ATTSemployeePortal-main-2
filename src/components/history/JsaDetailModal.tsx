import { memo } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useModalOverlay } from "../../hooks/useModalOverlay";
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
} from "lucide-react";
import type { DailyJsaRecord, ObserverSignature, JsaSpan } from "../../pages/forms/DailyJSAForm";

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
  return d.toLocaleString();
}

const cardBase =
  "rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm shadow-[inset_0_2px_12px_rgba(0,0,0,0.3)]";

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
    ? Object.keys(jsa.hazards_present).filter((k) => (jsa.hazards_present as Record<string, boolean>)[k])
    : [];
  const trafficHazards = jsa.traffic_hazards
    ? Object.keys(jsa.traffic_hazards).filter((k) => (jsa.traffic_hazards as Record<string, boolean>)[k])
    : [];
  const hasHazards = siteHazards.length > 0 || trafficHazards.length > 0;
  const wc = jsa.weather_conditions as { conditions?: Record<string, boolean> } | undefined;
  const { modalRef, zIndex } = useModalOverlay({ isOpen: true, onClose, zIndex: 100 });

  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 flex items-center justify-center px-4"
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
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16, scale: prefersReducedMotion ? 1 : 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.2 }
            : { type: "spring", damping: 28, stiffness: 300 }
        }
        className="relative z-10 w-full max-w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a0f0d] via-[#0d1612] to-[#0a120e] p-5 sm:p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6 pb-5 border-b border-white/10">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-400/30">
                  <FileText className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50 font-medium">Job Safety Analysis</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Submitted {formatDateTime(jsa.created_at)}</p>
                </div>
              </div>
              <h2 id="jsa-detail-modal-title" className="text-xl sm:text-2xl font-bold text-white break-words leading-tight">
                {jsa.work_location || "N/A"}
              </h2>
              {jsa.circuit_number && (
                <p className="text-sm text-white/70 mt-1">Circuit: {jsa.circuit_number}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  status === "draft"
                    ? "border-yellow-400/60 bg-yellow-500/10 text-yellow-100"
                    : "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
                }`}
              >
                {status === "draft" ? <Edit3 className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {status === "draft" ? "Draft" : "Completed"}
              </span>
              <button
                type="button"
                onClick={() => onEdit(jsa)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30 hover:border-emerald-400/50 focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d] outline-none transition-all active:scale-95"
                aria-label="Edit JSA"
              >
                <Edit3 className="w-3.5 h-3.5" aria-hidden />
                Edit
              </button>
              {onDuplicate && (
                <button
                  type="button"
                  onClick={onDuplicate}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/60 focus-visible:ring-2 focus-visible:ring-amber-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d] outline-none transition-all active:scale-95"
                  aria-label="Duplicate"
                >
                  <Copy className="w-3.5 h-3.5" aria-hidden />
                  Duplicate
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 hover:bg-white/10 hover:border-white/30 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d] outline-none transition-all active:scale-95"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" aria-hidden />
                Close
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {/* Job details, emergency, location */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className={cardBase}>
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                  <Calendar className="w-4 h-4 text-emerald-300" />
                  <h3 className="text-xs uppercase tracking-wider text-white/70 font-semibold">Job Details</h3>
                </div>
                <p className="text-[10px] uppercase text-white/50 mb-1">Job Date</p>
                <p className="text-sm font-medium text-white mb-3">
                  {jsa.job_date
                    ? new Date(jsa.job_date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "—"}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                  <div>
                    <p className="text-[10px] text-white/50 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Call In
                    </p>
                    <p className="text-sm font-medium text-white">{jsa.call_in_time || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/50 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Call Out
                    </p>
                    <p className="text-sm font-medium text-white">{jsa.call_out_time || "—"}</p>
                  </div>
                </div>
              </div>

              <div className={`${cardBase} border-red-400/30 bg-red-500/10`}>
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-red-400/20">
                  <AlertCircle className="w-4 h-4 text-red-200" />
                  <h3 className="text-xs uppercase tracking-wider text-red-200 font-semibold">Emergency Contacts</h3>
                </div>
                <p className="text-[10px] text-red-200/70 mb-1 flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Nearest Hospital
                </p>
                <p className="text-sm font-semibold text-white mb-3">
                  {jsa.nearest_hospital || <span className="text-white/40 italic">Not specified</span>}
                </p>
                <p className="text-[10px] text-red-200/70 mb-1 flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Nearest Clinic
                </p>
                <p className="text-sm font-semibold text-white">
                  {jsa.nearest_clinic || <span className="text-white/40 italic">Not specified</span>}
                </p>
              </div>

              {jsa.circuit_number && (
                <div className={cardBase}>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                    <MapPin className="w-4 h-4 text-blue-300" />
                    <h3 className="text-xs uppercase tracking-wider text-white/70 font-semibold">Location</h3>
                  </div>
                  <p className="text-[10px] text-white/50 mb-1">Circuit</p>
                  <p className="text-lg font-bold text-white">{jsa.circuit_number}</p>
                </div>
              )}
            </div>

            {/* Jobs & PPE */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={cardBase}>
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                  <Activity className="w-4 h-4 text-emerald-300" />
                  <h4 className="text-xs uppercase tracking-wider text-white/70 font-semibold">Jobs Performed</h4>
                </div>
                {Array.isArray(jsa.jobs_performed) && jsa.jobs_performed.length > 0 ? (
                  <ul className="space-y-1.5">
                    {jsa.jobs_performed.map((job: { label?: string; key?: string }, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-white/90">
                        <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>{job.label || job.key || "Unknown job"}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-white/50 italic">No jobs recorded</p>
                )}
              </div>
              <div className={cardBase}>
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                  <Shield className="w-4 h-4 text-amber-300" />
                  <h4 className="text-xs uppercase tracking-wider text-white/70 font-semibold">PPE Required</h4>
                </div>
                {jsa.ppe && Object.values(jsa.ppe).some((item: { required?: boolean }) => item?.required) ? (
                  <ul className="space-y-1.5">
                    {Object.entries(jsa.ppe).map(([key, value]: [string, { required?: boolean; condition?: string }]) => {
                      if (!value?.required) return null;
                      const item = PPE_ITEMS.find((p) => p.key === key);
                      return (
                        <li key={key} className="flex items-start gap-2 text-sm text-white/90">
                          <CheckCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                          <span>
                            {item?.label || key}
                            {value.condition === "needs_replaced" && (
                              <span className="text-amber-300 text-xs ml-2">(Needs replaced)</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-white/50 italic">No PPE recorded</p>
                )}
              </div>
            </div>

            {/* Weather */}
            <div className={cardBase}>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                <CloudRain className="w-4 h-4 text-blue-300" />
                <h3 className="text-xs uppercase tracking-wider text-white/70 font-semibold">Weather</h3>
              </div>
              {wc?.conditions ? (
                <p className="text-sm text-white/90">
                  {Object.keys(wc.conditions)
                    .filter((k) => wc.conditions?.[k])
                    .join(", ") || "None"}
                </p>
              ) : (
                <p className="text-sm text-white/50 italic">No weather recorded</p>
              )}
              {jsa.weather_hazards && (
                <p className="text-sm text-amber-200 mt-2 pt-2 border-t border-white/5">{jsa.weather_hazards}</p>
              )}
            </div>

            {/* Hazards */}
            <div className={`${cardBase} border-red-400/30 bg-red-500/10`}>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-red-400/20">
                <AlertTriangle className="w-4 h-4 text-red-200" />
                <h3 className="text-xs uppercase tracking-wider text-red-200 font-semibold">Identified Hazards</h3>
              </div>
              {!hasHazards ? (
                <div className="flex items-center gap-2 text-sm text-emerald-200">
                  <CheckCircle className="w-4 h-4" />
                  No hazards recorded.
                </div>
              ) : (
                <div className="space-y-3 max-h-52 overflow-y-auto">
                  {siteHazards.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-red-200/80 mb-1.5 font-semibold">
                        Site ({siteHazards.length})
                      </p>
                      <ul className="space-y-1">
                        {siteHazards.map((key) => {
                          const item = HAZARD_ITEMS.find((h) => h.key === key);
                          return (
                            <li key={key} className="flex items-start gap-2 text-sm text-red-50">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-300 mt-0.5 flex-shrink-0" />
                              <span>{item?.label || key}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  {trafficHazards.length > 0 && (
                    <div className={siteHazards.length > 0 ? "pt-2 border-t border-red-400/20" : ""}>
                      <p className="text-xs uppercase tracking-wider text-red-200/80 mb-1.5 font-semibold">
                        Traffic ({trafficHazards.length})
                      </p>
                      <ul className="space-y-1">
                        {trafficHazards.map((key) => {
                          const item = TRAFFIC_HAZARDS.find((h) => h.key === key);
                          return (
                            <li key={key} className="flex items-start gap-2 text-sm text-red-50">
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
                  <h3 className="text-xs uppercase tracking-wider text-white/70 font-semibold">
                    Spans ({jsa.spans.length})
                  </h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 max-h-80 overflow-y-auto">
                  {jsa.spans.map((span: JsaSpan, idx: number) => (
                    <div key={idx} className={`${cardBase} space-y-2`}>
                      <div className="flex justify-between pb-2 border-b border-white/10">
                        <h4 className="text-xs font-semibold text-purple-300 uppercase">Span {span.spanNumber}</h4>
                        {span.initials && (
                          <span className="text-[10px] text-white/50 font-mono">{span.initials}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-white/50 uppercase">Location</p>
                      <p className="text-sm text-white/90">{span.location || "—"}</p>
                      {span.hazards && (
                        <>
                          <p className="text-[10px] text-amber-300/70 uppercase">Hazards</p>
                          <p className="text-sm text-amber-200">{span.hazards}</p>
                        </>
                      )}
                      {span.mitigation && (
                        <>
                          <p className="text-[10px] text-emerald-300/70 uppercase">Mitigation</p>
                          <p className="text-sm text-emerald-200">{span.mitigation}</p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {jsa.notes?.trim() && (
              <div className={cardBase}>
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                  <FileText className="w-4 h-4 text-amber-300" />
                  <h3 className="text-xs uppercase tracking-wider text-white/70 font-semibold">Notes</h3>
                </div>
                <p className="text-sm text-white/90 whitespace-pre-wrap">{jsa.notes.trim()}</p>
              </div>
            )}

            {/* Signatures (typed text, not sign-pad images) */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-emerald-300" />
                <h3 className="text-xs uppercase tracking-wider text-white/70 font-semibold">Signatures</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className={cardBase}>
                  <h4 className="text-xs uppercase tracking-wider text-white/50 mb-2">Employee</h4>
                  {jsa.employee_signature?.trim() ? (
                    <>
                      <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-3">
                        <p
                          className="text-2xl text-white/90 break-words"
                          style={{ fontFamily: "Caveat, cursive" }}
                        >
                          {jsa.employee_signature.trim()}
                        </p>
                      </div>
                      <p className="text-[10px] text-white/50 text-center mt-2">Verified</p>
                    </>
                  ) : (
                    <p className="text-sm text-white/50 italic">None</p>
                  )}
                </div>
                {Array.isArray(jsa.observer_signatures) && jsa.observer_signatures.length > 0 && (
                  <div className={cardBase}>
                    <h4 className="text-xs uppercase tracking-wider text-white/50 mb-2">
                      Observers ({jsa.observer_signatures.length})
                    </h4>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {jsa.observer_signatures.map((obs: ObserverSignature, idx: number) => (
                        <div key={idx} className="rounded-lg border border-white/10 bg-black/30 p-2.5 space-y-2">
                          <div className="flex justify-between items-center gap-2">
                            <p className="text-sm font-semibold text-white truncate">{obs.name}</p>
                            <p className="text-[10px] text-white/40 shrink-0">
                              {new Date(obs.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                          {obs.role && (
                            <p className="text-xs text-white/50">{obs.role}</p>
                          )}
                          <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                            <p
                              className="text-xl text-white/90 break-words"
                              style={{ fontFamily: "Caveat, cursive" }}
                            >
                              {obs.signature_data}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
    </motion.div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
});

export default JsaDetailModal;
