import { useState, FormEvent, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, ArrowLeft, CheckCircle, KeyRound } from "lucide-react";
import { VideoBackground } from "../components/VideoBackground";
import { supabase } from "../lib/supabaseClient";
import logo from "../assets/ATTS_Logo-removebg-preview.png";
import { logger } from "../lib/logger";

type ResetMode = "request" | "update";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<ResetMode>("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Check if user arrived via password reset link (has access token in URL)
  useEffect(() => {
    const checkResetToken = async () => {
      // Supabase automatically handles the token from the URL hash
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session && window.location.hash.includes('type=recovery')) {
        logger.info("Password reset token detected, switching to update mode");
        setMode("update");
      } else if (window.location.hash.includes('type=recovery')) {
        // Token present but session check might need auth state change listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, recoverySession) => {
          if (event === 'PASSWORD_RECOVERY' && recoverySession) {
            logger.info("PASSWORD_RECOVERY event received");
            setMode("update");
          }
        });
        
        return () => subscription.unsubscribe();
      }
    };

    checkResetToken();

    // Also listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        logger.info("PASSWORD_RECOVERY event triggered");
        setMode("update");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle password reset request (send email)
  const handleResetRequest = async (e: FormEvent) => {
    e.preventDefault();
    logger.info("Requesting password reset for:", email);
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      logger.info("Password reset will redirect to:", redirectUrl);

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });

      if (error) {
        logger.error("Password reset request error:", error.message);
        setError(error.message);
      } else {
        logger.info("Password reset email sent successfully");
        setSuccess("Check your email for a password reset link.");
        setEmailSent(true);
      }
    } catch (err) {
      logger.error("Unexpected password reset error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle setting new password
  const handlePasswordUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    try {
      logger.info("Updating password...");
      
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        logger.error("Password update error:", error.message);
        setError(error.message);
      } else {
        logger.info("Password updated successfully");
        setSuccess("Password updated successfully! Redirecting to login...");
        
        // Sign out and redirect to home after a short delay
        setTimeout(async () => {
          await supabase.auth.signOut();
          navigate("/", { replace: true });
        }, 2000);
      }
    } catch (err) {
      logger.error("Unexpected password update error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Liquid Glass input styles (matching Home.tsx)
  const inputStyles = "w-full px-4 py-3.5 rounded-2xl bg-white/[0.03] text-white placeholder-white/30 border border-white/[0.08] focus:border-emerald-400/50 focus:bg-white/[0.06] focus:ring-1 focus:ring-emerald-400/20 outline-none transition-all duration-300 backdrop-blur-sm";
  const labelStyles = "text-[11px] font-medium uppercase tracking-[0.2em] text-white/40";

  return (
    <VideoBackground videoSrc="https://res.cloudinary.com/ddqvn1gi5/video/upload/v1761347534/20251024_1735_New_Video_simple_compose_01k8c5rppves9tja80dm88cqsx_lqoodw.mp4">
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 py-8">
        {/* Logo and Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-8"
        >
          <img
            src={logo}
            alt="ATTS Logo"
            // @ts-expect-error fetchpriority is a valid HTML attribute but not in React types yet
            fetchpriority="high"
            className="h-20 sm:h-24 w-auto mx-auto opacity-95 drop-shadow-2xl"
          />
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-4 tracking-tight break-normal">
            All Terrain Tree Service
          </h1>
        </motion.div>

        {/* Liquid Glass Card */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md"
        >
          {/* Main glass container */}
          <div className="relative">
            {/* Glow effect behind card */}
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-white/5 to-emerald-500/20 rounded-[2rem] blur-[25px] opacity-60" />
            
            {/* Card */}
            <div className="relative bg-white/[0.04] backdrop-blur-[10px] rounded-[1.75rem] border border-white/[0.08] shadow-[0_8px_64px_rgba(0,0,0,0.4)] overflow-hidden">
              {/* Subtle inner glow */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/[0.06] via-transparent to-transparent pointer-events-none" />
              
              {/* Hero section */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="relative px-6 pt-8 pb-6 text-center border-b border-white/[0.06]"
                >
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center">
                    {mode === "request" ? (
                      <Mail className="w-7 h-7 text-emerald-400" />
                    ) : (
                      <KeyRound className="w-7 h-7 text-emerald-400" />
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    {mode === "request" ? "Reset Password" : "Create New Password"}
                  </h2>
                  <p className="text-sm text-white/50 mt-2 max-w-xs mx-auto">
                    {mode === "request"
                      ? "Enter your email and we'll send you a reset link."
                      : "Enter your new password below."}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Form section */}
              <div className="relative p-6">
                <AnimatePresence mode="wait">
                  {mode === "request" ? (
                    <motion.div
                      key="request"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.25 }}
                    >
                      {emailSent ? (
                        // Success state after email sent
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-center py-6"
                        >
                          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                            <CheckCircle className="w-8 h-8 text-emerald-400" />
                          </div>
                          <h3 className="text-lg font-semibold text-white mb-2">Check Your Email</h3>
                          <p className="text-sm text-white/50 mb-6">
                            We've sent a password reset link to<br />
                            <span className="text-emerald-400 font-medium">{email}</span>
                          </p>
                          <p className="text-xs text-white/30 mb-6">
                            Didn't receive the email? Check your spam folder or try again.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setEmailSent(false);
                              setEmail("");
                              setSuccess(null);
                            }}
                            className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                          >
                            Try a different email
                          </button>
                        </motion.div>
                      ) : (
                        // Email input form
                        <form onSubmit={handleResetRequest} className="space-y-4">
                          {/* Email */}
                          <div className="space-y-2">
                            <label htmlFor="reset-email" className={labelStyles}>
                              Email Address
                            </label>
                            <input
                              id="reset-email"
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required
                              placeholder="you@atts.com"
                              className={inputStyles}
                              autoFocus
                            />
                          </div>

                          {/* Error message */}
                          {error && (
                            <motion.div
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl text-sm backdrop-blur-sm"
                            >
                              {error}
                            </motion.div>
                          )}

                          {/* Submit button */}
                          <button
                            type="submit"
                            disabled={loading}
                            aria-label={loading ? "Sending reset link" : "Send password reset link"}
                            className="group w-full bg-gradient-to-r from-emerald-500/90 to-emerald-600/90 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold py-3.5 px-6 rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/30 hover:shadow-emerald-500/25 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                          >
                            {loading ? (
                              <span className="flex items-center gap-2">
                                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Sending...
                              </span>
                            ) : (
                              <>
                                <Mail className="w-4 h-4" />
                                Send Reset Link
                              </>
                            )}
                          </button>
                        </form>
                      )}
                    </motion.div>
                  ) : (
                    // Update password form
                    <motion.form
                      key="update"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.25 }}
                      onSubmit={handlePasswordUpdate}
                      className="space-y-4"
                    >
                      {/* New Password */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label htmlFor="new-password" className={labelStyles}>
                            New Password
                          </label>
                          <span className="flex items-center gap-1 text-[10px] text-white/30">
                            <Lock className="w-3 h-3" />
                            Min. 6 characters
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            id="new-password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="Enter new password"
                            minLength={6}
                            className={`${inputStyles} pr-16`}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="absolute top-1/2 right-3 -translate-y-1/2 text-[11px] font-medium text-white/30 hover:text-white/60 transition-colors"
                          >
                            {showPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                      </div>

                      {/* Confirm Password */}
                      <div className="space-y-2">
                        <label htmlFor="confirm-password" className={labelStyles}>
                          Confirm Password
                        </label>
                        <input
                          id="confirm-password"
                          type={showPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          placeholder="Confirm new password"
                          minLength={6}
                          className={inputStyles}
                        />
                      </div>

                      {/* Error message */}
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl text-sm backdrop-blur-sm"
                        >
                          {error}
                        </motion.div>
                      )}

                      {/* Success message */}
                      {success && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 px-4 py-3 rounded-xl text-sm backdrop-blur-sm"
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            {success}
                          </div>
                        </motion.div>
                      )}

                      {/* Submit button */}
                      <button
                        type="submit"
                        disabled={loading || !!success}
                        className="group w-full bg-gradient-to-r from-emerald-500/90 to-emerald-600/90 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold py-3.5 px-6 rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/30 hover:shadow-emerald-500/25 flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Updating...
                          </span>
                        ) : (
                          <>
                            <Lock className="w-4 h-4" />
                            Update Password
                          </>
                        )}
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>

                {/* Back to login link */}
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  onClick={() => navigate("/")}
                  className="flex items-center justify-center gap-2 w-full mt-4 py-3 text-sm text-white/40 hover:text-white/70 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Footer text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-[11px] text-white/20 mt-6"
        >
          Secure portal powered by Supabase
        </motion.p>
      </div>
    </VideoBackground>
  );
}

