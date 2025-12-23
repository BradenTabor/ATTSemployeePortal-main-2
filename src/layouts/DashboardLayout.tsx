import { motion } from "framer-motion";
import { ReactNode } from "react";
import ReturnButton from "../components/ReturnButton";
import logo from "../assets/ATTS_Logo-removebg-preview.png";
import { AuroraBackground } from "../components/AuroraBackground";
import { BackgroundParticles } from "../components/ui/BackgroundParticles";

interface DashboardLayoutProps {
  title?: string;
  children: ReactNode;
}

export default function DashboardLayout({ title, children }: DashboardLayoutProps) {
  return (
    <AuroraBackground className="items-start justify-start">
      <motion.div
        className="relative min-h-screen flex flex-col text-white px-4 sm:px-8 py-6 sm:py-10 w-full"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ 
          background: 'radial-gradient(circle at 50% 50%, rgba(96, 79, 31, 1) 0%, rgba(142, 122, 67, 1) 44%, rgba(176, 154, 94, 1) 63%, rgba(212, 212, 212, 1) 95%)',
          boxShadow: 'inset 0px 4px 75px 25px rgba(0, 0, 0, 0.85)'
        }}
      >
        {/* Ultra-Premium Particles: Connections, Shooting Stars, Sparkles & Fireflies */}
        <BackgroundParticles
          count={90}
          color="rgba(247, 228, 189, 1)"
          accentColor="rgba(255, 220, 140, 1)"
          minSize={1}
          maxSize={4.5}
          enableConnections={true}
          enableShootingStars={true}
          enableMouseInteraction={true}
          enableSparkles={true}
          enableFireflies={true}
          layers={3}
        />

        {/* Header Area */}
        <header className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
          {/* Left Section: Logo + Title */}
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-center sm:text-left">
            <img
              src={logo}
              alt="ATTS Logo"
              fetchPriority="high"
              className="w-[180px] sm:w-52 md:w-60 object-contain drop-shadow-lg"
            />
            {title && (
              <motion.h1
                className="text-2xl sm:text-3xl font-bold tracking-wide text-transparent bg-clip-text break-normal"
                style={{
                  backgroundSize: "200% 200%",
                  backgroundImage: "linear-gradient(90deg, rgba(247, 228, 189, 1) 0%, rgba(138, 99, 30, 1) 20%, rgba(244, 201, 121, 1) 50%, rgba(138, 99, 30, 1) 75%, rgba(215, 154, 50, 1) 100%)",
                  WebkitBackgroundClip: "text",
                }}
                animate={{
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                  textShadow: [
                    "0 0 12px rgba(247,228,189,0.35)",
                    "0 0 24px rgba(244,201,121,0.55)",
                    "0 0 12px rgba(247,228,189,0.35)",
                  ],
                }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                {title}
              </motion.h1>
            )}
          </div>

          {/* Right Section: Return Button */}
          <div className="flex justify-center sm:justify-end w-full sm:w-auto">
            <ReturnButton />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex flex-col items-center justify-start w-full flex-1">
          {children}
        </main>
      </motion.div>
    </AuroraBackground>
  );
}
