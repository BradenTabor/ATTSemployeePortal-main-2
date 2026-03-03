import React, { useState, useEffect, useRef, useMemo } from "react";
import { logger } from "../lib/logger";
import { getDeviceCapabilities, onVisibilityChange } from "../lib/mobilePerf";

interface VideoBackgroundProps {
  videoSrc: string;
  children: React.ReactNode;
}

/**
 * VideoBackground - Mobile-optimized video background component
 * 
 * Mobile optimizations:
 * - Skips video on slow connections or save-data mode (shows gradient fallback)
 * - Uses preload="metadata" on mobile to reduce initial bandwidth
 * - Pauses video when tab is not visible (battery saving)
 * - Respects prefers-reduced-motion preference
 */
export const VideoBackground: React.FC<VideoBackgroundProps> = ({
  videoSrc,
  children,
}) => {
  const [loaded, setLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Get device capabilities (cached)
  const caps = useMemo(() => getDeviceCapabilities(), []);
  
  // Determine if we should show video or fallback to static gradient
  // Skip video only for: save-data / 2g, or reduced motion. Allow video on most devices including mobile.
  const shouldShowVideo = useMemo(() => {
    if (caps.isSlowConnection) {
      logger.debug("[VideoBackground] Skipping video: slow connection (save-data or 2g)");
      return false;
    }
    if (caps.prefersReducedMotion) {
      logger.debug("[VideoBackground] Skipping video: user prefers reduced motion");
      return false;
    }
    return true;
  }, [caps.isSlowConnection, caps.prefersReducedMotion]);

  // Video playback and visibility handling. Defer so ref is set after commit (avoids ref being null on first run).
  useEffect(() => {
    if (!shouldShowVideo) return;

    const id = setTimeout(() => {
      const video = videoRef.current;
      if (!video) return;

      const handleCanPlay = async () => {
        try {
          await video.play();
          setLoaded(true);
        } catch (err) {
          logger.warn("Autoplay may be blocked:", err);
          setLoaded(true);
        }
      };

      // If video is already ready (e.g. cached), play immediately so we don't miss canplaythrough
      if (video.readyState >= 3) {
        handleCanPlay();
      } else {
        video.addEventListener("canplaythrough", handleCanPlay);
      }

      // Fallback: show video after delay even if canplaythrough never fires (slow network / quirks)
      const fallbackId = setTimeout(() => setLoaded(true), 2000);

      // Pause/resume video based on document visibility (battery optimization)
      const unsubscribeVisibility = onVisibilityChange((isVisible) => {
        if (!video) return;
        if (isVisible) {
          video.play().catch(() => {});
        } else {
          video.pause();
          logger.debug("[VideoBackground] Video paused: tab hidden");
        }
      });

      const cleanup = () => {
        clearTimeout(fallbackId);
        video.removeEventListener("canplaythrough", handleCanPlay);
        unsubscribeVisibility();
      };

      cleanupRef.current = cleanup;
    }, 0);

    return () => {
      clearTimeout(id);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [shouldShowVideo]);

  // Determine preload strategy based on device
  // Mobile: use "metadata" to reduce initial bandwidth
  // Desktop: use "auto" for faster playback start
  const preloadStrategy = caps.isMobile ? "metadata" : "auto";

  return (
    <div className="relative w-full min-h-screen overflow-hidden">
      {/* Video element - only rendered if device supports it well */}
      {shouldShowVideo && (
        <video
          ref={videoRef}
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          preload={preloadStrategy}
          disablePictureInPicture
          disableRemotePlayback
          className={`absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-1000 ${
            loaded ? "opacity-100" : "opacity-0"
          } z-0`}
          onLoadedData={() => setLoaded(true)}
          onError={(e) => {
            const target = e.currentTarget;
            const err = target?.error;
            const msg = err?.message ?? "unknown";
            logger.error("Video load error:", msg);
            setLoaded(true);
            if (target?.networkState === 3 /* NETWORK_NO_SOURCE */) {
              logger.warn("[VideoBackground] If the video returns 401, ensure the Cloudinary asset is public or use a signed URL.");
            }
          }}
        />
      )}

      {/* Gradient overlay - lighter when video is shown so the video is visible */}
      <div 
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background: shouldShowVideo
            ? 'linear-gradient(135deg, rgba(196, 182, 130, 0.35) 38%, rgba(167, 154, 108, 0.25) 54%, rgba(21, 128, 61, 0.2) 75%)'
            : 'radial-gradient(ellipse at 30% 20%, rgba(22, 101, 52, 0.9) 0%, rgba(6, 78, 59, 0.95) 40%, rgba(2, 44, 34, 1) 100%)',
        }}
      />
      {/* Center vignette - obscures watermarks in the middle of the video */}
      {shouldShowVideo && (
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 70% at 50% 50%, rgba(2, 44, 34, 0.92) 0%, rgba(2, 44, 34, 0.4) 45%, transparent 70%)',
          }}
        />
      )}

      <div className="relative z-20 flex flex-col items-center justify-center min-h-screen text-white text-center px-4">
        {children}
      </div>
    </div>
  );
};
