import DashboardLayout from "../../layouts/DashboardLayout";
import { motion } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { CONFIG } from "../../lib/config";
import { logger } from "../../lib/logger";
import { formToast } from "../../lib/formToast";
import { DateField, TimeField } from "../../components/forms/GlassyPickers";
import { CalendarDays, Clock } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { FormSuccessCelebration } from "../../components/forms/FormSuccessCelebration";
import {
  trackFormStarted,
  trackFormSubmitted,
  trackFormSubmitError,
  createFormTimer,
} from "../../lib/telemetry";

export default function RequestTimeOff() {
  const { user, fullName: userFullName } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
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
  
  // Success celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const hasFullRange =
    Boolean(formData.startDate) &&
    Boolean(formData.endDate) &&
    Boolean(startTime) &&
    Boolean(endTime);

  // Telemetry: track form completion time
  const formTimer = useRef(createFormTimer());
  
  // Track form_started on mount
  useEffect(() => {
    trackFormStarted({ form_type: 'rto' });
    formTimer.current.reset();
  }, []);

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

  const submitForm = useCallback(async () => {
    setStatus("loading");
    formToast.submitting("Submitting your time-off request...");

    try {
      // 1. Insert to Supabase FIRST and get the record ID
      const { data: insertedRecord, error } = await supabase
        .from("rto_requests")
        .insert([
          {
            user_id: user?.id, // Required for RLS policy
            full_name: formData.fullName,
            email: formData.email,
            phone_number: formData.phoneNumber,
            start_date: formData.startDate,
            end_date: formData.endDate,
            start_time: startTime,
            end_time: endTime,
            total_duration: totalDuration,
            reason: formData.reason,
            notes: formData.notes,
          },
        ])
        .select('id')
        .single();

      if (error) throw error;

      // 2. Send to webhook WITH the record ID
      if (!CONFIG.make.rtoWebhook) {
        throw new Error("RTO webhook URL is not configured");
      }

      const payload = {
        ...formData,
        rtoRequestId: insertedRecord.id, // The Supabase record ID
        phoneNumber: formData.phoneNumber,
        startTime,
        endTime,
        totalDuration,
      };
      
      const res = await fetch(
        CONFIG.make.rtoWebhook,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        logger.warn("Webhook failed but record was saved:", insertedRecord.id);
      }

      // Telemetry: track successful submission with duration
      trackFormSubmitted({
        form_type: 'rto',
        duration_seconds: formTimer.current.getDuration(),
      });

      // Dismiss loading toast before showing celebration
      formToast.dismiss();

      setStatus("success");
      
      // Reset form
      setFormData({
        fullName: "",
        email: "",
        phoneNumber: "",
        startDate: "",
        endDate: "",
        reason: "",
        notes: "",
      });
      setStartTime("");
      setEndTime("");
      setTotalDuration("");
      
      // Show success celebration
      setShowCelebration(true);
    } catch (err) {
      logger.error("Submission error:", err);
      setStatus("error");
      const errorMessage = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      formToast.error(
        "Submission Failed",
        errorMessage,
        { onRetry: () => submitForm() }
      );
      
      // Telemetry: track server/network error
      trackFormSubmitError({
        form_type: 'rto',
        error_code: err instanceof Error && err.message.includes('network') ? 'NETWORK_ERROR' : 'SERVER_ERROR',
      });
      
      setTimeout(() => setStatus("idle"), 3000);
    }
  }, [formData, startTime, endTime, totalDuration, user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitForm();
  };
  
  // Handle celebration continue
  const handleCelebrationContinue = useCallback(() => {
    setShowCelebration(false);
    setStatus("idle");
    navigate("/dashboard");
  }, [navigate]);

  return (
    <DashboardLayout title="Request Time Off">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-2xl backdrop-blur-xl border rounded-3xl sm:rounded-[35px] p-5 sm:p-6 text-white"
        style={{
          background: 'linear-gradient(124.2deg, rgba(0, 0, 0, 0.7) 0%, rgba(16, 66, 42, 1) 100%)',
          borderColor: 'rgba(18, 222, 93, 0.3)',
          boxShadow: '0px 4px 25px 8px rgba(0, 0, 0, 0.85), 0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        <h2 
          className="text-lg sm:text-xl font-semibold mb-4 text-center"
          style={{ color: 'rgba(9, 225, 121, 1)' }}
        >
          Submit a Time-Off Request
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          {/* Name, Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                required
                className="w-full rounded-xl sm:rounded-2xl px-3 py-2.5 text-sm bg-neutral-900 border border-green-700/40 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-600 transition-all"
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                readOnly
                className="w-full rounded-xl sm:rounded-2xl px-3 py-2.5 text-sm bg-neutral-900 border border-green-700/40 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-600 transition-all"
                placeholder="you@atts.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                required
                className="w-full rounded-xl sm:rounded-2xl px-3 py-2.5 text-sm bg-neutral-900 border border-green-700/40 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-600 transition-all"
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          {/* Date & Time - all in one grid on larger screens */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <DateField
              label="Start Date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              helperText="First day off"
              required
            />
            <DateField
              label="End Date"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              helperText="Last day off"
              required
            />
            <TimeField
              label={
                <>
                  Start Time<span className="text-red-400 ml-0.5">*</span>
                </>
              }
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              helperText="Coverage begins"
              required
            />
            <TimeField
              label={
                <>
                  End Time<span className="text-red-400 ml-0.5">*</span>
                </>
              }
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              helperText="Coverage ends"
              required
            />
          </div>

          {hasFullRange && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 gap-2 sm:gap-3"
            >
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
                <div className="p-2 rounded-xl bg-emerald-600/30 border border-emerald-400/40">
                  <CalendarDays className="w-4 h-4 text-emerald-200" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/70">
                    Starts
                  </p>
                  <p className="text-xs sm:text-sm font-semibold text-white truncate">
                    {formatFriendlyDate(formData.startDate)} · {formatFriendlyTime(startTime)}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
                <div className="p-2 rounded-xl bg-emerald-600/20 border border-emerald-400/30">
                  <Clock className="w-4 h-4 text-emerald-200" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/70">
                    Returns
                  </p>
                  <p className="text-xs sm:text-sm font-semibold text-white truncate">
                    {formatFriendlyDate(formData.endDate)} · {formatFriendlyTime(endTime)}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {totalDuration && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-700/20 border border-green-700/40 rounded-lg px-3 py-2 text-center"
            >
              <p className="text-green-400 font-semibold text-sm">
                Total: {totalDuration}
              </p>
            </motion.div>
          )}

          {/* Reason & Notes side by side on larger screens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                Reason for Request
              </label>
              <textarea
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                rows={2}
                required
                className="w-full rounded-xl sm:rounded-2xl px-3 py-2.5 text-sm bg-neutral-900 border border-green-700/40 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-600 resize-none transition-all"
                placeholder="Why you need time off"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                Notes <span className="text-white/50">(optional)</span>
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                className="w-full rounded-xl sm:rounded-2xl px-3 py-2.5 text-sm bg-neutral-900 border border-green-700/40 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-600 resize-none transition-all"
                placeholder="Extra details"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full py-2.5 sm:py-3 rounded-2xl sm:rounded-[35px] font-semibold text-sm sm:text-base text-white shadow-md transition-all focus:ring-2 focus:ring-green-600 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 touch-manipulation min-h-[44px]"
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

        </form>
      </motion.div>
      
      {/* Success Celebration */}
      <FormSuccessCelebration
        isVisible={showCelebration}
        formType="dvir" // Using 'dvir' for green theme since RTO doesn't have a specific type
        title="Request Submitted!"
        message="Your time-off request has been submitted and is pending approval. You'll be notified once it's reviewed."
        onContinue={handleCelebrationContinue}
        userName={userFullName || undefined}
      />
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
