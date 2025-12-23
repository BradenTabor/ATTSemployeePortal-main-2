import { ReactNode, lazy, Suspense } from "react";
import ReturnButton from "../components/ReturnButton";
import logo from "../assets/ATTS_Logo-removebg-preview.png";
import { getDeviceCapabilities } from "../lib/mobilePerf";

// Lazy load BackgroundParticles for better initial load performance
const BackgroundParticles = lazy(() => import("../components/ui/BackgroundParticles"));

interface DashboardLayoutProps {
  title?: string;
  children: ReactNode;
}

export default function DashboardLayout({ title, children }: DashboardLayoutProps) {
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
      className="relative min-h-screen flex flex-col text-white px-4 sm:px-8 pt-6 sm:pt-10 pb-2 w-full items-start justify-start"
      style={{ 
        background: 'radial-gradient(circle at 50% 50%, rgba(96, 79, 31, 1) 0%, rgba(142, 122, 67, 1) 44%, rgba(176, 154, 94, 1) 63%, rgba(212, 212, 212, 1) 95%)',
        boxShadow: 'inset 0px 4px 75px 25px rgba(0, 0, 0, 0.85)'
      }}
    >
      {/* Ultra-Premium Particles: Conditionally rendered with adaptive settings */}
      {shouldShowParticles && (
        <Suspense fallback={null}>
          <BackgroundParticles
            count={particleCount}
            color="rgba(247, 228, 189, 1)"
            accentColor="rgba(255, 220, 140, 1)"
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

      {/* Header Area */}
      <header className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 w-full relative z-10">
        {/* Left Section: Logo + Title */}
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-center sm:text-left">
          <img
            src={logo}
            alt="ATTS Logo"
            fetchPriority="high"
            className="w-[180px] sm:w-52 md:w-60 object-contain drop-shadow-lg"
          />
          {title && (
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-wide text-transparent bg-clip-text break-normal gradient-animated"
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
        </div>

        {/* Right Section: Return Button */}
        <div className="flex justify-center sm:justify-end w-full sm:w-auto">
          <ReturnButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-col items-center justify-start w-full flex-1 relative z-10">
        {children}
      </main>
    </div>
  );
}
