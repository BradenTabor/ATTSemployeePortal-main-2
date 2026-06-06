/**
 * AvatarUpload Component
 * 
 * Full avatar upload experience with:
 * - Click to open file picker
 * - Mobile camera capture support
 * - Image cropping modal
 * - Client-side compression
 * - Upload progress indicator
 * - Remove photo functionality
 * - Offline detection
 * 
 * Premium green-themed styling matching ATTS design system.
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Trash2, Upload, CheckCircle2, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../lib/logger';
import { formToast } from '../../lib/formToast';
import { track } from '../../lib/telemetry';
import ImageCropper from './ImageCropper';

// ============================================================================
// TYPES
// ============================================================================

export interface AvatarUploadProps {
  /** Current avatar URL (from AuthContext) */
  currentAvatarUrl?: string | null;
  /** User's full name for initials fallback */
  name?: string | null;
  /** Called after successful upload */
  onUploadComplete?: () => void;
}

type UploadState = 'idle' | 'selecting' | 'cropping' | 'uploading' | 'success' | 'error';

// ============================================================================
// CONSTANTS
// ============================================================================

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB raw
const MAX_COMPRESSED_SIZE = 500 * 1024; // 500KB compressed
const TARGET_SIZE = 400; // 400x400px output
const MIN_DIMENSION = 100; // Minimum width or height in pixels
const MAX_DIMENSION = 10000; // Maximum width or height in pixels

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get initials from name
 */
function getInitials(name: string | null | undefined): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Read EXIF orientation from image file (1–8). Returns 1 if none/unused, -1 if not JPEG, -2 if parse error.
 * Uses minimal buffer read; see https://stackoverflow.com/a/32490603
 */
function getOrientation(file: File): Promise<number> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const view = new DataView((e.target?.result as ArrayBuffer) ?? new ArrayBuffer(0));
      if (view.getUint16(0, false) !== 0xffd8) {
        return resolve(-2);
      }
      const length = view.byteLength;
      let offset = 2;
      while (offset < length) {
        const marker = view.getUint16(offset, false);
        offset += 2;
        if (marker === 0xffe1) {
          if (view.getUint32((offset += 2), false) !== 0x45786966) {
            return resolve(-1);
          }
          const little = view.getUint16((offset += 6), false) === 0x4949;
          offset += view.getUint32(offset + 4, little);
          const tags = view.getUint16(offset, little);
          offset += 2;
          for (let i = 0; i < tags; i++) {
            if (view.getUint16(offset + i * 12, little) === 0x0112) {
              return resolve(view.getUint16(offset + i * 12 + 8, little));
            }
          }
          return resolve(-1);
        }
        if ((marker & 0xff00) !== 0xff00) break;
        offset += view.getUint16(offset, false);
      }
      resolve(-1);
    };
    reader.onerror = () => resolve(-1);
    reader.readAsArrayBuffer(file.slice(0, 64 * 1024));
  });
}

/**
 * Apply EXIF orientation via canvas transform and return corrected image as data URL.
 * Orientation 1 = no change; 2–8 = rotate/mirror. Ignores values less than 1.
 */
function resetOrientation(dataUrl: string, orientation: number): Promise<string> {
  if (orientation < 2) {
    return Promise.resolve(dataUrl);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const width = img.width;
      const height = img.height;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      if (orientation > 4 && orientation < 9) {
        canvas.width = height;
        canvas.height = width;
      } else {
        canvas.width = width;
        canvas.height = height;
      }
      switch (orientation) {
        case 2:
          ctx.transform(-1, 0, 0, 1, width, 0);
          break;
        case 3:
          ctx.transform(-1, 0, 0, -1, width, height);
          break;
        case 4:
          ctx.transform(1, 0, 0, -1, 0, height);
          break;
        case 5:
          ctx.transform(0, 1, 1, 0, 0, 0);
          break;
        case 6:
          ctx.transform(0, 1, -1, 0, height, 0);
          break;
        case 7:
          ctx.transform(0, -1, -1, 0, height, width);
          break;
        case 8:
          ctx.transform(0, -1, 1, 0, 0, width);
          break;
        default:
          break;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => reject(new Error('Failed to load image for orientation fix'));
    img.src = dataUrl;
  });
}

/**
 * Compress image blob to target size
 */
