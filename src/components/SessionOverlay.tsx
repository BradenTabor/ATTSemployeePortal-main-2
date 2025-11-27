import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import logo from "../assets/ATTS_Logo-removebg-preview.png";

interface SessionOverlayProps {
  isLoading: boolean;
  playSound?: boolean;
}

export default function SessionOverlay({ isLoading, playSound = false }: SessionOverlayProps) {
  // Optional ambient sound cue on mount
  useEffect(() => {
    if (isLoading && playSound) {
      const audio = new Audio("/assets/login-chime.mp3");
      audio.volume = 0.2;
      audio.play().catch(() => {
        // Silently fail if audio cannot play (user hasn't interacted yet, autoplay policy, etc.)
      });
    }
  }, [isLoading, playSound]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className="fixed inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md text-white z-[100]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          <motion.div
            className="flex flex-col items-center space-y-6 relative"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          >
            {/* Glowing Pulse Behind Logo */}
            <div className="relative flex items-center justify-center">
              <motion.div
                className="absolute w-48 h-48 bg-green-500/20 rounded-full blur-3xl"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.4, 0.7, 0.4],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 3,
                  ease: "easeInOut",
                }}
              />

              {/* ATTS Logo */}
              <motion.img
                src={logo}
                alt="ATTS Logo"
                className="w-32 h-32 object-contain relative z-10"
                animate={{
                  opacity: [0.7, 1, 0.7],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>

            {/* Loading Text */}
            <div className="text-center space-y-2">
              <p className="text-xl font-semibold tracking-wide text-white">
                Restoring your session...
              </p>
              <p className="text-sm text-white/70 font-light">
                All Terrain Tree Service
              </p>
            </div>

            {/* Animated Spinner */}
            <motion.div
              className="w-12 h-12 border-4 border-white/20 border-t-green-500 rounded-full"
              animate={{ rotate: 360 }}
              transition={{
                repeat: Infinity,
                duration: 1.2,
                ease: "linear",
              }}
            />

            {/* Loading Dots (kept for extra visual interest) */}
            <div className="flex space-x-2">
              {[0, 1, 2].map((index) => (
                <motion.div
                  key={index}
                  className="w-2 h-2 bg-green-600 rounded-full"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: index * 0.2,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
