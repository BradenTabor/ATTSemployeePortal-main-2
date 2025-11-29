import { useState, FormEvent, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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

    try {
      const redirectUrl = `${window.location.origin}/dashboard`;
      logger.info("Email confirmation will redirect to:", redirectUrl);

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectUrl,
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
      <div className="flex flex-col items-center justify-center min-h-screen text-center space-y-6 px-4">
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
          transition={{ duration: 1, delay: 0.6, ease: "easeInOut" }}
          className="w-full max-w-md"
        >
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl overflow-hidden">
            <div className="flex border-b border-white/20">
              <button
                type="button"
                onClick={() => handleModeSwitch("login")}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  mode === "login"
                    ? "bg-green-600/30 text-white border-b-2 border-green-500"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch("signup")}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  mode === "signup"
                    ? "bg-green-600/30 text-white border-b-2 border-green-500"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                Create Account
              </button>
            </div>

            <AnimatePresence mode="wait">
              <motion.form
                key={mode}
                initial={{ opacity: 0, x: mode === "login" ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === "login" ? 20 : -20 }}
                transition={{ duration: 0.3 }}
                onSubmit={mode === "login" ? handleSignIn : handleSignUp}
                className="p-6 sm:p-8 space-y-4"
              >
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="Email"
                    className="w-full px-4 py-3 bg-black/30 text-white placeholder-white/60 rounded-lg border border-white/20 focus:border-green-500 focus:ring-2 focus:ring-green-500/50 outline-none transition"
                  />
                </div>

                <div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Password (min. 6 characters)"
                    minLength={6}
                    className="w-full px-4 py-3 bg-black/30 text-white placeholder-white/60 rounded-lg border border-white/20 focus:border-green-500 focus:ring-2 focus:ring-green-500/50 outline-none transition"
                  />
                  {mode === "signup" && (
                    <p className="text-xs text-white/50 mt-1 ml-1">
                      Password must be at least 6 characters
                    </p>
                  )}
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/20 border border-red-500/50 text-red-100 px-4 py-3 rounded-lg text-sm"
                  >
                    {error}
                  </motion.div>
                )}

                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-green-500/20 border border-green-500/50 text-green-100 px-4 py-3 rounded-lg text-sm space-y-1"
                  >
                    <p className="font-semibold">{success}</p>
                    {mode === "signup" && (
                      <p className="text-xs text-green-200/80">
                        Click the confirmation link in your email, then return here to log in.
                      </p>
                    )}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-green-500/50"
                >
                  {loading
                    ? mode === "login"
                      ? "Signing in..."
                      : "Creating account..."
                    : mode === "login"
                    ? "Sign In"
                    : "Create Account"}
                </button>
              </motion.form>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </VideoBackground>
  );
}
