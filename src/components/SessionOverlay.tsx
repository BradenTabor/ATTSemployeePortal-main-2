import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LoadingScreen from "@/components/LoadingScreen";
import { EASE_CANOPY_IN } from "@/motion/presets";

interface SessionOverlayProps {
  isLoading: boolean;
  /** Play a soft chime when the overlay mounts (respects autoplay policy). */
  playSound?: boolean;
}

/**
 * SessionOverlay — shown while an existing session is being restored.
 * Reuses the CANOPY splash so cold-load and session-restore feel identical,
 * and dissolves out once auth resolves.
 */
export default function SessionOverlay({ isLoading, playSound = false }: SessionOverlayProps) {
  useEffect(() => {
    if (!isLoading || !playSound) return;
    const audio = new Audio("/assets/login-chime.mp3");
    audio.volume = 0.2;
    audio.play().catch(() => {
      /* autoplay blocked before first interaction — silent by design */
    });
  }, [isLoading, playSound]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          key="session-overlay"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45, ease: EASE_CANOPY_IN } }}
        >
          <LoadingScreen message="Restoring your session" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
