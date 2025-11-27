import { useEffect, useState, useCallback, memo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { AuroraBackground } from "../components/AuroraBackground";
import { AnnouncementCard } from "../components/AnnouncementCard";
import GreetingHeader from "../components/GreetingHeader";
import NavCards from "../components/NavCards";
import { useAuth } from "../contexts/AuthContext";
import logo from "../assets/ATTS_Logo-removebg-preview.png";

interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  raw_data?: any;
}

const formatDate = (dateStr: string): string => {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

const isNew = (dateStr: string): boolean => {
  try {
    return new Date(dateStr).getTime() > Date.now() - 1000 * 60 * 60 * 48;
  } catch {
    return false;
  }
};

function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut, setSession } = useAuth();
  const [latestAnnouncement, setLatestAnnouncement] = useState<Announcement | null>(null);

  const handleSignOut = useCallback(async () => {
    try {
      console.log("🚪 Initiating sign out from dashboard");

      // Clear session immediately for instant UI update
      setSession(null);

      // Call Supabase signOut to clear tokens
      await signOut();

      console.log("✅ Sign out successful, redirecting to home");

      // Navigate to home page
      navigate("/", { replace: true });
    } catch (error) {
      console.error("❌ Sign out failed:", error);
    }
  }, [navigate, setSession, signOut]);

  useEffect(() => {
    const loadLatestAnnouncement = async () => {
      try {
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/announcements`;
        const response = await fetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) return;

        const data = await response.json();
        const sorted = (data.announcements || []).sort(
          (a: Announcement, b: Announcement) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        if (sorted.length > 0) {
          setLatestAnnouncement(sorted[0]);
        }
      } catch (error) {
        console.error("Failed to load announcements:", error);
      }
    };

    loadLatestAnnouncement();
  }, []);

  return (
    <AuroraBackground className="items-start justify-start">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="w-full"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 text-white">
          <div className="flex justify-end mb-4">
            <motion.button
              onClick={handleSignOut}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-700/80 text-white rounded-lg transition-colors backdrop-blur-sm border border-red-500/40"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Sign Out</span>
            </motion.button>
          </div>

          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex flex-col items-center text-center space-y-4 mb-10"
          >
            <img
              src={logo}
              alt="ATTS Logo"
              className="w-40 h-40 sm:w-48 sm:h-48 object-contain opacity-95"
            />
            <h1 className="text-3xl sm:text-4xl font-bold text-green-400">
              ATTS Dashboard
            </h1>
            <p className="text-gray-300 text-sm sm:text-base">
              Access your tools, announcements, and company info.
            </p>
            {user?.email && (
              <p className="text-green-400 text-sm">
                Logged in as: {user.email}
              </p>
            )}
            <GreetingHeader />
          </motion.div>

          {latestAnnouncement && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mb-10"
            >
              <h2 className="text-xl font-semibold mb-4 text-green-400 text-center">
                Latest Announcement
              </h2>
              <div className="max-w-2xl mx-auto">
                <AnnouncementCard
                  title={latestAnnouncement.title}
                  message={latestAnnouncement.content}
                  category={
                    latestAnnouncement.raw_data?.category ||
                    latestAnnouncement.raw_data?.Category ||
                    latestAnnouncement.raw_data?.Catagory ||
                    "General"
                  }
                  date={formatDate(latestAnnouncement.date)}
                  isNew={isNew(latestAnnouncement.date)}
                />
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <NavCards />
          </motion.div>

          {/* Forms History quick access */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-6 flex justify-center"
          >
            <button
              onClick={() => navigate("/forms-history")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-green-500/60 bg-black/50 hover:bg-black/70 text-sm text-green-200 shadow-lg shadow-green-500/20 transition"
            >
              <span>View My Forms History</span>
            </button>
          </motion.div>
        </div>
      </motion.div>
    </AuroraBackground>
  );
}

export default memo(Dashboard);
