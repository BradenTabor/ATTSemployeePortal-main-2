import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Loader2, RefreshCcw, ArrowLeft } from "lucide-react";
import { AuroraBackground } from "../components/AuroraBackground";
import logo from "../assets/ATTS_Logo-removebg-preview.png";

interface Announcement {
  id: string;
  title: string;
  message: string;
  author: string | null;
  date: string;
  created_at: string;
}

export default function Announcements() {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 📥 Fetch helper (spinner only when explicitly asked)
  const fetchAnnouncements = useCallback(
    async (showSpinner: boolean = true) => {
      if (showSpinner) setLoading(true);

      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching announcements:", error);
      } else {
        setAnnouncements((data || []) as Announcement[]);
      }

      if (showSpinner) setLoading(false);
    },
    []
  );

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      // Hit Make.com webhook to sync from Sheets → Supabase
      await fetch(
        "https://hook.us2.make.com/dlb3kmbn4615q14lcw6dhheif7602ph2",
        {
          method: "POST",
        }
      );
      await fetchAnnouncements(false);
    } catch (err) {
      console.error("Error refreshing announcements:", err);
    }
    setRefreshing(false);
  };

  // 🔁 Initial load + realtime subscription
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (cancelled) return;
      await fetchAnnouncements(true);
    };

    load();

    const channel = supabase
      .channel("announcements-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "announcements",
        },
        () => {
          console.log("Realtime announcement INSERT detected");
          if (!cancelled) fetchAnnouncements(false);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "announcements",
        },
        () => {
          console.log("Realtime announcement UPDATE detected");
          if (!cancelled) fetchAnnouncements(false);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "announcements",
        },
        () => {
          console.log("Realtime announcement DELETE detected");
          if (!cancelled) fetchAnnouncements(false);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [fetchAnnouncements]);

  return (
    <AuroraBackground className="min-h-screen flex flex-col items-center py-10 px-6">
      <div className="w-full max-w-6xl mb-6">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg transition-all hover:scale-[1.02]"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Dashboard
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between w-full max-w-6xl mb-10">
        <div className="flex items-center gap-3 mb-4 sm:mb-0">
          <img
            src={logo}
            alt="ATTS Logo"
            className="h-12 w-auto drop-shadow-lg"
          />
          <h1 className="text-3xl font-extrabold text-green-800">
            Announcements
          </h1>
        </div>

        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg transition-all hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <RefreshCcw
            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
          />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-green-700 animate-pulse">
          <Loader2 className="animate-spin w-6 h-6" />
          <span>Loading announcements...</span>
        </div>
      ) : announcements.length === 0 ? (
        <div className="mt-10 text-gray-600 text-center">
          <p className="text-lg font-medium">No announcements available</p>
          <p className="text-sm">
            New announcements will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="w-full max-w-4xl space-y-6">
          {announcements.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl bg-gradient-to-br from-green-50 via-white to-green-100 border border-green-100 shadow-md hover:shadow-xl p-6 transition-all duration-200 hover:-translate-y-1"
            >
              <div className="flex justify-between items-start mb-3">
                <h2 className="text-xl font-semibold text-green-800">
                  {a.title}
                </h2>
                <p className="text-sm text-gray-500 flex-shrink-0 ml-4">
                  {new Date(a.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div className="border-t border-green-100 pt-3 mt-3">
                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {a.message}
                </p>
              </div>

              {a.author && (
                <div className="border-t border-green-100 pt-3 mt-3">
                  <p className="text-sm text-gray-600 italic">— {a.author}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AuroraBackground>
  );
}