async function compressImage(blob: Blob, maxSize: number = MAX_COMPRESSED_SIZE): Promise<Blob> {
  // If already small enough, return as-is
  if (blob.size <= maxSize) {
    return blob;
  }
  
  // Create image from blob
  const img = new Image();
  const url = URL.createObjectURL(blob);
  
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
  
  URL.revokeObjectURL(url);
  
  // Compress using canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error('Canvas context not available');
  
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;
  
  ctx.drawImage(img, 0, 0, TARGET_SIZE, TARGET_SIZE);
  
  // Try different quality levels
  let quality = 0.85;
  let compressed: Blob | null = null;
  
  while (quality > 0.3) {
    compressed = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });
    
    if (compressed && compressed.size <= maxSize) {
      return compressed;
    }
    
    quality -= 0.1;
  }
  
  // Return best effort
  return compressed || blob;
}

/**
 * Delete old avatar from storage
 */
async function deleteOldAvatar(avatarPath: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from('avatars')
      .remove([avatarPath]);
    
    if (error) {
      logger.warn('[AvatarUpload] Failed to delete old avatar:', error);
    }
  } catch (err) {
    logger.warn('[AvatarUpload] Error deleting old avatar:', err);
  }
}

/**
 * Extract avatar path from full URL (public or signed).
 * Strips query string (?token=... or ?v=...) so path is suitable for storage delete.
 */
