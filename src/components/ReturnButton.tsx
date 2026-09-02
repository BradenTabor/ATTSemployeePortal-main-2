/**
 * ReturnButton — the CANOPY return dock.
 *
 * One sticky node for "get me out of here": a leaf pill fixed bottom-left
 * (thumb reach; the action FAB owns bottom-right) with two segments —
 * Back (in-app history, else the role home) and the role dashboard.
 *
 * It is mounted once at the router root (outside <Routes>) so it survives
 * route transitions and never inherits a PageWrapper transform, which would
 * otherwise turn `position: fixed` into "absolute inside the animating page"
 * and let the dock drift or disappear mid-transition. It deliberately stays
 * inside the app shell's stacking context (not portaled to <body>) so
 * body-portaled modal overlays continue to cover it.
 */

import { memo, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Home } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { getRoleDashboard } from "../lib/navigation";
import { getDeviceCapabilities } from "../lib/mobilePerf";
import { cn } from "../lib/utils";
import { Z } from "../lib/zIndex";
import { EASE_CANOPY } from "../motion/presets";

/** Routes that render outside the authenticated shell or deliberately gate the dashboard. */
const HIDDEN_PREFIXES = ["/reset-password", "/verify/", "/safety-briefing"];

/**
 * The Daily JSA wizard is a full-screen `fixed inset-0` app with its own
 * always-visible top-bar Back and a fixed Prev/Save/Next footer that the dock
 * would sit on top of. Tree Felling JSA is a normal in-flow page and keeps it.
 */
function isFullScreenWizard(path: string): boolean {
  if (path.startsWith("/forms/jsa/tree-felling")) return false;
  return path === "/forms/jsa" || path.startsWith("/forms/jsa/");
}

interface DockPlan {
  homeTarget: string;
  /** Full destination name for the accessible label */
  homeLabel: string;
  /** Compact label shown on wider screens next to the home glyph */
  homeShort: string;
  /** Back is meaningless on the role home itself */
  showBack: boolean;
}

function planDock(role: string | null | undefined, path: string): DockPlan | null {
  if (path === "/" || HIDDEN_PREFIXES.some((p) => path.startsWith(p)) || isFullScreenWizard(path)) {
    return null;
  }

  const home = getRoleDashboard(role);
  if (path === home) {
    // The admin hub is its own home; the main crew dashboard is the way out.
    if (role === "admin") {
      return { homeTarget: "/dashboard", homeLabel: "Main Dashboard", homeShort: "Main", showBack: false };
    }
    return null;
  }

  return role === "admin"
    ? { homeTarget: home, homeLabel: "Admin Dashboard", homeShort: "Admin", showBack: true }
    : { homeTarget: home, homeLabel: "Dashboard", homeShort: "Dashboard", showBack: true };
}

const SEGMENT =
  "tap-44 relative flex h-11 min-w-[44px] items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] " +
  "text-bone-100 transition-colors duration-300 ease-canopy hover:bg-verdant-400/10 hover:text-bone-50 " +
  "active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-verdant-400";

function ReturnButtonComponent() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { role, session, loading } = useAuth();

  const caps = useMemo(() => getDeviceCapabilities(), []);
  const reduce = caps.prefersReducedMotion;

  const plan = useMemo(
    () => (session && !loading ? planDock(role, pathname) : null),
    [session, loading, role, pathname]
  );

  const goBack = useCallback(() => {
    // React Router keeps its own history index; on the first entry (deep link /
    // PWA launch) there is nothing in-app to pop, so fall back to the role home.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(plan?.homeTarget ?? getRoleDashboard(role));
  }, [navigate, plan, role]);

  const goHome = useCallback(() => {
    if (plan) navigate(plan.homeTarget);
  }, [navigate, plan]);

  return (
    <AnimatePresence>
      {plan && (
        <motion.nav
          key="return-dock"
          aria-label="Return navigation"
          data-testid="return-dock"
          className="group fixed bottom-safe-4 left-[max(1rem,env(safe-area-inset-left,0px))] sm:bottom-safe-6 sm:left-[max(1.5rem,env(safe-area-inset-left,0px))]"
          style={{ zIndex: Z.nav }}
          initial={reduce ? false : { opacity: 0, y: 16, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(6px)" }}
          transition={{ duration: reduce ? 0.01 : 0.5, ease: EASE_CANOPY }}
        >
          {/* bioluminescent halo */}
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-3 rounded-leaf bg-[radial-gradient(circle,rgba(61,220,132,0.45),transparent_65%)] opacity-40 blur-xl transition-opacity duration-500 ease-canopy group-hover:opacity-90 group-focus-within:opacity-90"
          />

          <div className="relative flex items-stretch overflow-hidden rounded-leaf-sm border border-verdant-400/40 bg-[linear-gradient(160deg,#12482a_0%,#0b100d_55%,#040605_100%)] shadow-slab">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-3 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(200,255,212,0.7),transparent)]"
            />

            {plan.showBack && (
              <>
                <button
                  type="button"
                  onClick={goBack}
                  aria-label="Go back"
                  data-testid="return-dock-back"
                  className={cn(SEGMENT, "group/back pl-3.5 pr-4")}
                >
                  <ArrowLeft
                    className="h-4 w-4 text-verdant-200 transition-transform duration-300 ease-canopy group-hover/back:-translate-x-0.5"
                    aria-hidden
                  />
                  Back
                </button>
                <span aria-hidden className="my-2.5 w-px bg-verdant-400/25" />
              </>
            )}

            <button
              type="button"
              onClick={goHome}
              aria-label={`Return to ${plan.homeLabel}`}
              title={`Return to ${plan.homeLabel}`}
              data-testid="return-dock-home"
              className={cn(SEGMENT, plan.showBack ? "px-3.5 sm:pr-4" : "pl-3.5 pr-4")}
            >
              <Home className="h-4 w-4 text-verdant-200" aria-hidden />
              <span className={plan.showBack ? "hidden sm:inline" : undefined}>{plan.homeShort}</span>
            </button>
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}

export default memo(ReturnButtonComponent);
