import { memo } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useModalOverlay } from "../../hooks/useModalOverlay";
import { glass } from "../../lib/glass";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Fuel,
  Truck,
  Images,
  FileSignature,
  Copy,
  X,
  ChevronDown,
} from "lucide-react";

export interface MediaEntry {
  label: string;
  url: string;
}

export interface SignatureEntry {
  label: string;
  url?: string;
  text?: string;
}

export interface DvirDetailModalProps {
  truckNumber: string | null;
  submittedAt: string;
  status: "failed" | "passed";
  failCount: number;
  hasMechanicUpdate: boolean;
  vehicleFails: string[];
  aerialFails: string[];
  chipperNumber: string | null;
  trailerNumber: string | null;
  mileage: number | null;
  truckGvwr: string | null;
  driversName: string | null;
  driversLicenseNumber: string | null;
  driversLicenseClass: string | null;
  medicalCardExp: string | null;
  notes: string | null;
  aerialNotes: string | null;
  mediaEntries: MediaEntry[];
  signatureEntries: SignatureEntry[];
  onClose: () => void;
  onUseAsTemplate?: () => void;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown date";
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/[0.06]">
      <Icon className={`w-4 h-4 ${accent}`} />
      <h3 className="text-xs uppercase tracking-wider text-white/50 font-semibold">
        {label}
      </h3>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline gap-2 py-1">
      <span className="text-xs text-white/40">{label}</span>
      <span className="text-sm text-white/80 font-medium text-right truncate">
        {value}
      </span>
    </div>
  );
}

