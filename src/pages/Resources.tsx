import { useMemo, useState, useCallback } from "react";
import { motion, useScroll, useTransform, useMotionTemplate } from "framer-motion";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import { useCertificationTypes, useMyCertificationRecords } from "../hooks/useCertifications";
import { CertificationCard, ResourceCard } from "../components/certifications";
import { RefreshCw, Shield, AlertCircle } from "lucide-react";
import { TRAINING_ENTRIES } from "../content/trainingIndex";
import { SAFETY_ENTRIES } from "../content/safetyIndex";
import { getDeviceCapabilities } from "../lib/mobilePerf";
import { PowerSafeTrainingOverlay, PowerSafeStickyNote } from "../components/content/PowerSafeTrainingOverlay";

// ─── Visited-link tracking via localStorage ─────────────────────────

const VISITED_KEY = "atts-visited-resources";

function useVisitedResources() {
  const [visited, setVisited] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(VISITED_KEY);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const markVisited = useCallback((path: string) => {
    setVisited((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      try {
        localStorage.setItem(VISITED_KEY, JSON.stringify([...next]));
      } catch {
        /* storage quota — degrade silently */
      }
      return next;
    });
  }, []);

  return { visited, markVisited };
}

// ─── Skeleton loaders ───────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      className="rounded-xl min-h-[52px] bg-gray-800 animate-pulse"
      aria-hidden
    />
  );
}

function SkeletonSection() {
  return (
    <section aria-busy="true" aria-label="Loading section">
      <div className="mb-3 sm:mb-4 space-y-2">
        <div className="w-24 h-3 rounded bg-gray-800 animate-pulse" />
        <div className="w-48 h-5 rounded bg-gray-800 animate-pulse" />
      </div>
      <div className="space-y-2.5 sm:space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </section>
  );
}

// ─── Error tile ─────────────────────────────────────────────────────

function SectionError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-gray-900 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <AlertCircle className="w-4 h-4 shrink-0 text-red-400" strokeWidth={1.5} aria-hidden />
        <p className="text-sm text-white/60">
          {message || "Unable to load this section. Please try again later."}
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          aria-label="Retry loading"
          className="mt-2.5 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-black/20 transition-colors duration-150"
        >
          <RefreshCw className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
          Retry
        </button>
      )}
    </div>
  );
}

// ─── Motion variants ────────────────────────────────────────────────

const sectionVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const, delay: i * 0.07 },
  }),
};

// ─── Main component ─────────────────────────────────────────────────

