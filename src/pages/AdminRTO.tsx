import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { Loader2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AuroraBackground } from "../components/AuroraBackground";
import logo from "../assets/ATTS_Logo-removebg-preview.png";
import type { User } from "@supabase/supabase-js";

interface RTORequest {
  id: string;
  full_name: string;
  email: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  total_duration: string | null;
  reason: string;
  notes: string | null;
  status: string;
  submitted_at: string;
}

export default function AdminRTO() {
  const [requests, setRequests] = useState<RTORequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const navigate = useNavigate();

  // 🔒 Load auth user once and keep it in state
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      setAuthLoading(true);
      const { data, error } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (error) {
        console.error("Error loading auth user in AdminRTO:", error);
      }

      setCurrentUser(data?.user ?? null);
      setAuthLoading(false);
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setCurrentUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 📥 Fetch RTO requests with optional spinner for realtime refreshes
  const fetchRTORequests = useCallback(
    async (showSpinner: boolean = true) => {
      if (showSpinner) setLoading(true);

      const { data, error } = await supabase
        .from("rto_requests")
        .select("*")
        .order("submitted_at", { ascending: false });

      if (error) {
        console.error("Error fetching RTO requests:", error);
        setRequests([]);
      } else {
        setRequests((data || []) as RTORequest[]);
      }

      if (showSpinner) setLoading(false);
    },
    []
  );

  // 🔁 Load + Realtime subscribe AFTER auth is ready
  useEffect(() => {
    if (authLoading) return;

    // If no user at all, don't even try to load
    if (!currentUser) {
      setRequests([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      if (cancelled) return;
      await fetchRTORequests(true);
    };

    load();

    const channel = supabase
      .channel("rto-requests-admin")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rto_requests",
        },
        (payload) => {
          console.log("Realtime RTO INSERT:", payload);
          if (!cancelled) fetchRTORequests(false);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rto_requests",
        },
        (payload) => {
          console.log("Realtime RTO UPDATE:", payload);
          if (!cancelled) fetchRTORequests(false);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "rto_requests",
        },
        (payload) => {
          console.log("Realtime RTO DELETE:", payload);
          if (!cancelled) fetchRTORequests(false);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [authLoading, currentUser, fetchRTORequests]);

  const formatDateTime = (isoString: string | null): string => {
    if (!isoString) return "N/A";
    try {
      return new Date(isoString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "N/A";
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string | null) => {
    const statusText = status || "Pending";
    const baseClasses =
      "inline-block px-3 py-1 rounded-full text-xs font-semibold";

    if (statusText === "Approved") {
      return (
        <span className={`${baseClasses} bg-green-100 text-green-700`}>
          {statusText}
        </span>
      );
    } else if (statusText === "Denied") {
      return (
        <span className={`${baseClasses} bg-red-100 text-red-700`}>
          {statusText}
        </span>
      );
    } else {
      return (
        <span className={`${baseClasses} bg-yellow-100 text-yellow-700`}>
          {statusText}
        </span>
      );
    }
  };

  return (
    <AuroraBackground className="min-h-screen px-4 sm:px-6 py-10">
      <div className="w-full max-w-7xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate("/admin")}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg transition-all hover:scale-[1.02]"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Admin Dashboard
          </button>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <img
            src={logo}
            alt="ATTS Logo"
            className="h-12 w-auto drop-shadow-lg"
          />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-green-800">
            Time Off Requests
          </h1>
        </div>

        {authLoading ? (
          <div className="flex items-center justify-center gap-3 text-green-700 py-20">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-lg">Checking permissions...</span>
          </div>
        ) : !currentUser ? (
          <div className="bg-white rounded-2xl shadow-md p-10 text-center">
            <p className="text-lg font-medium text-gray-700">
              You must be signed in to view time-off requests.
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-3 text-green-700 py-20">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-lg">Loading requests...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-10 text-center">
            <p className="text-lg font-medium text-gray-600">
              No requests found
            </p>
            <p className="text-sm text-gray-500 mt-2">
              New time-off requests will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-green-900 text-white">
                  <tr>
                    <th className="px-4 py-4 text-left text-sm font-semibold">
                      Employee Name
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-semibold">
                      Email
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-semibold">
                      Start Date
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-semibold">
                      End Date
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-semibold">
                      Start Time
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-semibold">
                      End Time
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-semibold">
                      Duration
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-semibold">
                      Reason
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-semibold">
                      Notes
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-semibold">
                      Status
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-semibold">
                      Submitted
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((rto, index) => (
                    <tr
                      key={rto.id}
                      className={`border-b border-gray-200 last:border-b-0 transition-colors hover:bg-green-50 ${
                        index % 2 === 0 ? "bg-white" : "bg-[#f7fdf9]"
                      }`}
                    >
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                        {rto.full_name || "Unknown"}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {rto.email}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                        {formatDate(rto.start_date)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                        {formatDate(rto.end_date)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                        {rto.start_time || "—"}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                        {rto.end_time || "—"}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                        {rto.total_duration || "—"}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 max-w-xs">
                        <div className="line-clamp-2" title={rto.reason}>
                          {rto.reason}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 max-w-xs">
                        <div className="line-clamp-2" title={rto.notes || ""}>
                          {rto.notes || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {getStatusBadge(rto.status)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                        {formatDateTime(rto.submitted_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AuroraBackground>
  );
}