export const DvirDetailModal = memo(function DvirDetailModal({
  truckNumber,
  submittedAt,
  status,
  failCount,
  hasMechanicUpdate,
  vehicleFails,
  aerialFails,
  chipperNumber,
  trailerNumber,
  mileage,
  truckGvwr,
  driversName,
  driversLicenseNumber,
  driversLicenseClass,
  medicalCardExp,
  notes,
  aerialNotes,
  mediaEntries,
  signatureEntries,
  onClose,
  onUseAsTemplate,
}: DvirDetailModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const allFails = [...vehicleFails, ...aerialFails];
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
        aria-labelledby="dvir-detail-modal-title"
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
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-gray-800 border-b border-white/[0.06] px-5 sm:px-6 py-4">
          {/* Mobile drag handle */}
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3 sm:hidden" />

          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <Truck className="w-4 h-4 text-emerald-300" aria-hidden />
                </div>
                <h2
                  id="dvir-detail-modal-title"
                  className="text-lg sm:text-xl font-bold text-white truncate"
                >
                  Truck {truckNumber || "N/A"}
                </h2>
              </div>
              <p className="text-xs text-white/40 font-mono">
                {formatDateTime(submittedAt)}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  status === "failed"
                    ? "border-red-500/40 bg-red-500/15 text-red-200"
                    : "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                }`}
              >
                {status === "failed" ? (
                  <>
                    <AlertTriangle className="w-3 h-3" aria-hidden />
                    {failCount} Fail{failCount !== 1 ? "s" : ""}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3" aria-hidden />
                    Passed
                  </>
                )}
              </span>
              {hasMechanicUpdate && (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1 text-xs font-semibold text-yellow-200">
                  <Clock className="w-3 h-3" aria-hidden />
                  Mechanic
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
          {onUseAsTemplate && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onUseAsTemplate}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/50 focus-visible:ring-2 focus-visible:ring-emerald-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 outline-none transition-all active:scale-[0.98]"
              >
                <Copy className="w-3.5 h-3.5" aria-hidden />
                Use as Template
              </button>
            </div>
          )}

          {/* Vehicle & Driver cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={sectionCard}>
              <SectionHeader icon={Truck} label="Vehicle" />
              <div className="divide-y divide-white/[0.04]">
                <DetailRow
                  label="Chipper"
                  value={chipperNumber ? `#${chipperNumber}` : "—"}
                />
                <DetailRow
                  label="Trailer"
                  value={trailerNumber ? `#${trailerNumber}` : "—"}
                />
                <DetailRow
                  label="Mileage"
                  value={mileage?.toLocaleString() ?? "—"}
                />
                <DetailRow label="GVWR" value={truckGvwr || "—"} />
              </div>
            </div>
            <div className={sectionCard}>
              <SectionHeader icon={Fuel} label="Driver & Compliance" />
              <div className="divide-y divide-white/[0.04]">
                <DetailRow label="Driver" value={driversName ?? "—"} />
                <DetailRow
                  label="License"
                  value={driversLicenseNumber || "—"}
                />
                <DetailRow label="Class" value={driversLicenseClass || "—"} />
                <DetailRow
                  label="Med Card Exp"
                  value={medicalCardExp || "—"}
                />
              </div>
            </div>
          </div>

          {/* Checklist results */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ChevronDown className="w-4 h-4 text-white/30" aria-hidden />
              <h3 className="text-sm font-semibold text-white">
                Checklist Results
              </h3>
            </div>
            {allFails.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" aria-hidden />
                All inspection items passed.
              </div>
            ) : (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 space-y-3 text-sm max-h-56 overflow-y-auto">
                {vehicleFails.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-red-200/70 mb-1.5 font-semibold">
                      Vehicle / Trailer
                    </p>
                    <ul className="space-y-1">
                      {vehicleFails.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2 text-red-100"
                        >
                          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0 text-red-300" aria-hidden />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {aerialFails.length > 0 && (
                  <div
                    className={
                      vehicleFails.length > 0
                        ? "pt-2 border-t border-red-500/20"
                        : ""
                    }
                  >
                    <p className="text-xs uppercase tracking-wider text-red-200/70 mb-1.5 font-semibold">
                      Aerial Lift
                    </p>
                    <ul className="space-y-1">
                      {aerialFails.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2 text-red-100"
                        >
                          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0 text-red-300" aria-hidden />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={sectionCard}>
              <p className="text-xs uppercase tracking-wider text-white/40 mb-2">
                Driver Notes
              </p>
              <p className="text-sm text-white/70 leading-relaxed min-h-[40px]">
                {notes?.trim() || (
                  <span className="italic text-white/30">No notes provided</span>
                )}
              </p>
            </div>
            <div className={sectionCard}>
              <p className="text-xs uppercase tracking-wider text-white/40 mb-2">
                Aerial Notes
              </p>
              <p className="text-sm text-white/70 leading-relaxed min-h-[40px]">
                {aerialNotes?.trim() || (
                  <span className="italic text-white/30">No aerial notes provided</span>
                )}
              </p>
            </div>
          </div>

          {/* Photos */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Images className="w-4 h-4 text-emerald-300" aria-hidden />
              <h3 className="text-sm font-semibold text-white">
                Inspection Photos
              </h3>
              {mediaEntries.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                  {mediaEntries.length}
                </span>
              )}
            </div>
            {mediaEntries.length === 0 ? (
              <p className="text-sm text-white/40 italic">
                No photos uploaded for this inspection.
              </p>
            ) : (
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                {mediaEntries.map((media) => (
                  <a
                    key={media.label}
                    href={media.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden hover:border-emerald-400/30 transition-colors"
                  >
                    <img
                      src={media.url}
                      alt={media.label}
                      className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                    <div className="px-2.5 py-2 text-[11px] text-white/50 truncate">
                      {media.label}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Signatures */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileSignature className="w-4 h-4 text-emerald-300" aria-hidden />
              <h3 className="text-sm font-semibold text-white">Signatures</h3>
            </div>
            {signatureEntries.length === 0 ? (
              <p className="text-sm text-white/40 italic">
                No signatures attached.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {signatureEntries.map((sig) =>
                  sig.url ? (
                    <a
                      key={sig.label}
                      href={sig.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${sectionCard} flex flex-col gap-2 hover:border-emerald-400/30 transition-colors`}
                    >
                      <p className="text-xs uppercase tracking-wider text-white/40">
                        {sig.label}
                      </p>
                      <img
                        src={sig.url}
                        alt={sig.label}
                        className="h-24 w-full object-contain bg-black/30 rounded-lg"
                      />
                    </a>
                  ) : (
                    <div
                      key={sig.label}
                      className={`${sectionCard} flex flex-col gap-2`}
                    >
                      <p className="text-xs uppercase tracking-wider text-white/40">
                        {sig.label}
                      </p>
                      <p className="text-sm text-white">{sig.text ?? "—"}</p>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  return typeof document !== "undefined"
    ? createPortal(content, document.body)
    : null;
});

export default DvirDetailModal;
