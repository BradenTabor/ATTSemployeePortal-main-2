import { useState, FormEvent, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, ArrowLeft, CheckCircle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { logger } from "../lib/logger";
import { AuthShell } from "./home/AuthShell";
import { AuthBrandPanel } from "./home/AuthBrandPanel";

type ResetMode = "request" | "update";

const inputStyles =
  "w-full rounded-leaf-sm border border-white/10 bg-white/[0.03] px-4 py-3.5 text-base text-white placeholder-white/30 outline-none transition-all duration-200 focus:bg-white/[0.06] focus-visible:border-emerald-400/50 focus-visible:ring-2 focus-visible:ring-emerald-400/15";
const labelStyles = "text-[11px] font-medium uppercase tracking-[0.2em] text-white/40";
const submitStyles =
  "group flex w-full items-center justify-center gap-2 rounded-leaf-sm bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-900/30 transition-all duration-200 hover:from-emerald-500 hover:to-emerald-400 hover:shadow-emerald-500/25 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#040605] disabled:cursor-not-allowed disabled:opacity-50";

function Spinner({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2">
      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      {label}
    </span>
  );
}

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
      const { data: { session } } = await supabase.auth.getSession();

      if (session && window.location.hash.includes("type=recovery")) {
        logger.info("Password reset token detected, switching to update mode");
        setMode("update");
      } else if (window.location.hash.includes("type=recovery")) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, recoverySession) => {
          if (event === "PASSWORD_RECOVERY" && recoverySession) {
            logger.info("PASSWORD_RECOVERY event received");
            setMode("update");
          }
        });

        return () => subscription.unsubscribe();
      }
    };

    checkResetToken();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        logger.info("PASSWORD_RECOVERY event triggered");
        setMode("update");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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

      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        logger.error("Password update error:", error.message);
        setError(error.message);
      } else {
        logger.info("Password updated successfully");
        setSuccess("Password updated successfully! Redirecting to login...");

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

  const hero =
    mode === "update"
      ? { title: "Set a new password", subtitle: "Choose a new password to secure your account." }
      : emailSent
        ? { title: "Check your email", subtitle: "We've sent a secure reset link to your inbox." }
        : { title: "Reset password", subtitle: "Enter your email and we'll send you a secure reset link." };

  return (
    <AuthShell
      brand={<AuthBrandPanel title={hero.title} subtitle={hero.subtitle} />}
      footer={
        <p className="text-center text-[11px] text-white/25">Secure portal powered by Supabase</p>
      }
    >
      <div
        className="w-full rounded-leaf border border-white/10 bg-white/[0.04] p-6 shadow-[0_8px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-7
          xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none xl:backdrop-blur-none"
      >
        {mode === "request" ? (
          emailSent ? (
            <div className="py-2 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20">
                <CheckCircle className="h-8 w-8 text-emerald-400" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-white">Check your email</h3>
              <p className="mt-2 text-sm text-white/50">
                We've sent a password reset link to
                <br />
                <span className="font-medium text-emerald-400">{email}</span>
              </p>
              <p className="mb-6 mt-4 text-xs text-white/30">
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEmailSent(false);
                  setEmail("");
                  setSuccess(null);
                }}
                className="text-sm text-emerald-400 transition-colors hover:text-emerald-300"
              >
                Try a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetRequest} className="space-y-4 text-left">
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
                  autoComplete="email"
                  className={inputStyles}
                  autoFocus
                />
              </div>

              {error && (
                <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} aria-label={loading ? "Sending reset link" : "Send password reset link"} className={submitStyles}>
                {loading ? (
                  <Spinner label="Sending..." />
                ) : (
                  <>
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    Send Reset Link
                  </>
                )}
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handlePasswordUpdate} className="space-y-4 text-left">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="new-password" className={labelStyles}>
                  New Password
                </label>
                <span className="flex items-center gap-1 text-[10px] text-white/30">
                  <Lock className="h-3 w-3" aria-hidden="true" />
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
                  className="absolute right-1 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-[11px] font-medium text-white/30 transition-colors hover:text-white/60 focus-visible:text-white/70 focus-visible:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

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

            {error && (
              <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {success && (
              <div role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" aria-hidden="true" />
                  {success}
                </div>
              </div>
            )}

            <button type="submit" disabled={loading || !!success} className={submitStyles}>
              {loading ? (
                <Spinner label="Updating..." />
              ) : (
                <>
                  <Lock className="h-4 w-4" aria-hidden="true" />
                  Update Password
                </>
              )}
            </button>
          </form>
        )}

        {/* Back to login */}
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mt-4 flex w-full items-center justify-center gap-2 py-3 text-sm text-white/40 transition-colors hover:text-white/70 focus-visible:text-white/80 focus-visible:outline-none"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Sign In
        </button>
      </div>
    </AuthShell>
  );
}
