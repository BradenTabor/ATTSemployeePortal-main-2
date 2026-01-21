import { memo } from "react";
import { motion } from "framer-motion";
import { LogOut, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { getDeviceCapabilities } from "../lib/mobilePerf";

// Theme variants for different dashboard styles
export type ProfileBarTheme = "emerald" | "gold" | "ember" | "purple" | "redwhite" | "bluewhite";

interface ProfileBarProps {
  email: string | undefined;
  role: string | null;
  onSignOut: () => void;
  theme?: ProfileBarTheme;
}

// Theme-specific styling configurations
const themeStyles: Record<ProfileBarTheme, {
  container: string;
  label: string;
  roleText: string;
}> = {
  emerald: {
    container: "border-white/10 bg-[#03150f]/80",
    label: "text-emerald-200/70",
    roleText: "text-white/60",
  },
  gold: {
    container: "border-[#f6dcb2]/20 bg-[#14110d]/80",
    label: "text-[#f8dfb3]/70",
    roleText: "text-[#f8e5bb]/60",
  },
  ember: {
    container: "border-[#ff9350]/20 bg-[#140804]/80",
    label: "text-[#ffb48a]/70",
    roleText: "text-white/60",
  },
  purple: {
    container: "border-[#c084fc]/20 bg-[#2d1b4e]/60",
    label: "text-[#e9d5ff]/70",
    roleText: "text-white/60",
  },
  redwhite: {
    container: "border-[#fecaca]/25 bg-[#450a0a]/60",
    label: "text-[#fef2f2]/70",
    roleText: "text-white/60",
  },
  bluewhite: {
    container: "border-blue-500/25 bg-[#0a1628]/60",
    label: "text-blue-200/70",
    roleText: "text-white/60",
  },
};

const ProfileBar = memo(function ProfileBar({
  email,
  role,
  onSignOut,
  theme = "emerald",
}: ProfileBarProps) {
  const caps = getDeviceCapabilities();
  const styles = themeStyles[theme];

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${styles.container}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] sm:text-xs uppercase tracking-[0.35em] ${styles.label}`}>
            Signed in as
          </p>
          <p className="text-sm sm:text-base font-semibold text-white mt-1 truncate">
            {email}
          </p>
          <p className={`text-xs sm:text-sm capitalize ${styles.roleText}`}>
            {role?.replace(/_/g, " ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <motion.div
            whileHover={caps.prefersReducedMotion ? undefined : { scale: 1.02 }}
            whileTap={caps.prefersReducedMotion ? undefined : { scale: 0.96 }}
          >
            <Link
              to="/profile"
              className="flex-shrink-0 inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/15 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white border border-white/20 transition-colors min-h-[44px]"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Profile</span>
            </Link>
          </motion.div>
          <motion.button
            whileHover={caps.prefersReducedMotion ? undefined : { scale: 1.02 }}
            whileTap={caps.prefersReducedMotion ? undefined : { scale: 0.96 }}
            onClick={onSignOut}
            className="flex-shrink-0 inline-flex items-center gap-2 rounded-full bg-[#ff0000] px-4 py-2.5 text-xs sm:text-sm font-semibold border-4 border-[rgba(255,214,214,0.55)] hover:bg-red-600 transition-colors min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </motion.button>
        </div>
      </div>
    </div>
  );
});

export default ProfileBar;

