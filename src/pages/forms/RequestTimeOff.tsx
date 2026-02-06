import DashboardLayout from "../../layouts/DashboardLayout";
import { motion } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { formToast } from "../../lib/formToast";
import { useRTOSubmission, useRTOUserProfile } from "../../hooks/rto";
import { DateField, TimeField } from "../../components/forms/GlassyPickers";
import { CalendarDays, Clock } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { getRoleDashboard } from "../../lib/navigation";
import { FormSuccessCelebration } from "../../components/forms/FormSuccessCelebration";
import {
  trackFormStarted,
  createFormTimer,
} from "../../lib/telemetry";

export default function RequestTimeOff() {
  const { user, fullName: userFullName, role } = useAuth();
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
  // QA-003: Prevent duplicate submissions with atomic ref check
  const submittingRef = useRef(false);
  
  // Success celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const hasFullRange =
    Boolean(formData.startDate) &&
    Boolean(formData.endDate) &&
    Boolean(startTime) &&
    Boolean(endTime);

  // Telemetry: track form completion time
  const formTimer = useRef(createFormTimer());
  const submitFormRef = useRef<() => Promise<void>>();
  
  // Custom hooks for RTO operations
  const { submitRTO } = useRTOSubmission();
  const { profile: userProfile, loading: profileLoading } = useRTOUserProfile();

  // Track form_started on mount
  useEffect(() => {
    trackFormStarted({ form_type: 'rto' });
    formTimer.current.reset();
  }, []);

  // Populate form with user profile data
  useEffect(() => {
    if (!profileLoading && userProfile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData((prev) => ({
        ...prev,
        // Priority: profile.email → existing form value
        email: userProfile.email || prev.email,
        // Only auto-fill name if empty so user can override
        fullName: prev.fullName || userProfile.fullName || "",
      }));
    }
  }, [userProfile, profileLoading]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    // Need all four fields to calculate a proper total
    if (!startTime || !endTime || !formData.startDate || !formData.endDate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    // QA-003: Prevent duplicate submissions - atomic check using ref to prevent race condition
    if (submittingRef.current || status === "loading") {
      return;
    }
    submittingRef.current = true; // Set ref immediately (atomic)
    setStatus("loading");
    formToast.submitting("Submitting your time-off request...");

    const result = await submitRTO(
      {
        ...formData,
        startTime,
        endTime,
        totalDuration,
      },
      user?.id,
      formTimer.current
    );

    if (result.success) {
      // Dismiss loading toast before showing celebration
      formToast.dismiss();

      setStatus("success");
      submittingRef.current = false; // QA-003: Reset ref on success
      
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
    } else {
      setStatus("error");
      formToast.error(
        "Submission Failed",
        result.error || "Something went wrong. Please try again.",
        { onRetry: () => submitFormRef.current?.() }
      );
      
      setTimeout(() => {
        setStatus("idle");
        submittingRef.current = false; // QA-003: Reset ref after error timeout
      }, 3000);
    }
  }, [formData, startTime, endTime, totalDuration, user?.id, submitRTO, status]);

  // Store submitForm in ref to avoid circular dependency
  useEffect(() => {
    submitFormRef.current = submitForm;
  }, [submitForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitForm();
  };
  
  // Handle celebration continue
  const handleCelebrationContinue = useCallback(() => {
    setShowCelebration(false);
    setStatus("idle");
    navigate(getRoleDashboard(role));
  }, [navigate, role]);

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
                className="w-full rounded-xl sm:rounded-2xl px-3 py-2.5 text-base sm:text-sm bg-neutral-900 border border-green-700/40 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-600 transition-all"
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
                className="w-full rounded-xl sm:rounded-2xl px-3 py-2.5 text-base sm:text-sm bg-neutral-900 border border-green-700/40 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-600 transition-all"
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
                className="w-full rounded-xl sm:rounded-2xl px-3 py-2.5 text-base sm:text-sm bg-neutral-900 border border-green-700/40 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-600 transition-all"
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
                className="w-full rounded-xl sm:rounded-2xl px-3 py-2.5 text-base bg-neutral-900 border border-green-700/40 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-600 resize-none transition-all"
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
                className="w-full rounded-xl sm:rounded-2xl px-3 py-2.5 text-base bg-neutral-900 border border-green-700/40 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-600 resize-none transition-all"
                placeholder="Extra details"
              />
            </div>
          </div>

          <button
            type="submit"
            data-testid="rto-submit-button"
            disabled={status === "loading"}
            className="w-full py-2.5 sm:py-3 rounded-2xl sm:rounded-[35px] font-semibold text-sm sm:text-base text-white shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d] disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 touch-manipulation min-h-[44px]"
            aria-label={status === "loading" ? "Submitting request" : "Submit time-off request"}
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
