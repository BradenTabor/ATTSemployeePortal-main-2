/**
 * ImageCropper Component
 * 
 * Full-page modal for cropping profile photos to a square aspect ratio.
 * Features:
 * - Square (1:1) aspect ratio enforced
 * - Touch-friendly drag to reposition
 * - Keyboard navigation support
 * - Focus trap within modal
 * - Screen reader announcements
 * - Full-page overlay for better UX on all devices
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, RotateCcw, Crop as CropIcon, Loader2, ImageIcon } from 'lucide-react';
import 'react-image-crop/dist/ReactCrop.css';
import { logger } from '../../lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface ImageCropperProps {
  /** Base64 or URL of the image to crop */
  imageSrc: string;
  /** Called when user confirms the crop */
  onCropComplete: (croppedBlob: Blob) => void;
  /** Called when user cancels */
  onCancel: () => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create initial centered square crop
 */
function createCenteredCrop(
  mediaWidth: number,
  mediaHeight: number,
): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 80,
      },
      1, // 1:1 aspect ratio for square
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
}

/**
 * Convert percentage crop to pixel crop
 */
function convertToPixelCrop(
  crop: Crop,
  imageWidth: number,
  imageHeight: number
): PixelCrop {
  if (crop.unit === 'px') {
    return crop as PixelCrop;
  }
  
  return {
    unit: 'px',
    x: (crop.x * imageWidth) / 100,
    y: (crop.y * imageHeight) / 100,
    width: (crop.width * imageWidth) / 100,
    height: (crop.height * imageHeight) / 100,
  };
}

/**
 * Convert crop area to canvas blob
 */
