import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell } from "lucide-react";
import { hasNewDataWithExpiry, setLastViewedWithTimestamp, STORAGE_KEYS } from "../lib/notifications";
import { logger } from "../lib/logger";

export default function AnnouncementAlert() {
  const [hasNew, setHasNew] = useState(false);
  const [latestDate, setLatestDate] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkForNewAnnouncements = async () => {
      try {
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/announcements`;
        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) return;

        const data = await response.json();

        if (data.announcements && data.announcements.length > 0) {
          const latest = data.announcements[0].date;

          setLatestDate(latest);

          if (latest) {
            const hasNewData = hasNewDataWithExpiry(
              latest,
              STORAGE_KEYS.LAST_VIEWED_ANNOUNCEMENT
            );
            setHasNew(hasNewData);
          }
        }
      } catch (error) {
        logger.error("Failed to check announcements:", error);
      }
    };

    checkForNewAnnouncements();

    const interval = setInterval(checkForNewAnnouncements, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleClick = () => {
    if (latestDate) {
      setLastViewedWithTimestamp(latestDate, STORAGE_KEYS.LAST_VIEWED_ANNOUNCEMENT);
    }
    setHasNew(false);
    navigate("/announcements");
  };

  if (!hasNew) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        onClick={handleClick}
        className="fixed bottom-20 right-5 sm:bottom-8 sm:right-8 w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform cursor-pointer z-[60]"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Bell className="w-5 h-5 animate-pulse" />

        {hasNew && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow">
            NEW
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
