import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { ArrowRight, Megaphone, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/ATTS_Logo-removebg-preview.png";

interface Announcement {
  id: string;
  title: string;
  message: string;
  author: string | null;
  created_at: string;
}

export default function DashboardAnnouncementCard() {
  const [latestAnnouncement, setLatestAnnouncement] =
    useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const { data, error } = await supabase
          .from("announcements")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (! error && data) {
          setLatestAnnouncement(data as Announcement);
        }
      } catch (err) {
        console.error("Error fetching latest announcement:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLatest();

    const channel = supabase
      .channel("announcements-dashboard")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "announcements" },
        (payload) => {
          if (payload.new) {
            setLatestAnnouncement(payload.new as Announcement);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading || !latestAnnouncement) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();

    if (date.toDateString() === today.toDateString()) {
      return `Today, ${date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      whileHover={{ y: -6 }}
      onClick={() => navigate("/announcements")}
      className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600/20 via-emerald-500/5 to-transparent border-2 border-emerald-500/30 backdrop-blur-md shadow-xl hover:shadow-2xl hover:shadow-emerald-500/20 hover:border-emerald-500/50 transition-all cursor-pointer"
    >
      {/* Animated background */}
      <motion.div
        animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute inset-0 bg-gradient-to-br from-emerald-400/10 via-transparent to-emerald-600/10 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ backgroundSize: "200% 200%" }}
      />

      {/* Shine effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

      {/* Subtle ATTS logo watermark */}
      <div className="absolute top-4 right-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
        <img src={logo} alt="" loading="lazy" className="w-12 h-12 object-contain" />
      </div>

      <div className="relative p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="p-2. 5 bg-emerald-500/20 rounded-xl border border-emerald-500/40 flex-shrink-0"
          >
            <Megaphone className="w-5 h-5 text-emerald-300" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-1. 5 px-2. 5 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full text-[10px] font-bold text-amber-300"
          >
            <Sparkles className="w-3 h-3" />
            NEW
          </motion.div>
        </div>

        {/* Title */}
        <motion.h3
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-xl sm:text-2xl font-black text-white mb-2 line-clamp-2 group-hover:text-emerald-100 transition-colors"
        >
          {latestAnnouncement. title}
        </motion.h3>

        {/* Preview */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-sm text-gray-200 line-clamp-2 mb-4 group-hover:text-white transition-colors"
        >
          {latestAnnouncement.message}
        </motion. p>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex items-center justify-between pt-4 border-t border-emerald-500/20"
        >
          <div className="flex items-center gap-2">
            {latestAnnouncement.author && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                {latestAnnouncement.author. charAt(0)}
              </div>
            )}
            <p className="text-xs text-gray-400">
              {formatDate(latestAnnouncement.created_at)}
            </p>
          </div>
          <motion.div
            whileHover={{ x: 4 }}
            className="flex items-center gap-1. 5 text-emerald-300 font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity"
          >
            View <ArrowRight className="w-4 h-4" />
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}