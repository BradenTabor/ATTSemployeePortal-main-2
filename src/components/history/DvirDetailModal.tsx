import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
  return d.toLocaleString();
}

const cardBase =
  "rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm shadow-[inset_0_2px_12px_rgba(0,0,0,0.3)]";

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-40 flex items-center justify-center px-4"
    >
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16, scale: prefersReducedMotion ? 1 : 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.2 }
            : { type: "spring", damping: 28, stiffness: 300 }
        }
        className="relative z-50 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a0f0d] via-[#0d1612] to-[#0a120e] p-5 sm:p-8 shadow-2xl space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between pb-5 border-b border-white/10">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider text-white/50">Truck</p>
            <h2 className="text-xl sm:text-2xl font-bold text-white break-normal mt-1">
              {truckNumber || "N/A"}
            </h2>
            <p className="text-sm text-white/60 mt-1">
              Submitted {formatDateTime(submittedAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                status === "failed"
                  ? "border-red-400/60 bg-red-500/10 text-red-100"
                  : "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
              }`}
            >
              {status === "failed" ? (
                <>
                  <AlertTriangle className="w-3 h-3" />
                  {failCount} Fail{failCount !== 1 ? "s" : ""}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  All systems go
                </>
              )}
            </span>
            {hasMechanicUpdate && (
              <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/60 bg-yellow-500/10 px-3 py-1.5 text-xs font-semibold text-yellow-100">
                <Clock className="w-3 h-3" />
                Mechanic updated
              </span>
            )}
            {onUseAsTemplate && (
              <button
                type="button"
                onClick={onUseAsTemplate}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/60 focus-visible:ring-2 focus-visible:ring-emerald-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d] outline-none transition-all active:scale-95"
                aria-label="Use as template"
              >
                <Copy className="w-3.5 h-3.5" aria-hidden />
                Use as Template
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className={cardBase}>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
              <Truck className="w-4 h-4 text-emerald-300" />
              <h3 className="text-xs uppercase tracking-wider text-white/70 font-semibold">Vehicle</h3>
            </div>
            <p className="text-sm text-white/80">Chipper #{chipperNumber || "—"}</p>
            <p className="text-sm text-white/80">Trailer #{trailerNumber || "—"}</p>
            <p className="text-sm text-white/80">Mileage {mileage?.toLocaleString() ?? "—"}</p>
            <p className="text-sm text-white/80">GVWR Truck {truckGvwr || "—"}</p>
          </div>
          <div className={cardBase}>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
              <Fuel className="w-4 h-4 text-emerald-300" />
              <h3 className="text-xs uppercase tracking-wider text-white/70 font-semibold">Driver & Compliance</h3>
            </div>
            <p className="text-sm text-white/80">Driver: {driversName ?? "—"}</p>
            <p className="text-sm text-white/80">License #: {driversLicenseNumber || "—"}</p>
            <p className="text-sm text-white/80">Class: {driversLicenseClass || "—"}</p>
            <p className="text-sm text-white/80">Med Card Exp: {medicalCardExp || "—"}</p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white">Checklist & Notes</h3>
          {allFails.length === 0 ? (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/20 px-4 py-3 text-sm text-emerald-50">
              No failed items recorded for this inspection.
            </div>
          ) : (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 space-y-3 text-sm text-red-50 max-h-56 overflow-y-auto">
              {vehicleFails.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-red-200 mb-1 font-semibold">Vehicle / Trailer</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {vehicleFails.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {aerialFails.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-red-200 mb-1 font-semibold">Aerial Lift</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {aerialFails.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={cardBase}>
              <p className="text-xs uppercase tracking-wider text-white/50 mb-2">Driver Notes</p>
              <p className="text-sm text-white/80 min-h-[48px]">
                {notes?.trim() || "No notes provided."}
              </p>
            </div>
            <div className={cardBase}>
              <p className="text-xs uppercase tracking-wider text-white/50 mb-2">Aerial Notes</p>
              <p className="text-sm text-white/80 min-h-[48px]">
                {aerialNotes?.trim() || "No aerial notes provided."}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Images className="w-4 h-4 text-emerald-300" />
            Inspection Photos
          </h3>
          {mediaEntries.length === 0 ? (
            <p className="text-sm text-white/60">No photos uploaded.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {mediaEntries.map((media) => (
                <a
                  key={media.label}
                  href={media.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-emerald-400/40 transition"
                >
                  <div className="p-2.5 text-xs uppercase tracking-wider text-white/50">{media.label}</div>
                  <img
                    src={media.url}
                    alt={media.label}
                    className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-emerald-300" />
            Signatures
          </h3>
          {signatureEntries.length === 0 ? (
            <p className="text-sm text-white/60">No signatures attached.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {signatureEntries.map((sig) =>
                sig.url ? (
                  <a
                    key={sig.label}
                    href={sig.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${cardBase} flex flex-col gap-2 hover:border-emerald-400/40 transition`}
                  >
                    <p className="text-xs uppercase tracking-wider text-white/50">{sig.label}</p>
                    <img
                      src={sig.url}
                      alt={sig.label}
                      className="h-28 w-full object-contain bg-black/30 rounded-lg"
                    />
                  </a>
                ) : (
                  <div key={sig.label} className={`${cardBase} flex flex-col gap-2`}>
                    <p className="text-xs uppercase tracking-wider text-white/50">{sig.label}</p>
                    <p className="text-sm text-white">{sig.text ?? "—"}</p>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
});

export default DvirDetailModal;
