import { useState, FormEvent } from "react";
import { supabase } from "@/lib/supabaseClient";
import { logger } from "@/lib/logger";
import type { AuthMode } from "./authCopy";

/**
 * Owns all sign in / sign up form state and Supabase handlers for the Home page.
 * Logic is preserved verbatim from the previous inline implementation so that
 * authentication behavior is unchanged — only the presentation is refactored.
 */
export function useAuthForm() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [driversLicenseNumber, setDriversLicenseNumber] = useState("");
  const [driversLicenseClass, setDriversLicenseClass] = useState("");
  const [driversLicenseExpiration, setDriversLicenseExpiration] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const isSignup = mode === "signup";

  const handleModeSwitch = (newMode: AuthMode) => {
    logger.info(`Switching mode to: ${newMode}`);
    setMode(newMode);
    setError(null);
    setSuccess(null);
    setShowPassword(false);
    if (newMode === "login") {
      setFullName("");
      setPhoneNumber("");
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
            phone_number: phoneNumber.trim() || undefined,
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
          setPhoneNumber("");
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

  return {
    mode,
    isSignup,
    email,
    setEmail,
    password,
    setPassword,
    loading,
    error,
    success,
    fullName,
    setFullName,
    phoneNumber,
    setPhoneNumber,
    driversLicenseNumber,
    setDriversLicenseNumber,
    driversLicenseClass,
    setDriversLicenseClass,
    driversLicenseExpiration,
    setDriversLicenseExpiration,
    showPassword,
    setShowPassword,
    handleModeSwitch,
    handleSignIn,
    handleSignUp,
  };
}

export type AuthFormApi = ReturnType<typeof useAuthForm>;
