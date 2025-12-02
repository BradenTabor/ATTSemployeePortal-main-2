import { useState, FormEvent, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Lock, Sparkles } from "lucide-react";
import { VideoBackground } from "../components/VideoBackground";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import logo from "../assets/ATTS_Logo-removebg-preview.png";
import { logger } from "../lib/logger";


type AuthMode = "login" | "signup";

export default function Home() {
  const navigate = useNavigate();
  const { session, isAdmin, hasMechanicAccess } = useAuth();
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

  const heroCopy: Record<
    AuthMode,
    {
      badge: string;
      title: string;
      description: string;
      bullets: string[];
      statLabel: string;
      statValue: string;
      footnote: string;
    }
  > = {
    login: {
      badge: "Returning Team Members",
      title: "Secure Workforce Access",
      description:
        "Log back in to review crew updates, monitor fleet health, and act on approvals in one place.",
      bullets: [
        "Role-aware dashboards for admins, mechanics, and field teams",
        "Session protection powered by Supabase Auth",
        "Live data synchronized with DVIR, JSA, and equipment logs",
      ],
      statLabel: "Fast Redirect",
      statValue: "< 2s",
      footnote: "Average time to route you to the right dashboard",
    },
    signup: {
      badge: "New Employee Setup",
      title: "Create Your ATTS Portal Identity",
      description:
        "Share a few licensing details so we can pre-configure safety workflows and compliance records.",
      bullets: [
        "Identity syncs directly with app_users secure profile",
        "Licensing data stays encrypted at rest",
        "Instant email verification routed to your ATTS inbox",
      ],
      statLabel: "Onboarding Time",
      statValue: "~ 60s",
      footnote: "Complete once. Updates are handled by the admin team.",
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
      if (hasMechanicAccess && !isAdmin) {
        logger.info("Mechanic session detected, redirecting to mechanic dashboard");
        navigate("/mechanic-dashboard", { replace: true });
      } else {
        logger.info("Active session detected, redirecting to dashboard");
        navigate("/dashboard", { replace: true });
      }
    }
  }, [session, isAdmin, hasMechanicAccess, navigate]);

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
        // ✅ AuthContext's onAuthStateChange will pick this up,
        //    update session + role, and the useEffect above will redirect.
      }
    } catch (err) {
      logger.error("Unexpected login error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      // ✅ Always stop the local loading state, even if something fails
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

  return (
    <VideoBackground videoSrc="https://res.cloudinary.com/ddqvn1gi5/video/upload/v1761347534/20251024_1735_New_Video_simple_compose_01k8c5rppves9tja80dm88cqsx_lqoodw.mp4">
      <div className="flex flex-col items-center justify-center min-h-screen text-center space-y-8 px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="space-y-4"
        >
          <img
            src={logo}
            alt="ATTS Logo"
            className="h-24 sm:h-28 md:h-32 w-auto mx-auto opacity-90"
          />
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white drop-shadow-lg leading-tight">
            Welcome to All Terrain Tree Service
          </h1>
          <p className="text-lg sm:text-xl text-gray-200 mt-2">
            Simplifying communication, management, and operations.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          className="w-full max-w-5xl"
        >
          <div className="bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/15 shadow-2xl overflow-hidden">
            <div className="grid md:grid-cols-[1.05fr_0.95fr] divide-y md:divide-y-0 md:divide-x divide-white/10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4 }}
                  className="relative text-left p-6 sm:p-8 bg-gradient-to-br from-emerald-600/20 via-black/40 to-emerald-900/20"
                >
                  <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-emerald-100/90 bg-white/5 border border-white/10 rounded-full px-4 py-1">
                    <Sparkles className="w-3 h-3" />
                    {currentHero.badge}
                  </span>
                  <h3 className="text-3xl font-black text-white mt-4">{currentHero.title}</h3>
                  <p className="text-sm text-white/80 leading-relaxed mt-3">
                    {currentHero.description}
                  </p>
                  <ul className="mt-6 space-y-3">
                    {currentHero.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-3 text-white/80">
                        <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0 mt-0.5" />
                        <span className="text-sm leading-relaxed">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8 p-4 rounded-2xl border border-white/10 bg-white/5">
                    <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                      {currentHero.statLabel}
                    </p>
                    <p className="text-4xl font-black text-white mt-1">{currentHero.statValue}</p>
                    <p className="text-[11px] text-white/60 mt-2">{currentHero.footnote}</p>
                  </div>
                  <div className="absolute inset-0 pointer-events-none opacity-70 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.25),_transparent_65%)]" />
                </motion.div>
              </AnimatePresence>

              <div className="p-6 sm:p-8 text-left bg-slate-950/30">
                <div className="flex justify-center mb-6">
                  <div className="inline-flex bg-white/5 border border-white/15 rounded-full p-1">
                    {(["login", "signup"] as AuthMode[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleModeSwitch(option)}
                        className={`px-6 py-2 text-sm font-semibold rounded-full transition-all ${
                          mode === option
                            ? "bg-white text-slate-900 shadow-lg"
                            : "text-white/70 hover:text-white"
                        }`}
                        aria-pressed={mode === option}
                      >
                        {option === "login" ? "Sign In" : "Create Account"}
                      </button>
                    ))}
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.form
                    key={mode}
                    initial={{ opacity: 0, x: mode === "login" ? 15 : -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: mode === "login" ? -15 : 15 }}
                    transition={{ duration: 0.35 }}
                    onSubmit={mode === "login" ? handleSignIn : handleSignUp}
                    className="space-y-5"
                  >
                    <div className="space-y-1">
                      <label
                        htmlFor="auth-email"
                        className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60"
                      >
                        Email Address
                      </label>
                      <input
                        id="auth-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="crew.member@atts.com"
                        className="w-full px-4 py-3 rounded-2xl bg-black/60 text-white placeholder-white/40 border border-white/15 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 outline-none transition"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="auth-password"
                          className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60"
                        >
                          Password
                        </label>
                        <span className="flex items-center gap-1 text-[11px] text-white/50">
                          <Lock className="w-3.5 h-3.5" />
                          {isSignup ? "Min. 6 characters" : "Use your portal password"}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          id="auth-password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          placeholder={isSignup ? "Create a secure password" : "Enter your password"}
                          minLength={6}
                          className="w-full px-4 py-3 rounded-2xl bg-black/60 text-white placeholder-white/40 border border-white/15 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 outline-none transition pr-28"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold tracking-wide text-emerald-200 hover:text-white transition"
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>

                    {isSignup && (
                      <div className="space-y-4 pt-2">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60">
                              Full Name
                            </label>
                            <input
                              type="text"
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              required
                              placeholder="First & Last Name"
                              className="w-full px-4 py-3 rounded-2xl bg-black/60 text-white placeholder-white/40 border border-white/15 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 outline-none transition"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60">
                              License Number
                            </label>
                            <input
                              type="text"
                              value={driversLicenseNumber}
                              onChange={(e) => setDriversLicenseNumber(e.target.value)}
                              required
                              placeholder="CDL / State ID"
                              className="w-full px-4 py-3 rounded-2xl bg-black/60 text-white placeholder-white/40 border border-white/15 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 outline-none transition"
                            />
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60">
                              License Class
                            </label>
                            <select
                              value={driversLicenseClass}
                              onChange={(e) => setDriversLicenseClass(e.target.value)}
                              required
                              className="w-full px-4 py-3 rounded-2xl bg-black/60 text-white border border-white/15 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 outline-none transition"
                            >
                              <option value="" disabled>
                                Select class
                              </option>
                              {licenseClassOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60">
                              License Expiration
                            </label>
                            <input
                              type="date"
                              value={driversLicenseExpiration}
                              onChange={(e) => setDriversLicenseExpiration(e.target.value)}
                              required
                              className="w-full px-4 py-3 rounded-2xl bg-black/60 text-white border border-white/15 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 outline-none transition"
                            />
                          </div>
                        </div>

                        <p className="text-[11px] text-white/50">
                          Licensing data is encrypted, synced to `app_users`, and only visible to the
                          safety & compliance team.
                        </p>
                      </div>
                    )}

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-red-500/15 border border-red-500/40 text-red-100 px-4 py-3 rounded-2xl text-sm"
                      >
                        {error}
                      </motion.div>
                    )}

                    {success && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-emerald-500/15 border border-emerald-400/40 text-emerald-100 px-4 py-3 rounded-2xl text-sm space-y-1"
                      >
                        <p className="font-semibold">{success}</p>
                        {isSignup && (
                          <p className="text-xs text-emerald-100/80">
                            Confirm your email to activate your access. You can return here after
                            verification.
                          </p>
                        )}
                      </motion.div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold py-3.5 px-6 rounded-2xl transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                    >
                      {loading
                        ? mode === "login"
                          ? "Signing you in..."
                          : "Creating your account..."
                        : mode === "login"
                        ? "Access Portal"
                        : "Create Secure Account"}
                    </button>

                    <p className="text-[11px] text-white/50 text-center">
                      {isSignup
                        ? "Already submitted your documents? Sign in instead."
                        : "Need access? Switch to Create Account to start onboarding."}
                    </p>
                  </motion.form>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </VideoBackground>
  );
}
