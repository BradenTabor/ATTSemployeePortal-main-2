import { motion } from "framer-motion";
import { ReactNode } from "react";
import ReturnButton from "../components/ReturnButton";
import logo from "../assets/ATTS_Logo-removebg-preview.png";
import { AuroraBackground } from "../components/AuroraBackground";

interface DashboardLayoutProps {
  title?: string;
  children: ReactNode;
}

export default function DashboardLayout({ title, children }: DashboardLayoutProps) {
  return (
    <AuroraBackground className="items-start justify-start">
      <motion.div
        className="min-h-screen flex flex-col text-white px-4 sm:px-8 py-6 sm:py-10 w-full"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* Header Area */}
        <header className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
          {/* Left Section: Logo + Title */}
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-center sm:text-left">
            <img
              src={logo}
              alt="ATTS Logo"
              fetchPriority="high"
              className="w-20 sm:w-24 object-contain drop-shadow-md"
            />
            {title && (
              <motion.h1
                className="text-2xl sm:text-3xl font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] drop-shadow-[0_0_25px_rgba(244,201,121,0.35)] break-normal"
                style={{ backgroundSize: "200% 200%" }}
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
