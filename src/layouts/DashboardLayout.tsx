import { ReactNode, lazy, Suspense, useState, useEffect, useRef, useMemo } from "react";
import ReturnButton from "../components/ReturnButton";
import logo from "../assets/ATTS_Logo-removebg-preview.png";
import { getDeviceCapabilities, onVisibilityChange } from "../lib/mobilePerf";
import { CertificationResultOverlay } from "../components/certifications/CertificationResultOverlay";
import { logger } from "../lib/logger";

const BackgroundParticles = lazy(() => import("../components/ui/BackgroundParticles"));

const DASHBOARD_VIDEO_PRIMARY = "/videos/evergreen-bg.mp4";
const DASHBOARD_VIDEO_FALLBACK = "/videos/4k.mp4";

interface DashboardLayoutProps {
  title?: string;
  children: ReactNode;
  hideHeader?: boolean;
}

export default function DashboardLayout({ title, children, hideHeader = false }: DashboardLayoutProps) {
  const capabilities = getDeviceCapabilities();
  const { isLowEnd, isMobile, prefersReducedMotion } = capabilities;

  const shouldShowParticles = !isLowEnd && !prefersReducedMotion;
  const particleCount = isMobile ? 30 : 50;
  const enableConnections = !isMobile;
  const enableShootingStars = !isMobile;
  const enableSparkles = false;

  // --- Video background state (fallback to 4k.mp4 when evergreen-bg.mp4 is missing) ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoSrc, setVideoSrc] = useState(DASHBOARD_VIDEO_PRIMARY);

  const shouldShowVideo = useMemo(() => {
    if (capabilities.isSlowConnection) return false;
    if (prefersReducedMotion) return false;
    return true;
  }, [capabilities.isSlowConnection, prefersReducedMotion]);

  useEffect(() => {
    if (!shouldShowVideo) return;
    const id = setTimeout(() => {
      const video = videoRef.current;
      if (!video) return;

      const handleCanPlay = async () => {
        try {
          await video.play();
          setVideoLoaded(true);
        } catch {
          logger.warn("[DashboardLayout] Video autoplay blocked");
          setVideoLoaded(true);
        }
      };

      if (video.readyState >= 3) {
        handleCanPlay();
      } else {
        video.addEventListener("canplaythrough", handleCanPlay);
      }

      const fallbackId = setTimeout(() => setVideoLoaded(true), 2500);

      const unsubVisibility = onVisibilityChange((visible) => {
        if (!video) return;
        if (visible) video.play().catch(() => {});
        else video.pause();
      });

      cleanupRef.current = () => {
        clearTimeout(fallbackId);
        video.removeEventListener("canplaythrough", handleCanPlay);
        unsubVisibility();
      };
    }, 0);

    return () => {
      clearTimeout(id);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [shouldShowVideo]);

  const preloadStrategy = isMobile ? "metadata" as const : "auto" as const;

  const handleVideoError = () => {
    if (videoSrc === DASHBOARD_VIDEO_PRIMARY) {
      logger.warn("[DashboardLayout] evergreen-bg.mp4 failed, using fallback 4k.mp4");
      setVideoLoaded(false);
      setVideoSrc(DASHBOARD_VIDEO_FALLBACK);
    } else {
      logger.error("[DashboardLayout] Video load error (fallback also failed)");
      setVideoLoaded(true);
    }
  };

  return (
    <div
      className="relative h-screen flex flex-col text-white w-full overflow-hidden"
      style={{
        background: '#0a0a0a',
        boxShadow: 'inset 0px 4px 75px 25px rgba(0, 0, 0, 0.85)',
      }}
    >
      {/* Video background layer */}
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
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[1500ms] ${
            videoLoaded ? "opacity-100" : "opacity-0"
          } z-0 blur-[5px] saturate-[0.55]`}
          onLoadedData={() => setVideoLoaded(true)}
          onError={handleVideoError}
        />
      )}

      {/* Subtle dark overlay so text stays readable over the video */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      {/* Prominent white fade — top-left corner, over video, under content */}
      <div
        className="absolute top-0 left-0 z-[2] pointer-events-none"
        style={{
          width: '65%',
          height: '45%',
          background: 'linear-gradient(137.9deg, rgba(255, 255, 255, 0.6) 0%, rgba(0, 0, 0, 0) 35%)',
        }}
      />

      {/* Particles above video overlays */}
      {shouldShowParticles && (
        <Suspense fallback={null}>
          <BackgroundParticles
            count={particleCount}
            color="rgba(52, 211, 153, 0.8)"
            accentColor="rgba(16, 185, 129, 1)"
            minSize={1}
            maxSize={4.5}
            enableConnections={enableConnections}
            enableShootingStars={enableShootingStars}
            enableMouseInteraction={!isMobile}
            enableSparkles={enableSparkles}
            enableFireflies={true}
            layers={3}
          />
        </Suspense>
      )}

      {/* Scrollable content wrapper */}
      <div
        data-scroll-container
        className={`flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-8 scroll-container scroll-smooth-touch gpu-layer ${hideHeader ? 'pt-0' : 'pt-6 sm:pt-10'} pb-6 relative z-10`}
      >
        {!hideHeader && (
          <header className="flex items-center gap-2 sm:gap-4 mb-6 w-full">
            <img
              src={logo}
              alt="ATTS Logo"
              // @ts-expect-error fetchpriority is a valid HTML attribute but not in React types yet
              fetchpriority="high"
              className="w-[100px] sm:w-40 md:w-48 object-contain drop-shadow-lg flex-shrink-0 relative z-[15]"
            />
            {title && (
              <h1
                className="text-lg sm:text-2xl md:text-3xl font-bold tracking-wide text-transparent bg-clip-text gradient-animated leading-tight"
                style={{
                  backgroundSize: "200% 200%",
                  backgroundImage: "linear-gradient(90deg, rgba(247, 228, 189, 1) 0%, rgba(138, 99, 30, 1) 20%, rgba(244, 201, 121, 1) 50%, rgba(138, 99, 30, 1) 75%, rgba(215, 154, 50, 1) 100%)",
                  WebkitBackgroundClip: "text",
                  textShadow: "0 0 12px rgba(247,228,189,0.35)",
                }}
              >
                {title}
              </h1>
            )}
          </header>
        )}

        <main className="flex flex-col items-center justify-start w-full pb-8">
          {children}
        </main>
      </div>

      <ReturnButton />
      <CertificationResultOverlay />
    </div>
  );
}
