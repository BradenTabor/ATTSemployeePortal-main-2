import { ReactNode, lazy, Suspense } from "react";
import ReturnButton from "../components/ReturnButton";
import logo from "../assets/ATTS_Logo-removebg-preview.png";
import { getDeviceCapabilities } from "../lib/mobilePerf";
import { CertificationResultOverlay } from "../components/certifications/CertificationResultOverlay";

// Lazy load BackgroundParticles for better initial load performance
const BackgroundParticles = lazy(() => import("../components/ui/BackgroundParticles"));

interface DashboardLayoutProps {
  title?: string;
  children: ReactNode;
  /** Hide the header section (logo + title + return button) */
  hideHeader?: boolean;
}

export default function DashboardLayout({ title, children, hideHeader = false }: DashboardLayoutProps) {
  // Get device capabilities for adaptive particle settings
  const capabilities = getDeviceCapabilities();
  const { isLowEnd, isMobile, prefersReducedMotion } = capabilities;

  // Completely disable particles on low-end devices or if user prefers reduced motion
  const shouldShowParticles = !isLowEnd && !prefersReducedMotion;
  
  // Adaptive particle count: 30 on mobile, 50 on desktop
  const particleCount = isMobile ? 30 : 50;
  
  // Disable expensive features on mobile
  const enableConnections = !isMobile;
  const enableShootingStars = !isMobile;
  
  // Sparkles are always disabled (highest CPU cost)
  const enableSparkles = false;

  return (
    <div
      className="relative h-screen flex flex-col text-white w-full overflow-hidden"
      style={{ 
        background: 'radial-gradient(ellipse at 50% 50%, rgba(255, 236, 204, 0.75) 0%, rgba(180, 160, 126, 1) 18%, rgba(113, 101, 80, 1) 62%, rgba(63, 56, 44, 1) 96%, rgba(1, 6, 4, 1) 100%)',
        boxShadow: 'inset 0px 4px 75px 25px rgba(0, 0, 0, 0.85)'
      }}
    >
      {/* Ultra-Premium Particles: Fixed background layer */}
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
      <div className={`flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-8 ${hideHeader ? 'pt-0' : 'pt-6 sm:pt-10'} pb-6 relative z-10`}>
        {/* Header Area - conditionally rendered */}
        {!hideHeader && (
          <header className="flex items-center gap-2 sm:gap-4 mb-6 w-full">
            {/* Logo - Smaller on mobile to leave room for title */}
            <img
              src={logo}
              alt="ATTS Logo"
              // @ts-expect-error fetchpriority is a valid HTML attribute but not in React types yet
              fetchpriority="high"
              className="w-[100px] sm:w-40 md:w-48 object-contain drop-shadow-lg flex-shrink-0"
            />
            {/* Title - No truncation, wraps if needed */}
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

        {/* Main Content */}
        <main className="flex flex-col items-center justify-start w-full flex-1 pb-8">
          {children}
        </main>
      </div>

      {/* Floating Return Navigation - Fixed position, stays visible */}
      <ReturnButton />

      {/* Certification Result Overlay - Shows when test is graded by admin */}
      <CertificationResultOverlay />
    </div>
  );
}
