import { useState, FormEvent, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ArrowRight } from "lucide-react";
import { VideoBackground } from "../components/VideoBackground";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import logo from "../assets/ATTS_Logo-removebg-preview.png";
import logo2x from "../assets/ATTS_Logo-removebg-preview@2x.png";
import { logger } from "../lib/logger";
import { getRoleDashboard } from "../lib/navigation";

type AuthMode = "login" | "signup";

export default function Home() {
  const navigate = useNavigate();
  const { session, role } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [driversLicenseNumber, setDriversLicenseNumber] = useState("");
  const [driversLicenseClass, setDriversLicenseClass] = useState("");
  const [driversLicenseExpiration, setDriversLicenseExpiration] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Simplified hero copy
  const heroCopy: Record<
    AuthMode,
    {
      title: string;
      subtitle: string;
    }
  > = {
    login: {
      title: "Welcome Back",
      subtitle: "Access your dashboard and stay connected with your team.",
    },
    signup: {
      title: "Join the Team",
      subtitle: "Create your portal identity to get started.",
    },
  };

  const licenseClassOptions = [
    { label: "Class A (CDL)", value: "Class A" },
    { label: "Class B (CDL)", value: "Class B" },
    { label: "Class C", value: "Class C" },
    { label: "Class D", value: "Class D" },
    { label: "Non-CDL / Chauffeur", value: "Non-CDL" },
    { label: "Other / Specialized", value: "Other" },
  ];

  const isSignup = mode === "signup";
  const currentHero = heroCopy[mode];

  // Redirect to appropriate dashboard based on user role
  useEffect(() => {
    if (session) {
      const targetDashboard = getRoleDashboard(role);
      logger.info(`Session detected (role: ${role}), redirecting to ${targetDashboard}`);
      navigate(targetDashboard, { replace: true });
    }
  }, [session, role, navigate]);

  const handleModeSwitch = (newMode: AuthMode) => {
    logger.info(`Switching mode to: ${newMode}`);
    setMode(newMode);
    setError(null);
    setSuccess(null);
    setShowPassword(false);
    if (newMode === "login") {
      setFullName("");
      setDriversLicenseNumber("");
      setDriversLicenseClass("");
      setDriversLicenseExpiration("");
    }
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    logger.info("Attempting login for:", email);
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        logger.error("Login error:", error.message);
        setError(error.message);
      } else if (data.user) {
        logger.info("Login successful for:", data.user.email);
      }
    } catch (err) {
      logger.error("Unexpected login error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    logger.info("Attempting signup for:", email);
    setLoading(true);
    setError(null);
    setSuccess(null);

    const normalizedFullName = fullName.trim();
    const normalizedDlNumber = driversLicenseNumber.trim();
    const normalizedDlClass = driversLicenseClass.trim();
    const normalizedDlExpiration = driversLicenseExpiration.trim();

    if (!normalizedFullName || !normalizedDlNumber || !normalizedDlClass || !normalizedDlExpiration) {
      setError("Please complete all required onboarding fields to continue.");
      setLoading(false);
      return;
    }

    try {
      const redirectUrl = `${window.location.origin}/dashboard`;
      logger.info("Email confirmation will redirect to:", redirectUrl);

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: normalizedFullName,
            drivers_license_number: normalizedDlNumber,
            drivers_license_class: normalizedDlClass,
            drivers_license_expiration: normalizedDlExpiration,
          },
        },
      });

      if (error) {
        logger.error("Signup error:", error.message);
        setError(error.message);
      } else if (data.user) {
        logger.info("Signup successful for:", data.user.email);

        if (data.user.identities && data.user.identities.length === 0) {
          setError("This email is already registered. Please log in instead.");
        } else {
          setSuccess("Account created! Check your email to confirm your account.");
          setEmail("");
          setPassword("");
          setFullName("");
          setDriversLicenseNumber("");
          setDriversLicenseClass("");
          setDriversLicenseExpiration("");
        }
      }
    } catch (err) {
      logger.error("Unexpected signup error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Liquid Glass input styles
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
          className="mb-0"
        >
          <img
            src={logo}
            srcSet={`${logo} 1x, ${logo2x} 2x`}
            alt="ATTS Logo"
            fetchPriority="high"
            className="h-64 sm:h-80 md:h-96 lg:h-[28rem] xl:h-[32rem] w-auto mx-auto opacity-95 drop-shadow-[0_0_60px_rgba(16,185,129,0.5)]"
          />
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
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-white/5 to-emerald-500/20 rounded-[2rem] blur-2xl opacity-60" />
            
            {/* Card */}
            <div className="relative bg-white/[0.04] backdrop-blur-3xl rounded-[1.75rem] border border-white/[0.08] shadow-[0_8px_64px_rgba(0,0,0,0.4)] overflow-hidden">
              {/* Subtle inner glow */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/[0.06] via-transparent to-transparent pointer-events-none" />
              
              {/* Hero section - simplified */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="relative px-6 pt-8 pb-6 text-center border-b border-white/[0.06]"
                >
                  <h2 className="text-2xl font-bold font-serif text-white tracking-tight">
                    {currentHero.title}
                  </h2>
                  <p className="text-sm text-white/50 mt-2 max-w-xs mx-auto">
                    {currentHero.subtitle}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Form section */}
              <div className="relative p-6">
                {/* Mode toggle - 44px minimum touch targets for mobile */}
                <div className="flex justify-center mb-6">
                  <div className="inline-flex bg-white/[0.03] border border-white/[0.06] rounded-full p-1">
                    {(["login", "signup"] as AuthMode[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleModeSwitch(option)}
                        className={`px-5 py-2.5 min-h-[44px] text-sm font-medium rounded-full transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                          mode === option
                            ? "bg-white/10 text-white shadow-lg shadow-black/20 border border-white/10"
                            : "text-white/40 hover:text-white/70"
                        }`}
                        aria-label={option === "login" ? "Sign In" : "Sign Up"}
                        aria-pressed={mode === option ? "true" : "false"}
                      >
                        {option === "login" ? "Sign In" : "Sign Up"}
                      </button>
                    ))}
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.form
                    key={mode}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                    onSubmit={mode === "login" ? handleSignIn : handleSignUp}
                    className="space-y-4"
                  >
                    {/* Email */}
                    <div className="space-y-2">
                      <label htmlFor="auth-email" className={labelStyles}>
                        Email
                      </label>
                      <input
                        id="auth-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="you@atts.com"
                        className={inputStyles}
                      />
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label htmlFor="auth-password" className={labelStyles}>
                          Password
                        </label>
                        {isSignup && (
                          <span className="flex items-center gap-1 text-[10px] text-white/30">
                            <Lock className="w-3 h-3" />
                            Min. 6 characters
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          id="auth-password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          placeholder={isSignup ? "Create password" : "Enter password"}
                          minLength={6}
                          autoComplete={isSignup ? "new-password" : "current-password"}
                          className={`${inputStyles} pr-16`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute top-1/2 right-1 -translate-y-1/2 text-[11px] font-medium text-white/30 hover:text-white/60 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>

                    {/* Signup fields */}
                    {isSignup && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4 pt-2"
                      >
                        {/* Full Name & License Number - stack on small phones (<640px) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label className={labelStyles}>Full Name</label>
                            <input
                              type="text"
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              required
                              placeholder="Your name"
                              className={inputStyles}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className={labelStyles}>License #</label>
                            <input
                              type="text"
                              value={driversLicenseNumber}
                              onChange={(e) => setDriversLicenseNumber(e.target.value)}
                              required
                              placeholder="CDL / ID"
                              className={inputStyles}
                            />
                          </div>
                        </div>

                        {/* License Class & Expiration - stack on small phones (<640px) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label htmlFor="license-class" className={labelStyles}>License Class</label>
                            <select
                              id="license-class"
                              value={driversLicenseClass}
                              onChange={(e) => setDriversLicenseClass(e.target.value)}
                              required
                              className={inputStyles}
                            >
                              <option value="" disabled>
                                Select
                              </option>
                              {licenseClassOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label htmlFor="license-expiration" className={labelStyles}>Expiration</label>
                            <input
                              id="license-expiration"
                              type="date"
                              value={driversLicenseExpiration}
                              onChange={(e) => setDriversLicenseExpiration(e.target.value)}
                              required
                              className={inputStyles}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}

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
                        <p className="font-medium">{success}</p>
                        {isSignup && (
                          <p className="text-xs text-emerald-200/60 mt-1">
                            Check your email to confirm your account.
                          </p>
                        )}
                      </motion.div>
                    )}

                    {/* Submit button */}
                    <button
                      type="submit"
                      disabled={loading}
                      aria-label={loading ? (mode === "login" ? "Signing in..." : "Creating account...") : (mode === "login" ? "Sign in" : "Create account")}
                      className="group w-full bg-gradient-to-r from-[#004708] to-[#03cc00] hover:from-[#004708] hover:to-[#03cc00] text-white font-semibold py-3.5 px-6 rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-900/30 hover:shadow-green-500/25 flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          {mode === "login" ? "Signing in..." : "Creating account..."}
                        </span>
                      ) : (
                        <>
                          {mode === "login" ? "Sign In" : "Create Account"}
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </button>

                    {/* Forgot Password link - only show on login */}
                    {!isSignup && (
                      <Link
                        to="/reset-password"
                        className="block text-center text-xs text-white/70 hover:text-white transition-colors mt-2"
                      >
                        Forgot your password?
                      </Link>
                    )}

                    {/* Helper text */}
                    <p className="text-[11px] text-white/30 text-center pt-2">
                      {isSignup
                        ? "Already have an account? Sign in above."
                        : "New to ATTS? Switch to Sign Up."}
                    </p>
                  </motion.form>
                </AnimatePresence>
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