function getAvatarPathFromUrl(url: string): string | null {
  try {
    const match = url.match(/avatars\/([^?]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AvatarUpload({
  currentAvatarUrl,
  name,
  onUploadComplete,
}: AvatarUploadProps) {
  const { user, refreshAvatar } = useAuth();
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [avatarUrlVersion, setAvatarUrlVersion] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastRetriedUrlRef = useRef<string | null>(null);
  
  const initials = useMemo(() => getInitials(name), [name]);
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const hasAvatar = currentAvatarUrl && !imageError;

  // Reset load error and bump version when avatar URL changes so we retry displaying the new image
  useEffect(() => {
    setImageError(false);
    setAvatarUrlVersion((v) => v + 1);
    lastRetriedUrlRef.current = null;
  }, [currentAvatarUrl]);

  const avatarImgSrc = currentAvatarUrl
    ? `${currentAvatarUrl}${currentAvatarUrl.includes('?') ? '&' : '?'}v=${avatarUrlVersion}`
    : '';
  
  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Reset input for re-selection
    e.target.value = '';
    
    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      formToast.error('Invalid File', 'Please select a JPEG, PNG, or WebP image.');
      return;
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      formToast.error('File Too Large', 'Please select an image under 10MB.');
      return;
    }
    
    setState('selecting');
    
    void (async () => {
      try {
        const orientation = await getOrientation(file);
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
        
        // Validate image dimensions before cropping
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            // Get actual dimensions (accounting for orientation)
            let width = img.width;
            let height = img.height;
            
            // Adjust for EXIF orientation (rotated images)
            if (orientation >= 5 && orientation <= 8) {
              [width, height] = [height, width];
            }
            
            // Validate dimensions
            if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
              reject(new Error(`Image is too small. Minimum size is ${MIN_DIMENSION}x${MIN_DIMENSION} pixels.`));
              return;
            }
            
            if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
              reject(new Error(`Image is too large. Maximum size is ${MAX_DIMENSION}x${MAX_DIMENSION} pixels.`));
              return;
            }
            
            resolve();
          };
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = dataUrl;
        });
        
        const imageToCrop = await resetOrientation(dataUrl, orientation);
        setSelectedImage(imageToCrop);
        setState('cropping');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to read the selected file.';
        formToast.error('Image Error', errorMessage);
        setState('idle');
      }
    })();
  }, []);
  
  // Handle crop complete
  const handleCropComplete = useCallback(async (croppedBlob: Blob) => {
    if (!user?.id) return;
    
    setState('uploading');
    setProgress(10);
    
    try {
      // Compress image
      setProgress(20);
      const compressedBlob = await compressImage(croppedBlob);
      setProgress(40);
      
      // Generate unique filename
      const timestamp = Date.now();
      const filename = `${user.id}/${timestamp}.jpeg`;
      
      // Upload to storage
      setProgress(50);
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filename, compressedBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/jpeg',
        });
      
      if (uploadError) {
        throw uploadError;
      }
      
      setProgress(70);
      
      // Delete old avatar if exists
      if (currentAvatarUrl) {
        const oldPath = getAvatarPathFromUrl(currentAvatarUrl);
        if (oldPath) {
          await deleteOldAvatar(oldPath);
        }
      }
      
      setProgress(80);
      
      // Update database via RPC (allows employees; direct UPDATE is admin-only)
      const { error: dbError } = await supabase.rpc('update_my_avatar_url', {
        p_path: filename,
      });
      
      if (dbError) {
        throw dbError;
      }
      
      setProgress(90);
      
      // Refresh context
      await refreshAvatar();
      
      setProgress(100);
      setState('success');
      
      // Track telemetry
      track('avatar_uploaded', {
        file_size_kb: Math.round(compressedBlob.size / 1024),
        is_replacement: !!currentAvatarUrl,
      });
      
      formToast.success('Photo Updated', 'Your profile photo has been updated!');
      onUploadComplete?.();
      
      // Reset state after delay
      setTimeout(() => {
        setState('idle');
        setSelectedImage(null);
        setProgress(0);
      }, 1500);
      
    } catch (error) {
      logger.error('[AvatarUpload] Upload failed:', error);
      setState('error');
      
      track('avatar_upload_failed', {
        error_type: error instanceof Error ? error.message : 'unknown',
      });
      
      formToast.error('Upload Failed', 'Failed to upload photo. Please try again.');
      
      setTimeout(() => {
        setState('idle');
        setProgress(0);
      }, 2000);
    }
  }, [user?.id, currentAvatarUrl, refreshAvatar, onUploadComplete]);
  
  // Handle cancel crop
  const handleCancelCrop = useCallback(() => {
    setState('idle');
    setSelectedImage(null);
  }, []);
  
  // Handle remove avatar
  const handleRemoveAvatar = useCallback(async () => {
    if (!user?.id || !currentAvatarUrl) return;
    
    setState('uploading');
    
    try {
      // Get path from URL
      const avatarPath = getAvatarPathFromUrl(currentAvatarUrl);
      
      // Delete from storage
      if (avatarPath) {
        await deleteOldAvatar(avatarPath);
      }
      
      // Update database via RPC (allows employees; direct UPDATE is admin-only)
      const { error: dbError } = await supabase.rpc('update_my_avatar_url', {
        p_path: null,
      });
      
      if (dbError) {
        throw dbError;
      }
      
      // Refresh context
      await refreshAvatar();
      
      // Track telemetry
      track('avatar_removed', {});
      
      formToast.success('Photo Removed', 'Your profile photo has been removed.');
      setState('idle');
      
    } catch (error) {
      logger.error('[AvatarUpload] Remove failed:', error);
      formToast.error('Remove Failed', 'Failed to remove photo. Please try again.');
      setState('idle');
    }
  }, [user?.id, currentAvatarUrl, refreshAvatar]);
  
  // Handle avatar click
  const handleAvatarClick = useCallback(() => {
    if (!isOnline) {
      formToast.error('Offline', "You're offline. Please connect to upload your photo.");
      return;
    }
    
    if (state !== 'idle') return;
    
    fileInputRef.current?.click();
  }, [isOnline, state]);
  
  // Handle image load error: retry once via refreshAvatar (new signed URL) then clear error
  const handleImageError = useCallback(() => {
    const url = currentAvatarUrl ?? '';
    if (url && lastRetriedUrlRef.current !== url) {
      lastRetriedUrlRef.current = url;
      formToast.info('Retrying…', 'Couldn’t load photo. Fetching again…');
      void (async () => {
        await refreshAvatar();
        await new Promise((r) => setTimeout(r, 1500));
        setImageError(false);
        setAvatarUrlVersion((v) => v + 1);
      })();
      return;
    }
    setImageError(true);
  }, [currentAvatarUrl, refreshAvatar]);
  
  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleFileSelect}
        className="sr-only"
        aria-label="Upload profile photo"
      />
      
      {/* Avatar Display & Upload Area */}
      <div className="relative">
        {/* Main Avatar */}
        <motion.div
          className="relative group cursor-pointer hover:scale-[1.02]"
          whileTap={{ scale: 0.98 }}
          onClick={handleAvatarClick}
        >
          {/* Outer glow ring */}
          <motion.div
            className="absolute -inset-2 rounded-full pointer-events-none"
            style={{
              background: 'conic-gradient(from 0deg, transparent 0%, rgba(16, 185, 129, 0.4) 25%, transparent 50%, rgba(52, 211, 153, 0.3) 75%, transparent 100%)',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          />
          
          {/* Pulsing glow backdrop */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, transparent 70%)',
              filter: 'blur(15px)',
            }}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.4, 0.7, 0.4],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          
          {/* Avatar container */}
          <div 
            className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-emerald-400/50"
            style={{
              background: hasAvatar ? 'transparent' : 'linear-gradient(145deg, rgba(4, 40, 28, 0.95) 0%, rgba(2, 25, 18, 0.98) 100%)',
              boxShadow: '0 0 40px rgba(16, 185, 129, 0.3), inset 0 0 20px rgba(16, 185, 129, 0.1)',
            }}
          >
            {/* Image or Initials */}
            {hasAvatar ? (
              <img
                key={currentAvatarUrl ?? 'avatar'}
                src={avatarImgSrc}
                alt={name || 'Profile photo'}
                onError={handleImageError}
                className="w-full h-full object-cover"
              />
            ) : (
              <>
                {/* Inner gradient overlay */}
                <div 
                  className="absolute inset-0 opacity-50 pointer-events-none"
                  style={{
                    background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.2) 0%, transparent 50%, rgba(5, 150, 105, 0.1) 100%)',
                  }}
                />
                
                {/* Initials */}
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-4xl font-bold bg-gradient-to-br from-emerald-200 via-emerald-300 to-emerald-400 bg-clip-text text-transparent">
                    {initials}
                  </span>
                </div>
              </>
            )}
            
            {/* Upload overlay (on hover or during upload) */}
            <AnimatePresence>
              {(state === 'idle' || state === 'selecting' || state === 'uploading' || state === 'success' || state === 'error') && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: state === 'idle' ? 0 : 1 }}
                  whileHover={{ opacity: state === 'idle' ? 1 : undefined }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    'absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm transition-opacity',
                    hasAvatar ? 'bg-black/30' : 'bg-black/60'
                  )}
                >
                  {state === 'selecting' && (
                    <>
                      <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                      <span className="mt-1 text-xs text-white/70">Preparing...</span>
                    </>
                  )}
                  {state === 'uploading' && (
                    <>
                      {/* Progress ring */}
                      <svg className="w-12 h-12 -rotate-90">
                        <circle
                          cx="24"
                          cy="24"
                          r="20"
                          stroke="rgba(16, 185, 129, 0.2)"
                          strokeWidth="4"
                          fill="none"
                        />
                        <circle
                          cx="24"
                          cy="24"
                          r="20"
                          stroke="rgb(16, 185, 129)"
                          strokeWidth="4"
                          fill="none"
                          strokeLinecap="round"
                          strokeDasharray={`${progress * 1.26} 126`}
                          className="transition-all duration-300"
                        />
                      </svg>
                      <span className="mt-1 text-xs text-white/80">{Math.round(progress)}%</span>
                    </>
                  )}
                  
                  {state === 'success' && (
                    <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                  )}
                  
                  {state === 'error' && (
                    <AlertCircle className="w-10 h-10 text-red-400" />
                  )}
                  
                  {state === 'idle' && (
                    <>
                      <Camera className="w-8 h-8 text-white/90" />
                      <span className="mt-1 text-xs text-white/70">
                        {hasAvatar ? 'Change' : 'Add Photo'}
                      </span>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Sparkle decorations */}
          <motion.div
            className="absolute -top-1 -right-1 pointer-events-none"
            animate={{ 
              rotate: [0, 180, 360],
              scale: [1, 1.2, 1],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Sparkles className="w-5 h-5 text-emerald-400" />
          </motion.div>
          
          <motion.div
            className="absolute -bottom-0.5 -left-0.5 pointer-events-none"
            animate={{ 
              rotate: [360, 180, 0],
              scale: [0.8, 1.1, 0.8],
            }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          >
            <Sparkles className="w-3 h-3 text-emerald-300/60" />
          </motion.div>
        </motion.div>
        
        {/* Action buttons */}
        <div className="flex items-center justify-center gap-2 mt-4">
          {hasAvatar && (
            <motion.button
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={handleRemoveAvatar}
              disabled={state !== 'idle'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-300/70 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </motion.button>
          )}
          
          <button
            onClick={handleAvatarClick}
            disabled={state !== 'idle' || !isOnline}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-300/70 hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-3.5 h-3.5" />
            {hasAvatar ? 'Change Photo' : 'Upload Photo'}
          </button>
        </div>
        
        {/* Offline indicator */}
        {!isOnline && (
          <p className="mt-2 text-center text-xs text-amber-400/60">
            You're offline. Connect to upload photos.
          </p>
        )}
      </div>
      
      {/* Image Cropper Modal */}
      {state === 'cropping' && selectedImage && (
        <ImageCropper
          imageSrc={selectedImage}
          onCropComplete={handleCropComplete}
          onCancel={handleCancelCrop}
        />
      )}
    </>
  );
}
