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
  
  // Get device capabilities (cached)
  const caps = useMemo(() => getDeviceCapabilities(), []);
  
  // Determine if we should show video or fallback to static gradient
  // Skip video on: slow connections, save-data mode, reduced motion preference, or low-end devices
  const shouldShowVideo = useMemo(() => {
    if (caps.isSlowConnection) {
      logger.debug("[VideoBackground] Skipping video: slow connection detected");
      return false;
    }
    if (caps.prefersReducedMotion) {
      logger.debug("[VideoBackground] Skipping video: user prefers reduced motion");
      return false;
    }
    if (caps.isLowEnd && caps.isMobile) {
      logger.debug("[VideoBackground] Skipping video: low-end mobile device");
      return false;
    }
    return true;
  }, [caps.isSlowConnection, caps.prefersReducedMotion, caps.isLowEnd, caps.isMobile]);

  // Video playback and visibility handling
  useEffect(() => {
    if (!shouldShowVideo) return;
    
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

    video.addEventListener("canplaythrough", handleCanPlay);
    
    // Pause/resume video based on document visibility (battery optimization)
    const unsubscribeVisibility = onVisibilityChange((isVisible) => {
      if (!video) return;
      
      if (isVisible) {
        video.play().catch(() => {
          // Ignore play errors (e.g., autoplay policy)
        });
      } else {
        video.pause();
        logger.debug("[VideoBackground] Video paused: tab hidden");
      }
    });

    return () => {
      video.removeEventListener("canplaythrough", handleCanPlay);
      unsubscribeVisibility();
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
          className={`absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-1000 ${
            loaded ? "opacity-100" : "opacity-0"
          } z-0`}
          onLoadedData={() => setLoaded(true)}
          onError={(e) => logger.error("Video load error:", e)}
        />
      )}

      {/* Gradient overlay - always visible, acts as fallback on slow connections */}
      <div 
        className="absolute inset-0 z-10"
        style={{
          background: shouldShowVideo
            ? 'linear-gradient(to bottom right, rgba(20, 83, 45, 0.6), rgba(22, 101, 52, 0.5), rgba(21, 128, 61, 0.4))'
            : 'radial-gradient(ellipse at 30% 20%, rgba(22, 101, 52, 0.9) 0%, rgba(6, 78, 59, 0.95) 40%, rgba(2, 44, 34, 1) 100%)',
        }}
      />

      <div className="relative z-20 flex flex-col items-center justify-center min-h-screen text-white text-center px-4">
        {children}
      </div>
    </div>
  );
};
