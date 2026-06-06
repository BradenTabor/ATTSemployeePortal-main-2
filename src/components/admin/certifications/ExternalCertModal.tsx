import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Loader2 } from 'lucide-react';
import { addMonths, format } from 'date-fns';
import { glass } from '../../../lib/glass';
import { toast } from '../../../lib/toast';
import {
  useExternalCertificationTypes,
  useAssignExternalCertification,
  useUpdateExternalCertification,
  useUploadCertDocument,
} from '../../../hooks/queries/useExternalCertifications';
import type {
  WorkerExternalCertification,
  ExternalCertificationType,
} from '../../../types/externalCertification';
import { Z } from "@/lib/zIndex";

interface ExternalCertModalProps {
  mode: 'assign' | 'edit';
  workerId: string;
  workerName: string;
  existingCert?: WorkerExternalCertification;
  onClose: () => void;
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white ' +
  'placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50';

const labelClass = 'block text-sm font-medium text-white/80 mb-1';

export function ExternalCertModal({
  mode,
  workerId,
  workerName,
  existingCert,
  onClose,
}: ExternalCertModalProps) {
  const { data: certTypes = [] } = useExternalCertificationTypes();
  const assignMutation = useAssignExternalCertification();
  const updateMutation = useUpdateExternalCertification();
  const uploadMutation = useUploadCertDocument();

  const [certTypeId, setCertTypeId] = useState(existingCert?.external_certification_type_id ?? '');
  const [issuedDate, setIssuedDate] = useState(existingCert?.issued_date ?? '');
  const [expirationDate, setExpirationDate] = useState(existingCert?.expiration_date ?? '');
  const [issuingAuthority, setIssuingAuthority] = useState(existingCert?.issuing_authority ?? '');
  const [credentialNumber, setCredentialNumber] = useState(existingCert?.credential_number ?? '');
  const [notes, setNotes] = useState(existingCert?.notes ?? '');
  const [file, setFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedType: ExternalCertificationType | undefined = certTypes.find(
    (t) => t.id === certTypeId,
  );

  function autoFillExpiration(issued: string, typeId: string) {
    if (mode === 'edit') return;
    const ct = certTypes.find((t) => t.id === typeId);
    if (!issued || !ct?.validity_months) return;
    const [y, m, d] = issued.split('-').map(Number);
    const exp = addMonths(new Date(y, m - 1, d), ct.validity_months);
    setExpirationDate(format(exp, 'yyyy-MM-dd'));
  }

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  const isPending =
    assignMutation.isPending || updateMutation.isPending || uploadMutation.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'assign' && !certTypeId) {
      toast.error('Please select a certification type.');
      return;
    }

    try {
      let documentUrl: string | undefined;

      if (file) {
        // For assign mode we won't have a cert id yet — upload after insert using a temp id,
        // then update the record. For edit mode we have the cert id.
        const tempCertId = existingCert?.id ?? crypto.randomUUID();
        documentUrl = await uploadMutation.mutateAsync({
          workerUserId: workerId,
          certId: tempCertId,
          file,
        });
      }

      if (mode === 'assign') {
        await assignMutation.mutateAsync({
          userId: workerId,
          externalCertificationTypeId: certTypeId,
          issuedDate: issuedDate || undefined,
          expirationDate: expirationDate || undefined,
          issuingAuthority: issuingAuthority || undefined,
          credentialNumber: credentialNumber || undefined,
          documentUrl,
          notes: notes || undefined,
        });
        toast.success('Certification assigned', `Added for ${workerName}.`);
      } else if (existingCert) {
        await updateMutation.mutateAsync({
          id: existingCert.id,
          userId: workerId,
          updates: {
            issued_date: issuedDate || null,
            expiration_date: expirationDate || null,
            issuing_authority: issuingAuthority || null,
            credential_number: credentialNumber || null,
            document_url: documentUrl ?? existingCert.document_url,
            notes: notes || null,
          },
        });
        toast.success('Certification updated', `Updated for ${workerName}.`);
      }

      onClose();
    } catch (err) {
      toast.error(
        mode === 'assign' ? 'Failed to assign certification' : 'Failed to update certification',
        err instanceof Error ? err.message : 'Unknown error',
      );
    }
  }

  const modal = (
    <div style={{ zIndex: Z.modal }}
      className="fixed inset-0 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`${glass.elevated} w-full max-w-md p-6`}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            {mode === 'assign' ? 'Assign Certification' : 'Edit Certification'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-white/50">
          {mode === 'assign' ? 'Assign to' : 'Editing for'}{' '}
          <span className="font-medium text-white/80">{workerName}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cert type */}
          <div>
            <label className={labelClass}>Certification Type</label>
            {mode === 'assign' ? (
              <select
                value={certTypeId}
                onChange={(e) => {
                  setCertTypeId(e.target.value);
                  autoFillExpiration(issuedDate, e.target.value);
                }}
                className={inputClass}
                required
              >
                <option value="">Select type…</option>
                {certTypes
                  .filter((t) => t.is_active)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            ) : (
              <input
                type="text"
                value={existingCert?.cert_type_name ?? ''}
                disabled
                className={`${inputClass} cursor-not-allowed opacity-60`}
              />
            )}
          </div>

          {/* Issued date */}
          <div>
            <label className={labelClass}>Issued Date</label>
            <input
              type="date"
              value={issuedDate}
              onChange={(e) => {
                setIssuedDate(e.target.value);
                autoFillExpiration(e.target.value, certTypeId);
              }}
              className={inputClass}
            />
          </div>

          {/* Expiration date */}
          <div>
            <label className={labelClass}>
              Expiration Date
              {selectedType?.validity_months && mode === 'assign' && (
                <span className="ml-1 text-xs text-white/40">
                  (auto: {selectedType.validity_months} months)
                </span>
              )}
            </label>
            <input
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Issuing authority */}
          <div>
            <label className={labelClass}>Issuing Authority</label>
            <input
              type="text"
              value={issuingAuthority}
              onChange={(e) => setIssuingAuthority(e.target.value)}
              placeholder="e.g. PowerSafe, American Red Cross"
              className={inputClass}
            />
          </div>

          {/* Credential number */}
          <div>
            <label className={labelClass}>Credential Number</label>
            <input
              type="text"
              value={credentialNumber}
              onChange={(e) => setCredentialNumber(e.target.value)}
              placeholder="Certificate or license number"
              className={inputClass}
            />
          </div>

          {/* Document upload */}
          <div>
            <label className={labelClass}>
              {mode === 'edit' && existingCert?.document_url ? 'Replace Document' : 'Document'}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={
                'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-dashed ' +
                'border-white/20 bg-white/[0.03] px-3 py-2 text-sm text-white/60 transition-colors ' +
                'hover:border-white/30 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50'
              }
            >
              <Upload className="h-4 w-4" />
              {file ? file.name : 'Choose file (image or PDF)'}
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes…"
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className={
                'min-h-[44px] flex-1 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white ' +
                'transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 ' +
                'disabled:opacity-50'
              }
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={
                'flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg ' +
                'bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-300 ring-1 ring-emerald-500/40 ' +
                'transition-colors hover:bg-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 ' +
                'disabled:opacity-50'
              }
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'assign' ? 'Assign' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
