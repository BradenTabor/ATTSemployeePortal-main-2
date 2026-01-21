/**
 * SignatureCanvas Component
 * 
 * A touch-friendly signature canvas for capturing digital signatures.
 * Supports both drawing and saved signature quick-apply.
 * 
 * Features:
 * - Touch and mouse drawing support
 * - Clear and undo functionality
 * - Save signature for reuse
 * - Use saved signature with one tap
 * - Export as base64 PNG
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pencil,
  Eraser,
  Save,
  Check,
  Trash2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUserSignature } from '../../hooks/user';

// =============================================================================
// TYPES
// =============================================================================

interface SignatureCanvasProps {
  /** Current signature value (base64 or empty string) */
  value: string;
  /** Callback when signature changes */
  onChange: (value: string) => void;
  /** Optional placeholder text */
  placeholder?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Optional className */
  className?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getCoordinates(
  e: React.MouseEvent | React.TouchEvent,
  canvas: HTMLCanvasElement
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  if ('touches' in e) {
    const touch = e.touches[0];
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    };
  }

  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SignatureCanvas({
  value,
  onChange,
  placeholder = 'Sign here',
  required,
  className,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [showSavedOption, setShowSavedOption] = useState(true);

  const {
    signature: savedSignature,
    hasSignature,
    saveCanvasSignature,
    isLoading: signatureLoading,
  } = useUserSignature();

  // Initialize canvas with existing value or clear
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size for retina displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Style setup
    ctx.strokeStyle = '#10b981'; // emerald-500
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // If there's an existing value, draw it
    if (value && value.startsWith('data:image')) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasDrawn(true);
      };
      img.src = value;
    } else {
      // Clear canvas
      ctx.fillStyle = 'transparent';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [value]);

  // Drawing handlers
  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    setShowSavedOption(false);

    const { x, y } = getCoordinates(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing) return;
      e.preventDefault();

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { x, y } = getCoordinates(e, canvas);
      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [isDrawing]
  );

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);

    // Export canvas to base64
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    onChange(dataUrl);
  }, [isDrawing, onChange]);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setShowSavedOption(true);
    onChange('');
  }, [onChange]);

  // Use saved signature
  const useSavedSignature = useCallback(() => {
    if (!savedSignature?.signature_data) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
      setHasDrawn(true);
      setShowSavedOption(false);
      onChange(savedSignature.signature_data);
    };
    img.src = savedSignature.signature_data;
  }, [savedSignature, onChange]);

  // Save current signature for future use
  const saveForReuse = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    await saveCanvasSignature(dataUrl);
  }, [saveCanvasSignature]);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label */}
      <div className="flex items-center justify-between">
        <label className="block text-[10px] font-medium text-white/50 uppercase tracking-wide">
          Signature {required && <span className="text-emerald-400">*</span>}
        </label>
        {hasDrawn && !signatureLoading && (
          <button
            type="button"
            onClick={saveForReuse}
            className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
          >
            <Save className="w-3 h-3" />
            Save for reuse
          </button>
        )}
      </div>

      {/* Saved Signature Quick-Apply */}
      <AnimatePresence>
        {hasSignature && showSavedOption && !hasDrawn && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={useSavedSignature}
            className="w-full p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all"
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-300">
                Use Saved Signature
              </span>
            </div>
            {savedSignature?.signature_data && (
              <img
                src={savedSignature.signature_data}
                alt="Your saved signature"
                className="h-12 mx-auto opacity-80"
              />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Canvas Container */}
      <div
        className={cn(
          "relative rounded-xl border-2 border-dashed overflow-hidden transition-all",
          isDrawing
            ? "border-emerald-500/60 bg-emerald-500/5"
            : hasDrawn
            ? "border-emerald-500/40 bg-black/40"
            : "border-white/20 bg-black/40"
        )}
      >
        {/* Placeholder */}
        {!hasDrawn && !isDrawing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 text-gray-500">
              <Pencil className="w-4 h-4" />
              <span className="text-sm">{placeholder}</span>
            </div>
          </div>
        )}

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          className="w-full h-24 touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {/* Clear Button (positioned inside canvas) */}
        {hasDrawn && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={clearCanvas}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 border border-white/20 text-gray-400 hover:text-white hover:bg-black/80 transition-colors"
            title="Clear signature"
          >
            <Eraser className="w-4 h-4" />
          </motion.button>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasDrawn && (
            <button
              type="button"
              onClick={clearCanvas}
              className="text-[10px] text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {/* Signature status */}
        <div className="flex items-center gap-1 text-[10px]">
          {hasDrawn ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <Check className="w-3 h-3" />
              Signed
            </span>
          ) : (
            <span className="text-gray-500">
              Draw your signature above
            </span>
          )}
        </div>
      </div>

      {/* Device Info (for audit trail) */}
      {hasDrawn && (
        <p className="text-[9px] text-gray-600 text-right">
          {new Date().toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}
    </div>
  );
}

export default SignatureCanvas;
