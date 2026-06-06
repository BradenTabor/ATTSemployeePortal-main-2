import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { glass } from "../../../lib/glass";
import { toast } from "../../../lib/toast";
import { useCertificationTypes, useGrantCertificationAccess } from "../../../hooks/useCertifications";
import { Z } from "@/lib/zIndex";

interface GrantCertAccessModalProps {
  workerId: string;
  workerName: string;
  onClose: () => void;
}

export function GrantCertAccessModal({
  workerId,
  workerName,
  onClose,
}: GrantCertAccessModalProps) {
  const { data: certTypes = [] } = useCertificationTypes();
  const grantAccess = useGrantCertificationAccess();
  const [selectedCertTypeId, setSelectedCertTypeId] = useState("");

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  const handleSubmit = () => {
    if (!selectedCertTypeId) {
      toast.error("Please select a certification type.");
      return;
    }
    grantAccess.mutate(
      { userId: workerId, certificationTypeId: selectedCertTypeId },
      {
        onSuccess: () => {
          toast.success("Access granted. The worker can now take this certification.");
          onClose();
        },
        onError: (e) => {
          toast.error((e as Error)?.message ?? "Failed to grant access.");
        },
      }
    );
  };

  return createPortal(
    <div style={{ zIndex: Z.modal }}
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="grant-cert-access-title"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        className={`${glass.elevated} w-full max-w-md p-5`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2
            id="grant-cert-access-title"
            className="text-lg font-semibold text-white"
          >
            Grant certification access — {workerName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <p className="text-sm text-white/70 mb-4">
          Grant this worker access to take the selected certification. They will see it in their certifications and can start the test when ready.
        </p>
        <label className="block text-sm font-medium text-white/80 mb-1.5">
          Certification type
        </label>
        <select
          value={selectedCertTypeId}
          onChange={(e) => setSelectedCertTypeId(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 min-h-[44px]"
          aria-label="Select certification type"
          data-testid="grant-cert-access-type-select"
        >
          <option value="">Select…</option>
          {certTypes.map((ct) => (
            <option key={ct.id} value={ct.id}>
              {ct.name}
            </option>
          ))}
        </select>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedCertTypeId || grantAccess.isPending}
            data-testid="grant-cert-access-submit"
            className="rounded-lg bg-emerald-500/20 px-3 py-2 text-sm font-medium text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30 disabled:opacity-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50"
          >
            {grantAccess.isPending ? "Granting…" : "Grant access"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