export default function Resources() {
  const { user } = useAuth();
  const { data: types, isLoading: typesLoading, isError, refetch } = useCertificationTypes();
  const { data: records } = useMyCertificationRecords(user?.id);
  const prefersReducedMotion = useMemo(() => getDeviceCapabilities().prefersReducedMotion, []);
  const [powerSafeOverlayOpen, setPowerSafeOverlayOpen] = useState(false);
  const [powerSafeStickyVisible, setPowerSafeStickyVisible] = useState(false);
  const { visited, markVisited } = useVisitedResources();

  // Scroll-linked ambient gradient orb
  const { scrollYProgress } = useScroll();
  const orbR = useTransform(scrollYProgress, [0, 0.3, 0.6, 1], [10, 16, 30, 16]);
  const orbG = useTransform(scrollYProgress, [0, 0.3, 0.6, 1], [22, 50, 30, 50]);
  const orbB = useTransform(scrollYProgress, [0, 0.3, 0.6, 1], [40, 30, 35, 30]);
  const orbBackground = useMotionTemplate`radial-gradient(ellipse 80% 50% at 50% 15%, rgba(${orbR}, ${orbG}, ${orbB}, 0.35) 0%, transparent 70%)`;

  const recordByCert = (id: string) =>
    records?.find((r) => r.certification_type_id === id) ?? null;

  const allowedCertSlugs = useMemo(
    () => new Set((types ?? []).map((c) => c.slug)),
    [types]
  );
  const visibleTrainingEntries = useMemo(
    () =>
      TRAINING_ENTRIES.filter(
        (e) => !e.certificationSlug || allowedCertSlugs.has(e.certificationSlug)
      ),
    [allowedCertSlugs]
  );

  const renderCertificationsContent = () => {
    if (typesLoading) {
      return (
        <div className="space-y-2.5 sm:space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      );
    }

    if (isError) {
      return (
        <SectionError
          message="Unable to load certifications. Check your connection."
          onRetry={() => refetch()}
        />
      );
    }

    if (types?.length) {
      return (
        <div className="space-y-2.5 sm:space-y-3">
          {types.map((cert) => (
            <CertificationCard
              key={cert.id}
              cert={cert}
              record={recordByCert(cert.id)}
              visited={visited.has(`/resources/certification/${cert.slug}/test`)}
              onClick={() => markVisited(`/resources/certification/${cert.slug}/test`)}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-gray-900 to-gray-950 p-3 sm:p-4 text-center shadow-md shadow-black/20 before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:pointer-events-none">
        <p className="text-sm text-white/60">No certifications available.</p>
        <p className="mt-1 text-xs text-white/40">
          Contact your administrator if you expect to see them here.
        </p>
      </div>
    );
  };

  const motionInitial = prefersReducedMotion ? false : "hidden";

  return (
    <DashboardLayout title="Resources" pageHeading>
      {/* Scroll-linked ambient gradient orb */}
      {!prefersReducedMotion && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-0"
          style={{ background: orbBackground }}
          aria-hidden
        />
      )}

      <div className="relative z-10 mx-auto max-w-2xl space-y-6 sm:space-y-8 w-full">
        {/* ─── Page header ─────────────────────────────────────────── */}
        <motion.header
          className="relative text-center"
          variants={sectionVariants}
          initial={motionInitial}
          animate="visible"
          custom={0}
        >
          <div
            className="pointer-events-none absolute -inset-x-12 -top-16 bottom-0"
            aria-hidden
            style={{
              background:
                "radial-gradient(ellipse 60% 80% at 50% 0%, rgba(16,185,129,0.07) 0%, transparent 70%)",
            }}
          />
          <p className="relative text-xs font-medium uppercase tracking-wider text-emerald-400/80">
            Company Resources
          </p>
          <h1 className="relative text-2xl font-bold text-white mt-1">
            Resources
          </h1>
          <p className="relative text-sm text-white/60 mt-1">
            Training, certifications, safety references, and emergency procedures
          </p>
        </motion.header>

        {/* ─── In Case of Emergency ────────────────────────────────── */}
        <motion.section
          className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-950/90 to-red-950/70 p-4 sm:p-6 shadow-lg shadow-black/25 emergency-glow-pulse before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-red-400/10 before:to-transparent before:pointer-events-none"
          variants={sectionVariants}
          initial={motionInitial}
          animate="visible"
          custom={1}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-20 h-20 shrink-0">
              <img
                src="/assets/emergency-action-plan.webp"
                loading="lazy"
                alt=""
                className="w-full h-full object-contain"
                aria-hidden
              />
            </div>
            <h2 className="text-lg font-semibold text-white">In Case of Emergency</h2>
          </div>
          <p className="mb-3 text-sm text-white/60">
            Emergency contacts, 911, hospital directions, evacuation procedures, and OSHA reporting.
          </p>
          <ResourceCard
            to="/emergency-action-plan"
            title="Emergency Action Plan"
            subtitle="Open now for 911, site contacts, triage, and post-incident steps"
            variant="danger"
            visited={visited.has("/emergency-action-plan")}
            onClick={() => markVisited("/emergency-action-plan")}
          />
        </motion.section>

        {/* ─── Power Safe Training CTA — do not modify ─────────────── */}
        <section className="flex justify-center py-4 sm:py-6">
          <motion.button
            type="button"
            onClick={() => setPowerSafeOverlayOpen(true)}
            className="group relative flex items-center justify-center gap-2 sm:gap-3 py-3 px-5 sm:py-4 sm:px-8 rounded-xl sm:rounded-2xl text-white font-bold text-base sm:text-lg shadow-xl sm:shadow-2xl transition-all duration-300 hover:scale-[1.02] sm:hover:scale-[1.03] hover:shadow-[0_15px_40px_-10px_rgba(139,92,246,0.5)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#010604] min-h-[48px] sm:min-h-[56px] overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 25%, #ec4899 50%, #3b82f6 75%, #7c3aed 100%)',
              backgroundSize: '200% 200%',
              animation: prefersReducedMotion ? 'none' : 'pulse-gradient 4s ease-in-out infinite',
            }}
            initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const }}
          >
            <div
              className="hidden sm:block absolute inset-0 opacity-30 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: prefersReducedMotion ? 'none' : 'shimmer-sweep 3s ease-in-out infinite',
              }}
            />
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 relative z-10 transition-transform group-hover:scale-110" />
            <span className="relative z-10">Power Safe Training</span>
          </motion.button>
        </section>

        {/* ─── Certifications ──────────────────────────────────────── */}
        <motion.section
          variants={sectionVariants}
          initial={motionInitial}
          animate="visible"
          custom={2}
        >
          {typesLoading ? (
            <SkeletonSection />
          ) : (
            <>
              <div className="mb-3 sm:mb-4">
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/80 mb-1">Certifications</p>
                <h2 className="text-lg font-semibold text-white">Take Tests &amp; Track Status</h2>
              </div>
              {renderCertificationsContent()}
            </>
          )}
        </motion.section>

        {/* ─── Training Materials ───────────────────────────────────── */}
        <motion.section
          variants={sectionVariants}
          initial={motionInitial}
          animate="visible"
          custom={3}
        >
          <div className="mb-3 sm:mb-4">
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/80 mb-1">Training Materials</p>
            <h2 className="text-lg font-semibold text-white">Reference Docs &amp; Study Guides</h2>
          </div>
          {visibleTrainingEntries.length > 0 ? (
            <div className="space-y-2.5 sm:space-y-3">
              {visibleTrainingEntries.map((entry) => (
                <ResourceCard
                  key={entry.id}
                  to={`/resources/doc/training/${entry.slug}`}
                  title={entry.title}
                  subtitle={entry.description}
                  visited={visited.has(`/resources/doc/training/${entry.slug}`)}
                  onClick={() => markVisited(`/resources/doc/training/${entry.slug}`)}
                />
              ))}
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-gray-900 to-gray-950 p-3 sm:p-4 text-center shadow-md shadow-black/20 before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:pointer-events-none">
              <p className="text-sm text-white/60">No training materials available.</p>
            </div>
          )}
        </motion.section>

        {/* ─── Safety Resources ─────────────────────────────────────── */}
        <motion.section
          variants={sectionVariants}
          initial={motionInitial}
          animate="visible"
          custom={4}
        >
          <div className="mb-3 sm:mb-4">
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/80 mb-1">Safety Resources</p>
            <h2 className="text-lg font-semibold text-white">Quick Reference &amp; Guidelines</h2>
          </div>
          {SAFETY_ENTRIES.length > 0 ? (
            <div className="space-y-2.5 sm:space-y-3">
              {SAFETY_ENTRIES.map((entry) => (
                <ResourceCard
                  key={entry.id}
                  to={`/resources/doc/safety/${entry.slug}`}
                  title={entry.title}
                  subtitle={entry.description}
                  visited={visited.has(`/resources/doc/safety/${entry.slug}`)}
                  onClick={() => markVisited(`/resources/doc/safety/${entry.slug}`)}
                />
              ))}
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-gray-900 to-gray-950 p-3 sm:p-4 text-center shadow-md shadow-black/20 before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:pointer-events-none">
              <p className="text-sm text-white/60">No safety resources available.</p>
            </div>
          )}
        </motion.section>
      </div>

      <PowerSafeTrainingOverlay
        isOpen={powerSafeOverlayOpen}
        onClose={() => setPowerSafeOverlayOpen(false)}
        onPinStickyNote={() => {
          setPowerSafeStickyVisible(true);
          setPowerSafeOverlayOpen(false);
        }}
      />

      <PowerSafeStickyNote
        isVisible={powerSafeStickyVisible}
        onClose={() => setPowerSafeStickyVisible(false)}
      />
    </DashboardLayout>
  );
}