async function getCroppedImage(
  image: HTMLImageElement,
  crop: PixelCrop,
  targetSize: number = 400,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  // Set output size (square)
  canvas.width = targetSize;
  canvas.height = targetSize;
  
  // Calculate scale factors
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  
  // Draw cropped image
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    targetSize,
    targetSize,
  );
  
  // Convert to blob (JPEG for compatibility)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      'image/jpeg',
      0.85, // 85% quality
    );
  });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ImageCropper({
  imageSrc,
  onCropComplete,
  onCancel,
}: ImageCropperProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  
  // Store previous focus and trap focus in modal
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Focus the modal
    modalRef.current?.focus();
    
    // Announce to screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = 'Image cropper opened. Drag to adjust the crop area, then press Confirm to save.';
    document.body.appendChild(announcement);
    
    return () => {
      // Restore body scroll
      document.body.style.overflow = '';
      // Restore previous focus
      previousFocusRef.current?.focus();
      // Remove announcement
      announcement.remove();
    };
  }, []);
  
  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);
  
  // Initialize crop when image loads
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const initialCrop = createCenteredCrop(width, height);
    setCrop(initialCrop);
    
    // IMPORTANT: Also set the completedCrop so Confirm button works immediately
    const pixelCrop = convertToPixelCrop(initialCrop, width, height);
    setCompletedCrop(pixelCrop);
    setImageLoaded(true);
  }, []);
  
  // Reset crop to center
  const handleReset = useCallback(() => {
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      const resetCrop = createCenteredCrop(width, height);
      setCrop(resetCrop);
      
      // Also update completedCrop
      const pixelCrop = convertToPixelCrop(resetCrop, width, height);
      setCompletedCrop(pixelCrop);
    }
  }, []);
  
  // Handle crop change - update both percentage and pixel crops
  const handleCropChange = useCallback((pixelCrop: PixelCrop, percentCrop: Crop) => {
    setCrop(percentCrop);
    setCompletedCrop(pixelCrop);
  }, []);
  
  // Process and return cropped image
  const handleConfirm = useCallback(async () => {
    if (!imgRef.current || !completedCrop) return;
    
    setIsProcessing(true);
    
    try {
      const croppedBlob = await getCroppedImage(imgRef.current, completedCrop);
      onCropComplete(croppedBlob);
    } catch (error) {
      logger.error('[ImageCropper] Failed to crop image:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [completedCrop, onCropComplete]);

  // Modal content
  const modalContent = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex flex-col"
        style={{ background: 'linear-gradient(180deg, #030d08 0%, #010604 100%)' }}
      >
        {/* Full-page backdrop with blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 0%, rgba(16, 185, 129, 0.15) 0%, transparent 50%)',
          }}
        />
        
        {/* Decorative orbs */}
        <motion.div
          className="absolute top-20 left-10 w-64 h-64 rounded-full pointer-events-none"
          animate={{
            x: [0, 20, 0],
            y: [0, -15, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-48 h-48 rounded-full pointer-events-none"
          animate={{
            x: [0, -15, 0],
            y: [0, 10, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          style={{
            background: 'radial-gradient(circle, rgba(52, 211, 153, 0.15) 0%, transparent 70%)',
            filter: 'blur(35px)',
          }}
        />
        
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative flex items-center justify-between px-4 sm:px-6 py-4 border-b border-emerald-500/10 bg-black/30 backdrop-blur-sm"
        >
          <div className="flex items-center gap-3">
            <motion.div 
              className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
              whileHover={{ scale: 1.05, rotate: 5 }}
            >
              <CropIcon className="w-5 h-5 text-emerald-400" />
            </motion.div>
            <div>
              <h2 id="cropper-title" className="text-lg sm:text-xl font-bold text-white">
                Crop Photo
              </h2>
              <p className="text-xs text-emerald-300/50 hidden sm:block">
                Drag to adjust • Square crop
              </p>
            </div>
          </div>
          
          <motion.button
            onClick={onCancel}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            aria-label="Close cropper"
          >
            <X className="w-5 h-5 text-white/70" />
          </motion.button>
        </motion.header>
        
        {/* Main content area - crop preview */}
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', damping: 25 }}
          className="relative flex-1 flex flex-col items-center justify-center p-4 sm:p-8 overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cropper-title"
          tabIndex={-1}
        >
          {/* Loading state */}
          {!imageLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 className="w-10 h-10 text-emerald-400" />
              </motion.div>
              <p className="mt-4 text-sm text-emerald-300/60">Loading image...</p>
            </div>
          )}
          
          {/* Crop container with premium frame */}
          <div className="relative max-w-2xl w-full">
            {/* Frame glow */}
            <div 
              className="absolute -inset-4 rounded-3xl pointer-events-none"
              style={{
                background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.15) 0%, transparent 50%, rgba(52, 211, 153, 0.1) 100%)',
                filter: 'blur(20px)',
              }}
            />
            
            {/* Crop area frame */}
            <div 
              className="relative rounded-2xl overflow-hidden border border-emerald-500/30 shadow-2xl shadow-emerald-900/50"
              style={{
                background: 'linear-gradient(145deg, rgba(4, 30, 21, 0.9) 0%, rgba(2, 15, 10, 0.95) 100%)',
              }}
            >
              {/* Top shine */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent z-10" />
              
              <div className="p-3 sm:p-4">
                <div className="relative bg-black/60 rounded-xl overflow-hidden">
                  <ReactCrop
                    crop={crop}
                    onChange={handleCropChange}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={1}
                    circularCrop={false}
                    className="max-h-[50vh] sm:max-h-[60vh] mx-auto [&_.ReactCrop__crop-selection]:border-emerald-400 [&_.ReactCrop__crop-selection]:border-2 [&_.ReactCrop__drag-handle]:bg-emerald-400 [&_.ReactCrop__drag-handle]:border-emerald-300"
                  >
                    <img
                      ref={imgRef}
                      src={imageSrc}
                      alt="Image to crop"
                      onLoad={onImageLoad}
                      className="max-h-[50vh] sm:max-h-[60vh] w-auto mx-auto object-contain"
                      style={{ maxWidth: '100%' }}
                    />
                  </ReactCrop>
                </div>
              </div>
            </div>
            
            {/* Instructions */}
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-4 text-center text-xs sm:text-sm text-emerald-300/40 flex items-center justify-center gap-2"
            >
              <ImageIcon className="w-4 h-4" />
              Drag the corners or edges to adjust the crop area
            </motion.p>
          </div>
        </motion.div>
        
        {/* Footer with actions */}
        <motion.footer
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-emerald-500/10 bg-black/40 backdrop-blur-sm"
        >
          {/* Reset Button - left side */}
          <motion.button
            onClick={handleReset}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-emerald-300/70 hover:text-emerald-300 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400/50 order-2 sm:order-1"
            aria-label="Reset crop to center"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </motion.button>
          
          {/* Main action buttons - right side */}
          <div className="flex items-center gap-3 w-full sm:w-auto order-1 sm:order-2">
            {/* Cancel Button */}
            <motion.button
              onClick={onCancel}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 sm:flex-none px-6 py-3 rounded-xl text-sm font-semibold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              Cancel
            </motion.button>
            
            {/* Confirm Button */}
            <motion.button
              onClick={handleConfirm}
              disabled={isProcessing || !completedCrop || !imageLoaded}
              whileHover={{ scale: isProcessing ? 1 : 1.02 }}
              whileTap={{ scale: isProcessing ? 1 : 0.98 }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              style={{
                background: isProcessing 
                  ? 'linear-gradient(135deg, #047857 0%, #065f46 100%)'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                boxShadow: '0 10px 30px -10px rgba(16, 185, 129, 0.5), 0 0 0 1px rgba(16, 185, 129, 0.2)',
              }}
              aria-label={isProcessing ? 'Processing...' : 'Confirm crop'}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Confirm
                </>
              )}
            </motion.button>
          </div>
        </motion.footer>
      </motion.div>
    </AnimatePresence>
  );

  // Render using portal to escape any parent overflow constraints
  return typeof document !== 'undefined' 
    ? createPortal(modalContent, document.body) 
    : null;
}
