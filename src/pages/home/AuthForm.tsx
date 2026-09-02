import React from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Lock, ArrowUpRight, WifiOff } from "lucide-react";
import { LICENSE_CLASS_OPTIONS, type AuthMode } from "./authCopy";
import type { AuthFormApi } from "./useAuthForm";
import { canopy } from "@/lib/glass";
import { EASE_CANOPY } from "@/motion/presets";

interface AuthFormProps {
  auth: AuthFormApi;
  isDeviceOnline: boolean;
  hasSession: boolean;
}

const inputStyles = canopy.input;
const labelStyles = "type-instrument text-bone-300";

const MODES: AuthMode[] = ["login", "signup"];

export const AuthForm: React.FC<AuthFormProps> = ({ auth, isDeviceOnline, hasSession }) => {
  const reduce = useReducedMotion();
  const { isSignup, loading, error, success } = auth;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 28, filter: "blur(12px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 1, ease: EASE_CANOPY, delay: 0.35 }}
      className="relative w-full overflow-hidden rounded-leaf-lg border border-bone-50/[0.1] bg-ink-900/80 p-6 shadow-slab-lg backdrop-blur-xl sm:p-8 xl:bg-ink-900/40"
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(200,255,212,0.45),transparent)]" />

      {/* Mode switch — an instrument toggle */}
      <div className="flex justify-center xl:justify-start">
        <div
          role="tablist"
          aria-label="Authentication mode"
          className="relative inline-flex rounded-full border border-bone-50/[0.1] bg-ink-950/80 p-1"
        >
          {MODES.map((option) => {
            const active = auth.mode === option;
            return (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => auth.handleModeSwitch(option)}
                className={`relative z-10 min-h-[44px] rounded-full px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verdant-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 ${
                  active ? "text-ink-950" : "text-bone-300 hover:text-bone-50"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="auth-mode-pill"
                    className="absolute inset-0 -z-10 rounded-full bg-verdant-400 shadow-glow"
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                {option === "login" ? "Sign In" : "Sign Up"}
              </button>
            );
          })}
        </div>
      </div>

      {!isDeviceOnline && !hasSession && (
        <div className="mt-5 flex items-center gap-2 rounded-leaf-xs border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <WifiOff className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
          <span>You're offline. Sign in requires an internet connection.</span>
        </div>
      )}

      <form onSubmit={isSignup ? auth.handleSignUp : auth.handleSignIn} className="mt-7 space-y-5">
        <div className="space-y-2 text-left">
          <label htmlFor="auth-email" className={labelStyles}>
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            value={auth.email}
            onChange={(e) => auth.setEmail(e.target.value)}
            required
            placeholder="you@atts.com"
            autoComplete="email"
            className={inputStyles}
          />
        </div>

        <div className="space-y-2 text-left">
          <div className="flex items-center justify-between">
            <label htmlFor="auth-password" className={labelStyles}>
              Password
            </label>
            {isSignup && (
              <span className="flex items-center gap-1 font-mono text-[10px] text-bone-400">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Min. 6 characters
              </span>
            )}
          </div>
          <div className="relative">
            <input
              id="auth-password"
              type={auth.showPassword ? "text" : "password"}
              value={auth.password}
              onChange={(e) => auth.setPassword(e.target.value)}
              required
              placeholder={isSignup ? "Create password" : "Enter password"}
              minLength={6}
              autoComplete={isSignup ? "new-password" : "current-password"}
              className={`${inputStyles} pr-16`}
            />
            <button
              type="button"
              onClick={() => auth.setShowPassword((prev) => !prev)}
              className="absolute right-1 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center font-mono text-[10px] uppercase tracking-[0.15em] text-bone-400 transition-colors hover:text-verdant-300 focus-visible:text-verdant-300 focus-visible:outline-none"
              aria-label={auth.showPassword ? "Hide password" : "Show password"}
            >
              {auth.showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {isSignup && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_CANOPY }}
            className="space-y-5 pt-1 text-left"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="auth-fullname" className={labelStyles}>
                  Full Name
                </label>
                <input
                  id="auth-fullname"
                  type="text"
                  value={auth.fullName}
                  onChange={(e) => auth.setFullName(e.target.value)}
                  required
                  placeholder="Your name"
                  autoComplete="name"
                  className={inputStyles}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="auth-license" className={labelStyles}>
                  License #
                </label>
                <input
                  id="auth-license"
                  type="text"
                  value={auth.driversLicenseNumber}
                  onChange={(e) => auth.setDriversLicenseNumber(e.target.value)}
                  required
                  placeholder="CDL / ID"
                  className={inputStyles}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="auth-phone" className={labelStyles}>
                Phone Number
              </label>
              <input
                id="auth-phone"
                type="tel"
                value={auth.phoneNumber}
                onChange={(e) => auth.setPhoneNumber(e.target.value)}
                placeholder="(555) 555-5555"
                autoComplete="tel"
                className={inputStyles}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="license-class" className={labelStyles}>
                  License Class
                </label>
                <select
                  id="license-class"
                  value={auth.driversLicenseClass}
                  onChange={(e) => auth.setDriversLicenseClass(e.target.value)}
                  required
                  className={inputStyles}
                >
                  <option value="" disabled>
                    Select
                  </option>
                  {LICENSE_CLASS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="license-expiration" className={labelStyles}>
                  Expiration
                </label>
                <input
                  id="license-expiration"
                  type="date"
                  value={auth.driversLicenseExpiration}
                  onChange={(e) => auth.setDriversLicenseExpiration(e.target.value)}
                  required
                  className={inputStyles}
                />
              </div>
            </div>
          </motion.div>
        )}

        {error && (
          <div role="alert" className="rounded-leaf-xs border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {success && (
          <div role="status" className="rounded-leaf-xs border border-verdant-500/30 bg-verdant-500/10 px-4 py-3 text-sm text-verdant-100">
            <p className="font-medium">{success}</p>
            {isSignup && <p className="mt-1 text-xs text-verdant-200/70">Check your email to confirm your account.</p>}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          aria-label={loading ? (isSignup ? "Creating account..." : "Signing in...") : isSignup ? "Create account" : "Sign in"}
          className={`group w-full text-base ${canopy.buttonPrimary}`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {isSignup ? "Creating account..." : "Signing in..."}
            </span>
          ) : (
            <>
              {isSignup ? "Create Account" : "Sign In"}
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 ease-canopy group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
            </>
          )}
        </button>

        {!isSignup && (
          <Link
            to="/reset-password"
            className="block text-center font-mono text-[11px] uppercase tracking-[0.15em] text-bone-300 transition-colors hover:text-verdant-300"
          >
            Forgot your password?
          </Link>
        )}

        <p className="pt-1 text-center text-[11px] text-bone-400">
          {isSignup ? "Already have an account? Sign in above." : "New to ATTS? Switch to Sign Up."}
        </p>
      </form>
    </motion.div>
  );
};
