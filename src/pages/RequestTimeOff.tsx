import DashboardLayout from "../layouts/DashboardLayout";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { CONFIG } from "../lib/config";
import { logger } from "../lib/logger";
import { DateField, TimeField } from "../components/forms/GlassyPickers";
import { CalendarDays, Clock } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function RequestTimeOff() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    startDate: "",
    endDate: "",
    reason: "",
    notes: "",
  });

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [totalDuration, setTotalDuration] = useState("");

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const hasFullRange =
    Boolean(formData.startDate) &&
    Boolean(formData.endDate) &&
    Boolean(startTime) &&
    Boolean(endTime);

    // 🔹 Load current user from Supabase and populate email
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          logger.error("Error fetching auth user:", userError);
          return;
        }

        if (!user) {
          logger.warn("No authenticated user found");
          return;
        }

        // Try to also fetch app_users row (optional)
        const { data: profile, error: profileError } = await supabase
          .from("app_users")
          .select("email, full_name")
          .eq("user_id", user.id)
          .maybeSingle(); // won't throw if no row

        if (profileError) {
          logger.error("Error fetching user profile:", profileError);
        }

        // Log to verify what you're getting back
        logger.debug("Auth user:", user);
        logger.debug("Profile row:", profile);

        setFormData((prev) => ({
          ...prev,
          // ✅ Priority: profile.email → auth user.email → existing form value
          email: profile?.email ?? user.email ?? prev.email,
          // ✅ Only auto-fill name if empty so user can override
          fullName: prev.fullName || profile?.full_name || "",
        }));
      } catch (err) {
        logger.error("Unexpected error fetching user profile:", err);
      }
    };

    loadUserProfile();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    // Need all four fields to calculate a proper total
    if (!startTime || !endTime || !formData.startDate || !formData.endDate) {
      setTotalDuration("");
      return;
    }

    // Parse dates
    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      setTotalDuration("");
      return;
    }

    // Normalize to midnight so we can safely count whole days
    const startDay = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate()
    );
    const endDay = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate()
    );

    const oneDayMs = 24 * 60 * 60 * 1000;
    let diffDays =
      Math.floor((endDay.getTime() - startDay.getTime()) / oneDayMs) + 1; // inclusive of both start & end dates

    if (diffDays < 1) diffDays = 1;

    // Daily time span
    const startTimeDate = new Date(`1970-01-01T${startTime}:00`);
    const endTimeDate = new Date(`1970-01-01T${endTime}:00`);

    let dailyMs = endTimeDate.getTime() - startTimeDate.getTime();
    // Handle overnight spans (e.g. 22:00 → 06:00 next day)
    if (dailyMs < 0) dailyMs += oneDayMs;

    const totalMs = dailyMs * diffDays;

    const totalHours = Math.floor(totalMs / (1000 * 60 * 60));
    const minutes = Math.floor(
      (totalMs % (1000 * 60 * 60)) / (1000 * 60)
    );

    setTotalDuration(
      `${diffDays} day${diffDays > 1 ? "s" : ""} · ${totalHours}h ${minutes}m`
    );
  }, [startTime, endTime, formData.startDate, formData.endDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const payload = {
        ...formData,
        startTime,
        endTime,
        totalDuration,
      };

      if (!CONFIG.make.rtoWebhook) {
        throw new Error("RTO webhook URL is not configured");
      }
      
      const res = await fetch(
        CONFIG.make.rtoWebhook,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) throw new Error("Webhook failed");

      const { error } = await supabase.from("rto_requests").insert([
        {
          user_id: user?.id, // Required for RLS policy
          full_name: formData.fullName,
          email: formData.email,
          start_date: formData.startDate,
          end_date: formData.endDate,
          start_time: startTime,
          end_time: endTime,
          total_duration: totalDuration,
          reason: formData.reason,
          notes: formData.notes,
        },
      ]);

      if (error) throw error;

      setStatus("success");
      setFormData({
        fullName: "",
        email: "",
        startDate: "",
        endDate: "",
        reason: "",
        notes: "",
      });
      setStartTime("");
      setEndTime("");
      setTotalDuration("");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      logger.error("Submission error:", err);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <DashboardLayout title="Request Time Off">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-3xl backdrop-blur-xl border rounded-[45px] p-8 text-white"
        style={{
          background: 'linear-gradient(124.2deg, rgba(0, 0, 0, 0.7) 0%, rgba(16, 66, 42, 1) 100%)',
          borderColor: 'rgba(18, 222, 93, 0.3)',
          boxShadow: '0px 4px 25px 8px rgba(0, 0, 0, 0.85), 0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        <h2 
          className="text-2xl font-semibold mb-6 text-center"
          style={{ color: 'rgba(9, 225, 121, 1)' }}
        >
          Submit a Time-Off Request
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">
              Full Name
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              className="w-full rounded-[25px] p-3 bg-neutral-900 border border-green-700/40 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-600 transition-all"
              placeholder="Enter your full name"
            />
          </div>

          <div>
  <label className="block text-sm font-medium text-white/80 mb-1">
    Email
  </label>
  <input
    type="email"
    name="email"
    value={formData.email}
    // keep onChange if you want admins to be able to edit;
    // if you want it fully locked, you can remove onChange.
    onChange={handleChange}
    required
    readOnly // 🔒 locked so users don't change it
    className="w-full rounded-[25px] p-3 bg-neutral-900 border border-green-700/40 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-600 transition-all"
    placeholder="you@atts.com"
  />
</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateField
              label="Start Date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              helperText="First day away from work"
              required
            />
            <DateField
              label="End Date"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              helperText="Expected return on the next day"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TimeField
              label={
                <>
                  Start Time<span className="text-red-400 ml-1">*</span>
                </>
              }
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              helperText="When coverage should begin"
              required
            />
            <TimeField
              label={
                <>
                  End Time<span className="text-red-400 ml-1">*</span>
                </>
              }
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              helperText="Final hour of coverage"
              required
            />
          </div>

          {hasFullRange && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-emerald-600/30 border border-emerald-400/40">
                  <CalendarDays className="w-5 h-5 text-emerald-200" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">
                    Starts
                  </p>
                  <p className="text-base font-semibold text-white">
                    {formatFriendlyDate(formData.startDate)} ·{" "}
                    {formatFriendlyTime(startTime)}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-emerald-600/20 border border-emerald-400/30">
                  <Clock className="w-5 h-5 text-emerald-200" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">
                    Returns
                  </p>
                  <p className="text-base font-semibold text-white">
                    {formatFriendlyDate(formData.endDate)} ·{" "}
                    {formatFriendlyTime(endTime)}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {totalDuration && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-700/20 border border-green-700/40 rounded-lg p-3 text-center"
            >
              <p className="text-green-400 font-semibold">
                Total Time Off: {totalDuration}
              </p>
            </motion.div>
          )}

          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">
              Reason for Request
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              rows={3}
              required
              className="w-full rounded-[25px] p-3 bg-neutral-900 border border-green-700/40 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-600 resize-none transition-all"
              placeholder="Explain why you need time off"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">
              Additional Notes (optional)
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              className="w-full rounded-[25px] p-3 bg-neutral-900 border border-green-700/40 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-600 resize-none transition-all"
              placeholder="Any extra details (optional)"
            />
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full py-3 rounded-[45px] font-semibold text-white shadow-md transition-all focus:ring-2 focus:ring-green-600 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
            style={{
              background: 'radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 1) 0%, rgba(16, 66, 42, 1) 100%)',
            }}
          >
            {status === "loading"
              ? "Submitting..."
              : status === "success"
              ? "Submitted ✓"
              : "Submit Request"}
          </button>

          {status === "success" && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-green-400 text-center mt-2 font-medium"
            >
              Your time-off request has been submitted successfully!
            </motion.p>
          )}

          {status === "error" && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-400 text-center mt-2 font-medium"
            >
              Something went wrong. Please try again.
            </motion.p>
          )}
        </form>
      </motion.div>
    </DashboardLayout>
  );
}

function formatFriendlyDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatFriendlyTime(value: string) {
  if (!value) return "—";
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
