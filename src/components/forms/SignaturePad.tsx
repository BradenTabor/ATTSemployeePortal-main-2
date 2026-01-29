/**
 * SignaturePad: canvas signature with validation and optional storage path.
 * Uses SignatureCanvas for drawing; validates (min bounding box, min ink) and
 * uploads to Supabase Storage. Outputs storage path for form submission.
 */

import { useCallback, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { SignatureCanvas } from './SignatureCanvas';
import { validateSignatureFromDataUrl } from '../../lib/signatureValidation';
import { useSignatureUpload } from '../../hooks/useSignatureUpload';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import { Pencil } from 'lucide-react';

const BUCKET = 'signatures';

export interface SignaturePadProps {
  /** Current value: storage path or empty */
  value: string;
  /** Callback with storage path after validate + upload */
  onChange: (path: string) => void;
  /** Form type for storage path (userId/formType/timestamp.png) */
  formType: 'jsa' | 'dvir' | 'equipment';
  /** Whether the field is required */
  required?: boolean;
  /** Optional validation error from parent */
  error?: string;
  className?: string;
}

export function SignaturePad({
  value,
  onChange,
  formType,
  required,
  error,
  className,
}: SignaturePadProps) {
  const { user } = useAuth();
  const { uploadSignature } = useSignatureUpload();
  const [dataUrl, setDataUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleCanvasChange = useCallback(
    async (newDataUrl: string) => {
      setDataUrl(newDataUrl);
      setValidationError(null);

      if (!newDataUrl || !user?.id) {
        onChange('');
        return;
      }

      const validation = await validateSignatureFromDataUrl(newDataUrl);
      if (!validation.valid) {
        setValidationError(validation.error ?? 'Invalid signature');
        onChange('');
        return;
      }

      setUploading(true);
      try {
        const path = await uploadSignature(newDataUrl, formType, user.id);
        onChange(path);
      } catch {
        setValidationError('Upload failed. Try again.');
        onChange('');
      } finally {
        setUploading(false);
      }
    },
    [onChange, formType, user?.id, uploadSignature]
  );

  const handleClear = useCallback(() => {
    setDataUrl('');
    setValidationError(null);
    onChange('');
  }, [onChange]);

  const publicUrl = value
    ? supabase.storage.from(BUCKET).getPublicUrl(value).data.publicUrl
    : null;

  if (value && publicUrl) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center justify-between">
          <label className="block text-[10px] font-medium text-white/50 uppercase tracking-wide">
            Signature {required && <span className="text-emerald-400">*</span>}
          </label>
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
          >
            <Pencil className="w-3 h-3" />
            Change
          </button>
        </div>
        <div className="rounded-xl border border-emerald-500/40 bg-black/40 p-2">
          <img
            src={publicUrl}
            alt="Your signature"
            className="h-20 object-contain mx-auto"
          />
        </div>
        {error && <p className="text-[10px] text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <SignatureCanvas
        value={dataUrl}
        onChange={handleCanvasChange}
        placeholder="Sign here"
        required={required}
      />
      {uploading && (
        <p className="text-[10px] text-amber-400">Uploading signature…</p>
      )}
      {validationError && (
        <p className="text-[10px] text-red-400">{validationError}</p>
      )}
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
