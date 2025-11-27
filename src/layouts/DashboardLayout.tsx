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
              className="w-20 sm:w-24 object-contain drop-shadow-md"
            />
            {title && (
              <h1 className="text-2xl sm:text-3xl font-bold tracking-wide text-green-400">
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
        <main className="flex flex-col items-center justify-start w-full flex-1">
          {children}
        </main>
      </motion.div>
    </AuroraBackground>
  );
}
