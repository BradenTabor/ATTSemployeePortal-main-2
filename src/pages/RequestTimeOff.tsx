import DashboardLayout from "../layouts/DashboardLayout";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function RequestTimeOff() {
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

    // 🔹 Load current user from Supabase and populate email
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error("Error fetching auth user:", userError);
          return;
        }

        if (!user) {
          console.warn("No authenticated user found");
          return;
        }

        // Try to also fetch user_profiles row (optional)
        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("email")
          .eq("user_id", user.id) // 👈 change to the correct FK column if needed
          .maybeSingle(); // won't throw if no row

        if (profileError) {
          console.error("Error fetching user profile:", profileError);
        }

        // Log to verify what you're getting back
        console.log("Auth user:", user);
        console.log("Profile row:", profile);

        setFormData((prev) => ({
          ...prev,
          // ✅ Priority: profile.email → auth user.email → existing form value
          email: profile?.email ?? user.email ?? prev.email,
          // ✅ Only auto-fill name if empty so user can override
          fullName: prev.fullName || profile?.full_name || "",
        }));
      } catch (err) {
        console.error("Unexpected error fetching user profile:", err);
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

      const res = await fetch(
        "https://hook.us2.make.com/ra84c07wtmtub87etqp4nncrlitijiqc",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) throw new Error("Webhook failed");

      const { error } = await supabase.from("rto_requests").insert([
        {
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
      console.error("Submission error:", err);
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
        className="w-full max-w-3xl bg-black/70 backdrop-blur-xl border border-green-700/30 rounded-2xl p-8 shadow-2xl text-white"
      >
        <h2 className="text-2xl font-semibold text-green-400 mb-6 text-center">
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
              className="w-full rounded-lg p-3 bg-neutral-900 border border-green-700/40 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-600 transition-all"
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
    className="w-full rounded-lg p-3 bg-neutral-900 border border-green-700/40 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-600 transition-all"
    placeholder="you@atts.com"
  />
</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">
                Start Date
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                required
                className="w-full rounded-lg p-3 bg-neutral-900 border border-green-700/40 text-white focus:outline-none focus:ring-2 focus:ring-green-600 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">
                End Date
              </label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                required
                className="w-full rounded-lg p-3 bg-neutral-900 border border-green-700/40 text-white focus:outline-none focus:ring-2 focus:ring-green-600 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">
                Start Time<span className="text-red-400 ml-1">*</span>
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg p-3 bg-neutral-900 border border-green-700/40 text-white focus:outline-none focus:ring-2 focus:ring-green-600 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">
                End Time<span className="text-red-400 ml-1">*</span>
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg p-3 bg-neutral-900 border border-green-700/40 text-white focus:outline-none focus:ring-2 focus:ring-green-600 transition-all"
              />
            </div>
          </div>

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
              className="w-full rounded-lg p-3 bg-neutral-900 border border-green-700/40 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-600 resize-none transition-all"
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
              className="w-full rounded-lg p-3 bg-neutral-900 border border-green-700/40 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-600 resize-none transition-all"
              placeholder="Any extra details (optional)"
            />
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full py-3 rounded-lg font-semibold bg-green-700 hover:bg-green-800 text-white shadow-md transition-all focus:ring-2 focus:ring-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
